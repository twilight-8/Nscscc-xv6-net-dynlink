# 锁规则与并发案例

本文定义本项目内核的锁层级与持有规则，并按“现象—分析—修复—复测”格式记录并发相关缺陷的处理闭环。

## 锁模型

主 I/O 路径的获取方向如下：

```text
ip->lock                    （单个 inode，sleeplock）
  ext2fs.lock/fat32fs.lock  （后端分配器，sleeplock）
    buffer cache/块锁
      disk.vdisk_lock       （virtio 磁盘队列，spinlock）
```

`itable.lock` 只短暂保护 inode 槽位与引用计数，通常在获取 `ip->lock` 或进入磁盘路径前释放；`iput()` 的最后引用分支取得 `ip->lock` 后立即释放 `itable.lock`，再执行截断和写盘。

`mtable.lock` 不属于上述主链，而是挂载表的**叶级短持有 spinlock**。允许 `ip->lock → mtable.lock`：`vfs_mount()` 在锁定挂载点 inode 后预留表项，unlink 也在锁定目标 inode 后查询挂载表。反方向禁止：持有 `mtable.lock` 时不得再获取 `ip->lock`、`itable.lock`、后端锁、buffer cache 锁或块锁。

`mtable.oplock` 是仅供 `vfs_mount()/vfs_umount()` 使用的**可睡眠操作锁**，位于整次拓扑修改最外层：从路径解析、状态转换、后端初始化/清理直到发布或失败回滚都串行执行。它可以跨磁盘 I/O 持有；`mtable.lock` 仍只短暂保护表项，二者职责不同。unlink 不获取 `oplock`，而是通过挂载点 `ip->lock` 与四态表观察非 `MOUNT_FREE` 项。

规则：

1. 主 I/O 路径只按 `ip->lock → 后端锁 → buffer/块锁 → vdisk_lock` 获取，不得反向。
2. 持 spinlock 期间不得睡眠；`bread()`、后端 `mount()` 等可能等待磁盘的函数不能在 `mtable.lock` 或 `itable.lock` 内调用。
3. `mtable.lock` 内只扫描或改写挂载表字段和 `readers` pin，随后立即释放；`idup()` 和后端 I/O 均在锁外执行。pin 保证锁外 `idup()` 期间表项不会被卸载回收。
4. `vfs_mount()/vfs_umount()` 必须先取得 `mtable.oplock`，并在所有成功/失败出口释放；普通路径不得获取该锁。
5. 后端 fs 锁只在分配/释放路径获取，且获取时不得持有缓冲块锁。
6. 定时器看门狗 `virtio_disk_watchdog()` 仅在 `vdisk_lock` 空闲时介入，下一 tick 重试，避免在中断上下文与持锁者互等。

## 案例闭环

### 案例 1：inode 缓存被磁盘旧值覆盖（B1）

- 现象：静态审查发现 ext2/fat32 的 iget 在缓存命中时仍用磁盘 dinode重填内存 inode，可把未同步的内存状态（size/nlink/addrs）回退。
- 分析：xv6 原生语义仅在 `valid==0` 时从磁盘填充；我们的实现破坏了“内存最新、磁盘其次”的所有权约定。
- 修复：`iget()` 取得引用后先以 acquire load 检查 `valid`，命中直接返回；冷 inode 获取 `ip->lock` 后再次检查，仅首个进入者填充字段，最后以 release store 发布 `valid=1`。这样等待者不会看到半初始化字段，热路径也不会在已锁定父目录时再锁子 inode。
- 复测：双架构全量回归 + 官方流程彩排通过。

### 案例 2：unlink 打开中文件的提前释放（B2）

- 现象：unlink 在 nlink 归零时立即释放 inode/簇链，与打开中的 fd 冲突。
- 分析：非 xv6 后端的 `iput()` 缺少 `ref==1 && nlink==0` 延迟释放分支。
- 修复：unlink 仅减 nlink；释放移入 `iput()` 分支，经 `itrunc` 钩子；修复在 `itable.lock` 释放后进行，不持 spinlock 睡眠。
- 复测：`unlinkopen` 双后端回归用例双架构通过。

### 案例 3：后端分配器 SMP 竞争（C1）

- 现象：CPUS=3 三路并发写 1MiB 时 fat32 确定性挂死；ext2 正常。
- 分析：fat32 分配“读-判零-写”无锁（ext2 位图操作因持缓冲块锁天然串行）；`next_free` 提示进一步放大碰撞概率。
- 修复：双后端各加一把 sleeplock 包裹分配/释放路径，层级位于 inode锁之下、缓冲锁之上（见上方层级图）。
- 复测：SMP 测试点双架构 PASS；压测后 e2fsck 零错误。

### 案例 4：LoongArch 磁盘完成中断丢失

- 现象：完整 usertests 的 `manywrites` 在 LoongArch 确定性挂死；gdb 取证显示设备已投递完成而客户机未处理（used 环相差 2）。
- 分析：INTx 链在确认窗口内到达的完成可能被控制器链吞没且不补报，等待者从此无人唤醒——锁无法解决“中断不来”的问题。
- 修复：devintr 确认后循环重查 + 定时器看门狗兜底（规则 6）。
- 复测：LoongArch 完整 usertests 首次全绿，双架构 SMP 套件通过。

### 案例 5：dinode 拷贝越界（决赛期间引入并修复）

- 现象：扩展 `addrs` 槽位后 `fourfiles` panic：`ilock: no type`。
- 分析：`iupdate` 以内存 `addrs` 尺寸向磁盘 dinode 拷贝，越界 4 字节覆写相邻 dinode 的 type。
- 修复：拷贝上界改为磁盘 dinode 的尺寸。
- 复测：完整 usertests 双架构通过；该约束已写入 [design.md](../design.md)。

### 案例 6：挂载初始化与挂载表发布竞态

- 现象：布尔 `used` 无法区分“表项已占用”和“后端根 inode 已可用”；目标目录检查与表项登记之间还存在被并发 unlink 的窗口，同类型并发挂载会争用 ext2/fat32 的静态实例状态。
- 分析：`mtable.lock` 只能保护挂载表内存，不能跨后端磁盘 I/O 长时间持有；单靠状态机又不能让两次挂载的路径解析与发布形成同一顺序，因此需要把“操作串行化”和“状态发布”分开处理。
- 修复：`mtable.oplock` 串行化整次 `vfs_mount()`；挂载点保持 `ip->lock` 直到表项在 `mtable.lock` 内预留为 `MOUNTING`。随后释放短持有 spinlock 执行后端 I/O，成功后发布 `MOUNTED`，失败则先回收为 `MOUNT_FREE` 再释放引用。`MOUNTING/MOUNTED` 都让 unlink 观察到挂载点正在使用，路径只采用 `MOUNTED` 根；同类型、同一挂载点及目标恰为已有挂载根的请求会被拒绝。
- 复测：双架构 error 在 CPUS=3 下对 ext2/FAT32 各发起一组后台/前台请求，均精确得到 1 次成功、1 次失败，并验证同类型不同目录及不同类型同一路径拒绝。该 shell 测试验证串行后的最终互斥语义，不宣称确定性命中 `MOUNTING`；发布、失败回滚及 mount/unlink 可见性由锁序和状态转换审查闭环。semantics 与 SMP 分别验证发布后的路径跳转和并发文件访问。
- 已知边界：操作锁只把拓扑修改排成顺序，不维护完整挂载拓扑。顺序执行“先挂 `/a/b`、再挂 `/a`”仍会由后一次祖先挂载遮蔽前一表项，该反向祖先覆盖列为 P1 限制，不宣称已由 `oplock` 解决。

### 案例 7：卸载与路径遍历的引用竞态

- 现象：若路径查询先从挂载表读出 `root/parent` 指针、释放 `mtable.lock` 后才 `idup()`，并发卸载可能在两步之间释放 inode；反之在表锁内直接 `idup()` 又会引入 `mtable.lock → itable.lock` 嵌套，破坏叶级锁规则。
- 分析：挂载表项需要一个只覆盖“读指针到取得 inode 引用”窗口的短期存活保证；长期 busy 状态仍应由既有 `inode.ref` 判断，避免再维护一套 open 计数。
- 修复：每个表项增加受 `mtable.lock` 保护的 `readers` pin。`vfs_mounted_root()` 和挂载根 `..` 路径在锁内加 pin、锁外 `idup()`、再回锁减 pin；`vfs_umount()` 仅在 pin 为 0 时原子切换到 `MOUNT_UNMOUNTING`。随后扫描 inode 表：除挂载表自身的 root 引用外，任何打开文件、cwd、在途路径或子挂载引用都返回 busy 并恢复 `MOUNTED`；无引用才清理后端并发布 `MOUNT_FREE`。
- 复测：双架构 semantics 覆盖 cwd busy、成功卸载、底层目录恢复和两后端重挂载；CPUS=3 `umountstress` 并发执行 lookup 与反复 `mount/umount`，双架构均到达 `UMOUNT_STRESS_OK`，无 panic/kerneltrap。
