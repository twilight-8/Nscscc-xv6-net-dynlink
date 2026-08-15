# 比赛过程中的重要进展

本文档按阶段记录项目从基线建立到当前的主要进展。每阶段按“主要目标、主要改动、验证结果”组织，对应内容可在提交历史与 `tests/evidence/` 的测试日志中复核。

## 阶段 0：项目基线与测试环境

主要工作：

- 整理原始 xv6-riscv rev5 源码目录。
- 建立 `docs/`、`tests/`、`submit/` 等项目辅助目录。
- 保留原始 xv6 自带测试入口，作为后续每个阶段的回归基准。
- 明确赛题目标：支持 xv6、ext2、fat32，以及 RISC-V、LoongArch 两个平台。

阶段意义：

这是项目的地基。之后每次改动都需要回到这个基线，确认没有破坏 xv6 原有行为。

## 阶段 A：薄 VFS 虚拟文件系统分发层

主要目标：

在不改变 xv6 原有行为的前提下，先把 VFS 分发层搭起来。

主要改动：

- 新增 `kernel/vfs.h`，定义 `fs_type`、`inode_ops`、`fs_ops`、`mount`。
- 新增 `kernel/vfs.c`，实现 `vfs_readi()`、`vfs_writei()`、`vfs_stati()`、`vfs_itrunc()`。
- 扩展 `struct inode`，加入 `fstype`、`mnt`、`ops`。
- 在 `iget()` 中初始化 inode 的 VFS 字段，默认绑定 xv6 后端操作表。
- 将普通文件 `read/write/stat/O_TRUNC` 切换到 VFS wrapper。
- 在 `main.c` 中预留 `vfsinit()` 初始化入口。
- 在 `Makefile` 中加入 `kernel/vfs.o`。

阶段效果：

```text
系统调用
  -> VFS wrapper
  -> inode->ops
  -> 原 xv6 文件系统函数
```

验证结果：

- `make kernel/kernel`：通过。
- `python3 test-xv6.py usertests -q`：通过。

## 阶段 B：挂载表与块设备访问接口

主要目标：

让路径解析具备跨文件系统能力，使 `/mnt` 能作为 ext2 的挂载入口。

主要改动：

- 在 `vfs.c` 中维护 mount table。
- 实现 `vfs_mount()`，支持按文件系统类型挂载。
- 实现 `vfs_mountpoint()`，路径解析时判断是否需要切换根 inode。
- 修改 `fs.c:namex()`，遇到挂载点时从 xv6 目录切换到挂载文件系统根目录。
- 增加 `sys_mount()` 和用户态 `mount` 命令，采用显式挂载方式。
- 新增 `EXT2DEV` 逻辑设备号。
- 修改 `virtio_disk.c`，将 `EXT2DEV` 映射到 `fs.img` 后半部分。
- 修改 `Makefile`，生成 `ext2.img` 并追加到 `fs.img`。

阶段效果：

```text
/mnt
  -> xv6 中的普通目录
  -> 执行 mount ext2 /mnt 后被 mount table 记录为 ext2 挂载点
  -> /mnt/hello.c 进入 ext2 后端解析
```

验证结果：

- `make kernel/kernel`：通过。
- `make fs.img`：通过。
- 原 xv6 回归测试继续通过。

## 阶段 C：ext2 最小文件系统支持

主要目标：

打通公开测试中的 ext2 访问路径，支持 `cat hello.c > /mnt/hello.c` 和跨文件系统复制。

主要改动：

- 新增 `kernel/ext2.c`。
- 支持读取 ext2 superblock 和 group descriptor。
- 支持读取、写回 ext2 inode。
- 支持 ext2 目录项查找。
- 支持普通文件创建。
- 支持普通文件 read/write/stat/trunc。
- 支持直接块和一级间接块。
- 支持块位图和 inode 位图的最小分配。
- 新增公开测试辅助用户程序 `test1`、`test2`。
- 在镜像中加入 `hello.c`、`tests/hello.c`，方便本地复现公开测试路径。

阶段效果：

```text
cat hello.c > /mnt/hello.c
  -> namex 切换到 ext2 root
  -> vfs_create 调用 ext2_create
  -> vfs_writei 调用 ext2_writei
  -> 数据写入 fs.img 后半部分的 ext2 镜像
```

验证结果：

- `test1: succeed`
- `test2: succeed`
- `python3 test-xv6.py usertests -q`：`ALL TESTS PASSED`
- `e2fsck -fn` 检查 ext2 镜像：无错误。

## 阶段 D：fat32 最小文件系统支持

主要目标：

在不扩大 VFS 接口的前提下，完成 fat32 的最小闭环，使系统能够同时挂载 xv6、ext2 和 fat32，并支持 fat32 普通文件演示。

主要改动：

- 新增 `kernel/fat32.c`，实现 fat32 BPB 识别、FAT 表读写、cluster 分配和目录项解析。
- 新增 `mkfs/mkfat32.c`，生成最小 fat32 镜像，减少对宿主机 `mkfs.fat` 的依赖。
- 新增 `FAT32DEV` 和 `FAT32START`，把 fat32 镜像追加到 xv6、ext2 区域之后。
- 修改 `virtio_disk.c`，按逻辑设备号把 fat32 访问映射到 `fs.img` 的 fat32 区域。
- 修改 `Makefile`，编译 `fat32.o`，生成 `fat32.img`，并在 `fs.img` 后追加 fat32 镜像。
- 支持 `mount fat32 /fat`、`ls /fat`、`cat /tests/hello.c > /fat/hello.c`、覆盖写入、子目录创建和 `..` 路径访问。
- 修复 ext2 测试镜像构建流程，在 `ext2.img` 中预置 `hello.c`，使 `test1` 的初始读取路径更贴近公开样例。

阶段边界：

- fat32 当前只支持 8.3 短文件名。
- 支持基础 `unlink`；`link/rename` 不支持。
- 暂不维护完整时间戳、权限和 FSInfo 空闲计数。

验证结果：

- fat32 手动功能测试：通过。
- ext2 `test1/test2` 回归：通过。
- `python3 test-xv6.py usertests -q`：`ALL TESTS PASSED`。
- `make test_baseline && make run`：PASS。
- `e2fsck -fn` 检查 ext2 镜像：无错误。

## 阶段 D4：fat32 精巧性与稳定性审查

主要目标：

在进入 HAL/LoongArch 之前，对 fat32 当前实现做一次收口，确认代码没有明显冗余，测试覆盖了最容易出问题的边界。

> 编号说明：本阶段是阶段 D（fat32 支持）的收口审查，不重开新功能线，故编号为 D4 而非 E。

主要改动：

- 移除 `fat32_writei()` 中不必要的预读逻辑。底层 `block_write_bytes()` 已经能处理局部写入，所以这里可以直接 `copyin` 后写入，代码更短，磁盘访问也更少。
- 移除未使用的 FAT32 属性宏，保持 `fat32.c` 更干净。
- 保持 VFS 接口不变，没有为 fat32 额外增加新抽象。
- 明确 fat32 当前边界：只支持 8.3 短文件名，支持基础 `unlink`，不支持长文件名、`link/rename` 和完整时间戳维护。

补充测试：

- 空文件创建：`cat /missing > /fat/empty` 后 `ls /fat` 显示 0 字节文件。
- 覆盖写：`echo old > /fat/s.c` 后再 `echo new > /fat/s.c`，读取结果为 `new`。
- 跨 cluster 文件：`cat /README > /fat/big` 后 `wc /fat/big` 显示 2473 字节。
- 小目录多文件：`/fat/d/a.c`、`/fat/d/b.c`、`/fat/d/c.c` 均可创建和列出。
- 长文件名拒绝：`echo bad > /fat/toolongname.c` 返回 open failed，符合当前短文件名设计边界。

验证结果：

- D4 fat32 边界测试：通过。
- ext2 `test1/test2` 回归：通过。
- `python3 test-xv6.py usertests -q`：`ALL TESTS PASSED`。

## 阶段 E：轻量 HAL 与 LoongArch64 启动

主要目标：

在不大幅重构 xv6 原有结构的前提下，引入足够薄的 HAL，使同一套 VFS 和文件系统代码可以同时运行在 RISC-V 与 LoongArch64 上。当前阶段优先打通 LoongArch64 启动、trap、进程切换、用户态 shell 和块设备访问路径。

主要改动：

- 新增 `ARCH=riscv/loongarch` 构建选项，默认仍为 RISC-V。
- 将中断初始化、外部中断 claim/complete 和块设备读写收敛到 `hal_*` 接口。
- RISC-V 平台保持原有 PLIC 与 virtio 块设备路径，继续读写宿主机 `fs.img`。
- 新增 `kernel/arch/loongarch/`，放置 LoongArch64 启动、trap、页表、上下文切换、中断控制器和链接脚本。
- LoongArch64 平台使用 APIC/EXTIOI 处理中断，初期使用链接进内核的 `fs.img` ramdisk 作为块设备后端。
- 调整 `bio.c`、`main.c`、`trap.c`、`proc.c`、`exec.c` 等少量公共路径，使平台差异集中到 HAL 和 `arch/loongarch` 目录中。
- 用户态 syscall stub 根据架构生成 RISC-V `ecall` 或 LoongArch64 `syscall` 指令。

阶段边界：

- 该阶段初期 LoongArch64 使用 ramdisk，文件写入只修改本次 QEMU 运行期间的内存镜像；该限制已在阶段 F 通过 virtio-pci 取消。
- LoongArch64 下的 virtio-pci 块设备驱动留到后续阶段 F 实现。
- LoongArch64 在该阶段完成启动 smoke test，完整 `usertests -q` 和指定 VFS 测试在阶段 G 补齐。
- HAL 只覆盖当前真正需要的平台差异，不引入复杂设备模型或过重抽象。

验证结果：

- `cd src && make ARCH=loongarch kernel/kernel`：通过。
- `cd src && make ARCH=loongarch CPUS=1 qemu`：可以启动到 shell。
- LoongArch64 shell 中执行 `ls`：可以列出 ramdisk 根目录内容。
- `make test_baseline && make run`：RISC-V baseline 回归 PASS。

## 阶段 F：LoongArch64 virtio-pci 块设备

主要目标：

让 LoongArch64 尽量复用 RISC-V 的 virtio 磁盘路径，避免 ramdisk 后端无法持久写回 `fs.img` 的限制。

主要改动：

- 新增 LoongArch64 下的 PCI ECAM 扫描和 BAR 映射逻辑，用于发现 QEMU virt 机器上的 virtio-blk-pci 设备。
- 复用公共 `virtio_disk.c` 队列和请求处理逻辑，RISC-V 使用 virtio-mmio，LoongArch64 使用 virtio-pci。
- 将 LoongArch64 QEMU 参数切换为 `-device virtio-blk-pci`，使磁盘访问落到宿主机 `fs.img`。
- 接入 `VIRTIO0_IRQ` 的 APIC/EXTIOI 路由和完成路径，使磁盘 I/O 使用中断唤醒而不是长期轮询。

验证结果：

- `cd src && make ARCH=loongarch kernel/kernel`：通过。
- `cd src && make ARCH=loongarch CPUS=1 qemu`：可以启动到 shell。
- LoongArch64 shell 中执行 `mount ext2 /mnt 2` 后，`test1/test2` 通过。

## 阶段 G：LoongArch64 回归测试修复

主要目标：

补齐 LoongArch64 在 xv6 原始 `usertests -q` 中暴露出的虚拟内存和 TLB refill 语义差异。

主要改动：

- 扩大 LoongArch64 用户虚拟地址范围，避免大地址 `sbrk` 测试撞到 trapframe 映射。
- 对齐 RISC-V lazy allocation 语义，使 `uvmunmap()`、`uvmcopy()` 和 `vmfault()` 能处理未实际分配的 lazy 页。
- 修正 LoongArch64 用户页权限，避免只读文本段被错误写入。
- 修复 `tlbrefill.S` 中页表目录项基址处理，从依赖 `addi.d -1` 改为清低 12 位，避免 lazy fault 补映射后仍反复异常。

验证结果：

- LoongArch64 `usertests -q`：`ALL TESTS PASSED`。
- LoongArch64 显式 `mount ext2 /mnt 2` 后，`test1/test2`：通过。
- RISC-V `usertests -q`：`ALL TESTS PASSED`。
- RISC-V 显式 `mount ext2 /mnt 2` 后，`test1/test2`：通过。

## 阶段 H：对接官方 VFS 测例与评测流程

主要目标：

使镜像内容、目录布局与评测流程逐字节对齐官方公开测例。

主要改动：

- 以官方原版替换 `test1.c/test2.c`，新增 `tests/cmds.sh`，`tests/hello.c` 与上游逐字节一致；上游版本锚定信息记录于 `tests/VFS_TESTS_PIN.txt`。
- mkfs 将 `test1/test2/hello/cmds.sh/hello.c` 置入根文件系统 `/tests` 目录，复现官方参考流程布局；新增 `user/hello.c`。
- 修复 exec 路径解析：不含 `/` 的裸命令名在当前目录查找失败时回退根目录查找。修复前在 `/tests` 下执行 `cat`/`ls`/`test1` 均 `exec failed`，官方流程 `cd tests; cat cmds.sh | sh` 无法运行。
- `tests/public_vfs` 改为复刻官方评测流程并断言官方输出串；`test_baseline` 结果日志增加架构后缀。

验证结果：

- RISC-V/LoongArch64 `usertests -q`：`ALL TESTS PASSED`。
- 官方流程双架构输出与上游参考输出逐字节一致。

## 阶段 I：挂载点保护

主要目标：

消除挂载语义上的两个稳定性缺陷。

主要改动：

- `sys_unlink` 及 `ext2_unlink`/`fat32_unlink` 增加挂载点检查：删除正被用作挂载点的目录返回失败。修复前 `rm /mnt` 可成功，挂载关系即刻失效，已挂载文件系统中的数据不可达（双架构实证）。
- `vfs_mount` 拒绝 fstype 为 xv6 的挂载请求：根文件系统启动时已挂载，再次挂载呈现损坏的目录视图。修复前 `mount xv6 /xv` 静默成功（双架构实证）。

验证结果：

- 双架构 error/ext2/fat32/semantics 测试点通过，无 panic。

## 阶段 J：inode 缓存一致性与 unlink 延迟释放

主要目标：

将 ext2/fat32 的 inode 生命周期语义对齐 xv6/POSIX。

主要改动：

- `ext2_iget`/`fat32_iget` 仅在缓存未命中（`valid==0`）时读盘填充。修复前每次 iget 无条件用磁盘数据重填内存 inode，会将未同步的内存状态（size/nlink/addrs）回退为磁盘旧值。
- unlink 只减 nlink，资源释放延迟至 `iput()` 的 `ref==1 && nlink==0` 分支，经 `itrunc` 钩子实现（ext2 释放数据块与 inode，fat32 释放整条簇链）。修复前 unlink 打开中的文件立即释放 inode，仍打开的 fd 读到已释放数据；修复后符合“unlink 后仍可读写、最后一次 close 时释放”的语义。
- ext2 块/inode 位图分配扫描上界钳位到 `s_blocks_count`/`s_inodes_count`，防止越界分配。
- 新增 `unlinkopen` 回归测试（ext2/fat32 双后端），并入 semantics 测试点。

验证结果：

- RISC-V/LoongArch64 `usertests -q`：`ALL TESTS PASSED`。
- 双架构 7 个测试点全部通过，`unlinkopen: ok`（ext2/fat32 各一）。

## 阶段 K：HAL 对称化与文件名完善

主要目标：

消除两平台中断路径的不对称，清理遗留死代码，并补齐 ext2 长文件名与 fat32 分配性能两个短板。

主要改动：

- LoongArch `trap.c` 改经 `hal_irq_claim`/`hal_irq_complete` 分发，中断控制器的电平/边沿与路由差异收敛进 `arch/loongarch/hal.c`，两端结构对称。
- 删除 LoongArch ramdisk 死代码（源文件、Makefile 规则与残留声明），`git grep` 全库零引用。
- ext2 目录列举对超过 14 字符的名字截断显示，查找时增加唯一前缀别名匹配（精确短名优先）；镜像注入长名夹具文件作为常驻回归。
- fat32 簇分配增加 next-free 提示（含回绕扫描与释放端下调），消除每次分配从簇 2 全表扫描。

验证结果：

- 双架构全量回归通过；LoongArch 冒烟（UART 输入、ext2 挂载读）正常。
- 长名文件可列、可 stat、可读取，修复前后对照实证。

## 阶段 L：ext2 双重间接块与大文件支持

主要目标：

解除 ext2 单文件 268KB 上限与对外部大文件镜像的拒读限制。

主要改动：

- `ext2_bmap` 增加两级查找分支（`ext2_bmap_double`），按需分配外层表/内层表/数据块；`ext2_itrunc` 对称释放；`ext2_sync_inode` 回写 `i_block[13]` 并将间接表计入 `i_blocks`。
- 内存 inode 地址槽位扩为 `NDIRECT+2`；`ext2_iget` 拒读条件收紧为仅三重间接。
- 修复 `ilock`/`iupdate` 与磁盘 dinode 拷贝的上界：以 `sizeof(dip->addrs)` 为准。修复前多拷 4 字节会覆写相邻 dinode 的 `type`，`fourfiles` 测试 panic。
- 新增 `bigfile` 用户程序（写入 1MiB 确定性模式并逐字节读回校验，含 keep/verify 模式）；镜像常驻注入 1MiB 外部文件以校验可读性。
- 测试 runner 增加 `--final-wait`，`test_baseline` 增加超时兜底（guest panic 时官方脚本阻塞读死等）。

验证结果：

- 双架构全量回归通过；完整版 `usertests`（不带 `-q`）双架构首次通过。
- `e2fsck -fn` 对含双间接文件的 ext2 镜像五阶段校验零错误。

## 阶段 M：fat32 长文件名（LFN）读支持

主要目标：

使宿主机写入 fat32 镜像的长名文件在系统内可见、可列、可读，写路径维持 8.3。

主要改动：

- 实现 LFN 链装配：解析 attr 0x0F 长名目录项，按序位重组倒序片段，UTF-16 窄化，校验和验证与断链保护。
- `fat32_lookup` 在 8.3 未命中时回退 LFN 扫描；匹配规则与 ext2 别名一致（14 字符内大小写不敏感精确匹配，更长名字走截断别名）。
- `fat32_readi` 目录列举显示装配长名（截断到 DIRSIZ），不再显示 8.3 残名。
- `mkfat32` 注入两个 LFN 夹具文件（16 字符双片段链与 13 字符混合大小写），并入 fat32 测试点三条访问路径（全名/小写/残名）。

验证结果：

- 双架构探针：长名显示、全名 cat、小写 cat、8.3 残名 cat 全部通过；fat32 套件含负断言（残名不得出现在 ls）。
- 完整 usertests 双架构保持通过，并固化为 `tests/full_usertests.sh` 推送门禁。

## 阶段 N：并发稳定性修复与压力测试

主要目标：

把多核并发下的后端正确性从静态推断变成实测证据，并修复暴露出的缺陷。

主要改动：

- 新增 `tests/smp` 测试点（CPUS=3，三路并发 `bigfile` + 写后校验 + 挂载点内 `stressfs`），runner 增加 `--cpus` 与提示符等待（输出静默+行尾 `$ ` 双判定）。
- 修复后端分配器 SMP 竞争（C1）：两个后端各加一把 sleeplock 包裹分配/释放路径。修复前 fat32 并发写确定性挂死，ext2 对照正常。
- 修复 fat32 链漫游 O(n²)：inode 空槽位缓存最近漫游位置，顺序访问降为 O(1)/块；同负载写 273→57 ticks、读 86→4 ticks。
- 修复 LoongArch 磁盘完成中断丢失：devintr 确认后循环重查 used 环，并在定时器路径挂 `virtio_disk_watchdog()` 看门狗兜底。该缺陷由完整版 usertests 的 `manywrites` 暴露，gdb 取证确认设备已投递完成而客户机未处理。
- 新增 `make verify-all` 一键复现双架构功能回归与完整 usertests；关键最终通过证据归档 `tests/evidence/`，fsck 与性能按独立命令复核。

验证结果：

- 修复后 SMP 测试点双架构通过；压测后 `e2fsck` 零错误。
- 推送门禁双项（16/16 回归 + 完整 usertests 双架构）全绿。

## 阶段 O：合规落地与性能测量

主要目标：

完成许可证与来源合规、基线完整性修复，并用可复现的测量数据支撑性能声明。

主要改动：

- 仓库根落地 BSD-2-Clause `LICENSE`；12 个自有源文件加单行 SPDX 注释头；`compliance.md` 定稿逐文件来源清单。
- 修复基线副本缺失 `mkfs/mkfs.c` 的问题（初赛导入时被 `.gitignore` 规则误伤漏交），与官方 rev5 tag（commit 7d7adbb）全量递归比对逐文件一致。
- 新增 `vfsbench` 基准程序：在本轮 P0 修复前采集了 RISC-V 的 VFS 分发开销、三后端吞吐和 fat32 两项优化前后历史对比；这些记录用于说明当阶段优化效果，不代表最终源码性能。LoongArch 吞吐因原记录误采为 RISC-V，待重新采集后再引用。
- 完成两个参照项目仓库取证，形成对比分析数据底稿。
- tests/ 目录规范化（双语四段式 README、覆盖矩阵、命名约定），docs/ 文档体系分层建设。

验证结果：

- 门禁双项全绿；修复前阶段性基准原始日志归档 `tests/evidence/bench-*.txt`。

## 阶段 P：VFS 并发发布与跨后端 exec 收口

主要目标：

修复冷 inode 首次加载、挂载初始化发布和 ELF 后端分发三个高风险缺口，同时保持用户系统调用接口及原生 xv6 行为不变。

主要改动：

- ext2/fat32 冷 inode 采用 acquire 快路径、`ip->lock` 内二次检查和 release 发布，防止多个 CPU 重复填充或观察到半初始化字段。
- `kexec()` 的 ELF 文件头、program header 与 `loadseg()` 段读取三处统一调用 `vfs_readi()`。
- 新增 mount 专用可睡眠 `mtable.oplock`，从路径解析到发布/失败清理串行化完整 `vfs_mount()`；后端磁盘 I/O 不占用短持有 spinlock。
- 挂载表采用 `MOUNT_FREE/MOUNTING/MOUNTED` 三态：成功发布 `MOUNTED`，失败回收为 `MOUNT_FREE`；`MOUNTING/MOUNTED` 均让 unlink 看见挂载点正在使用，只有 `MOUNTED` 可参与路径跳转。
- `mtable.lock` 收口为叶级短持有 spinlock，允许 `ip->lock → mtable.lock`，禁止持有它再进入 inode、后端或 buffer 路径。`oplock` 只串行挂载调用，反向祖先覆盖仍列为 P1 限制。

验证结果：

- 本轮双架构 8 个测试点全部通过：`run_all: PASS (16/16)`；两架构完整 usertests 均输出 `ALL TESTS PASSED`。
- error 测试在 CPUS=3 下发起 ext2/FAT32 后台/前台挂载请求，并覆盖根路径别名、同类型不同目录与跨类型同路径拒绝；每个架构应精确命中失败 7/7、两后端成功各 1/1，且 `ERROR_PATH_DONE` 正常到达。该测试验证串行后的最终互斥语义，不宣称确定性命中 `MOUNTING`。
- ext2/FAT32 中复制后的 ELF 可直接执行，双架构分别输出 `EXT2_EXEC_OK` 与 `FAT32_EXEC_OK`。

## 当前阶段总览

```mermaid
flowchart LR
    S0["阶段 0：建立基线"]
    SA["阶段 A：薄 VFS 骨架"]
    SB["阶段 B：挂载表与块设备接口"]
    SC["阶段 C：ext2 最小文件系统支持"]
    SD["阶段 D：fat32 文件系统支持"]
    SE["阶段 E：轻量 HAL 与 LoongArch64 启动"]
    SF["阶段 F：LoongArch64 virtio-pci 块设备"]
    SG["阶段 G：LoongArch64 回归测试修复"]
    SH["阶段 H：对接官方 VFS 测例"]
    SI["阶段 I：挂载点保护"]
    SJ["阶段 J：inode 缓存一致性与延迟释放"]
    SK["阶段 K：HAL 对称化与文件名完善"]
    SL["阶段 L：ext2 双重间接与大文件"]
    SM["阶段 M：fat32 LFN 读支持"]
    SN["阶段 N：并发稳定性与压力测试"]
    SO["阶段 O：合规落地与性能测量"]
    SP["阶段 P：VFS 并发发布与跨后端 exec"]

    S0 --> SA --> SB --> SC --> SD --> SE --> SF --> SG --> SH --> SI --> SJ --> SK --> SL --> SM --> SN --> SO --> SP
```

- 阶段 0：建立项目基线，保留原 xv6 测试能力。
- 阶段 A：接入薄 VFS 虚拟文件系统分发层，行为仍转发回 xv6 后端。
- 阶段 B：引入挂载表和块设备接口，使 `/mnt` 可切换到 ext2。
- 阶段 C：实现 ext2 最小文件系统支持，`test1/test2` 通过。
- 阶段 D：接入 fat32 镜像、设备映射和 BPB 识别，完成短文件名目录遍历与普通文件读写，并通过边界测试收口。
- 阶段 E：引入轻量 HAL，RISC-V 继续使用 PLIC/virtio，LoongArch64 使用 APIC/EXTIOI 与 ramdisk 启动到 shell。
- 阶段 F：LoongArch64 接入 virtio-pci，复用公共 virtio 磁盘路径并支持写回 `fs.img`。
- 阶段 G：修复 LoongArch64 虚拟内存和 TLB refill 问题，两架构均通过 `usertests -q` 和 `test1/test2`。
- 阶段 H：对接官方 VFS 测例，`/tests` 布局与官方评测流程逐字节对齐，修复 exec 裸命令名根目录回退。
- 阶段 I：挂载点删除保护与 xv6 根文件系统重复挂载拒绝。
- 阶段 J：ext2/fat32 inode 缓存一致性修复与 unlink 延迟释放，位图分配钳位，新增 unlinkopen 回归测试。
- 阶段 K：HAL 中断分发双平台对称，清理 ramdisk 死代码；ext2 长名截断显示与别名查找；fat32 簇分配 next-free 提示。
- 阶段 L：ext2 双重间接块支持（读/写/截断释放），修复 dinode 拷贝上界，新增 bigfile 大文件回归，完整 usertests 双架构首次通过。
- 阶段 M：fat32 LFN 读支持（链装配、别名匹配、目录列举），夹具注入与三条访问路径回归。
- 阶段 N：后端分配器 SMP 锁修复、fat32 链漫游缓存、LoongArch 中断看门狗；新增 smp 测试点与 verify-all、证据归档。
- 阶段 O：BSD-2-Clause 许可证与 SPDX 标注落地，基线副本补齐校验，vfsbench 性能测量，参照项目取证，tests/ 与 docs/ 体系规范化。
- 阶段 P：冷 inode 有序发布、mount 操作锁、挂载三态和锁外 spinlock 初始化、同类型后端互斥，并补齐 ext2/FAT32 ELF 的 VFS 读取与双架构回归证据。

## 收尾事项

- 演示视频录制（按 `docs/contest/video_script.md` 分镜）。
- 汇报幻灯片与现场答辩 PPT 定稿（分工页待团队提供）。
- 重新生成最终 diff 并复核 diff 统计（命令见 `docs/contest/baseline.md`）。
- 提交材料聚合至 `submit/` 并完成提交。
