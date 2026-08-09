# 锁规则与并发案例

本文定义本项目内核的锁层级与持有规则，并按“现象—分析—修复—复测”格式记录并发相关缺陷的处理闭环。

## 锁层级（获取顺序，自上而下）

```text
mtable.lock          （挂载表，spinlock）
  itable.lock        （inode 缓存表，spinlock）
    ip->lock         （单个 inode，sleeplock）
      ext2fs.lock / fat32fs.lock   （后端分配器，sleeplock）
        bcache.lock  （缓冲区缓存，spinlock）
          b->lock    （单个缓冲区，sleeplock）
            disk.vdisk_lock（virtio 磁盘队列，spinlock）
```

规则：

1. 只允许按层级自上而下获取锁；任何反向获取都是 bug。
2. 持 spinlock 期间不得睡眠（不得调用可能睡眠的函数，如 bread 路径）。
3. sleeplock 可在睡眠期间持有，但不得持有它去获取上层锁。
4. 后端 fs 锁只在分配/释放路径获取，且获取时不得持有缓冲块锁。
5. 定时器看门狗 `virtio_disk_watchdog()` 仅在 `vdisk_lock` 空闲时介入，下一 tick 重试，避免在中断上下文与持锁者互等。

## 案例闭环

### 案例 1：inode 缓存被磁盘旧值覆盖（B1）

- 现象：静态审查发现 ext2/fat32 的 iget 在缓存命中时仍用磁盘 dinode重填内存 inode，可把未同步的内存状态（size/nlink/addrs）回退。
- 分析：xv6 原生语义仅在 `valid==0` 时从磁盘填充；我们的实现破坏了“内存最新、磁盘其次”的所有权约定。
- 修复：仅 `valid==0` 时填充；缓存命中直接返回。
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
- 修复：devintr 确认后循环重查 + 定时器看门狗兜底（规则 5）。
- 复测：LoongArch 完整 usertests 首次全绿，双架构 SMP 套件通过。

### 案例 5：dinode 拷贝越界（决赛期间引入并修复）

- 现象：扩展 `addrs` 槽位后 `fourfiles` panic：`ilock: no type`。
- 分析：`iupdate` 以内存 `addrs` 尺寸向磁盘 dinode 拷贝，越界 4 字节覆写相邻 dinode 的 type。
- 修复：拷贝上界改为磁盘 dinode 的尺寸。
- 复测：完整 usertests 双架构通过；该约束已写入 [design.md](../design.md)。
