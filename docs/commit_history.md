# 版本迭代记录

本文档记录项目中有代表性的阶段提交，方便后续整理最终 diff、答辩材料和开发回顾。

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
- 暂不支持 fat32 下的 `unlink/link/rename`。
- 暂不维护完整时间戳、权限和 FSInfo 空闲计数。

验证结果：

- fat32 手动功能测试：通过。
- ext2 `test1/test2` 回归：通过。
- `python3 test-xv6.py -q usertests`：`ALL TESTS PASSED`。
- `make test_baseline && make run`：PASS。
- `e2fsck -fn` 检查 ext2 镜像：无错误。

## 阶段 D4：fat32 精巧性与稳定性审查

主要目标：

在进入 HAL/LoongArch 之前，对 fat32 当前实现做一次收口，确认代码没有明显冗余，测试覆盖了最容易出问题的边界。

主要改动：

- 移除 `fat32_writei()` 中不必要的预读逻辑。底层 `block_write_bytes()` 已经能处理局部写入，所以这里可以直接 `copyin` 后写入，代码更短，磁盘访问也更少。
- 移除未使用的 FAT32 属性宏，保持 `fat32.c` 更干净。
- 保持 VFS 接口不变，没有为 fat32 额外增加新抽象。
- 明确 fat32 当前边界：只支持 8.3 短文件名，不支持长文件名、`unlink/link/rename` 和完整时间戳维护。

补充测试：

- 空文件创建：`cat /missing > /fat/empty` 后 `ls /fat` 显示 0 字节文件。
- 覆盖写：`echo old > /fat/s.c` 后再 `echo new > /fat/s.c`，读取结果为 `new`。
- 跨 cluster 文件：`cat /README > /fat/big` 后 `wc /fat/big` 显示 2473 字节。
- 小目录多文件：`/fat/d/a.c`、`/fat/d/b.c`、`/fat/d/c.c` 均可创建和列出。
- 长文件名拒绝：`echo bad > /fat/toolongname.c` 返回 open failed，符合当前短文件名设计边界。

验证结果：

- D4 fat32 边界测试：通过。
- ext2 `test1/test2` 回归：通过。
- `python3 test-xv6.py -q usertests`：`ALL TESTS PASSED`。

## 阶段 E：轻量 HAL 与 LoongArch64 启动

主要目标：

在不大幅重构 xv6 原有结构的前提下，引入足够薄的 HAL，使同一套 VFS 和文件系统代码可以同时运行在 RISC-V 与 LoongArch64 上。当前阶段优先打通 LoongArch64 启动、trap、进程切换、用户态 shell 和块设备访问路径。

主要改动：

- 新增 `ARCH=riscv/loongarch` 构建选项，默认仍为 RISC-V。
- 将中断初始化、外部中断 claim/complete 和块设备读写收敛到 `hal_*` 接口。
- RISC-V 平台保持原有 PLIC 与 virtio 块设备路径，继续读写宿主机 `fs.img`。
- 新增 `kernel/arch/loongarch/`，放置 LoongArch64 启动、trap、页表、上下文切换、中断控制器和链接脚本。
- LoongArch64 平台使用 APIC/EXTIOI 处理中断，使用链接进内核的 `fs.img` ramdisk 作为块设备后端。
- 调整 `bio.c`、`main.c`、`trap.c`、`proc.c`、`exec.c` 等少量公共路径，使平台差异集中到 HAL 和 `arch/loongarch` 目录中。
- 用户态 syscall stub 根据架构生成 RISC-V `ecall` 或 LoongArch64 `syscall` 指令。

阶段边界：

- LoongArch64 当前使用 ramdisk，文件写入只修改本次 QEMU 运行期间的内存镜像，不会回写宿主机 `fs.img`。
- 暂不实现 LoongArch64 下的 virtio/PCI 块设备驱动。
- LoongArch64 目前完成启动 smoke test，完整 `usertests -q` 和指定 VFS 测试仍需后续补充。
- HAL 只覆盖当前真正需要的平台差异，不引入复杂设备模型或过重抽象。

验证结果：

- `cd src && make ARCH=loongarch kernel/kernel`：通过。
- `cd src && make ARCH=loongarch CPUS=1 qemu`：可以启动到 shell。
- LoongArch64 shell 中执行 `ls`：可以列出 ramdisk 根目录内容。
- `make test_baseline && make run`：RISC-V baseline 回归 PASS。

## 当前阶段总览

```mermaid
flowchart LR
    S0["阶段 0：建立基线"]
    SA["阶段 A：薄 VFS 骨架"]
    SB["阶段 B：挂载表与块设备接口"]
    SC["阶段 C：ext2 最小文件系统支持"]
    SD["阶段 D：fat32 文件系统支持"]
    SE["阶段 E：轻量 HAL 与 LoongArch64 启动"]

    S0 --> SA --> SB --> SC --> SD --> SE
```

- 阶段 0：建立项目基线，保留原 xv6 测试能力。
- 阶段 A：接入薄 VFS 虚拟文件系统分发层，行为仍转发回 xv6 后端。
- 阶段 B：引入挂载表和块设备接口，使 `/mnt` 可切换到 ext2。
- 阶段 C：实现 ext2 最小文件系统支持，`test1/test2` 通过。
- 阶段 D：接入 fat32 镜像、设备映射和 BPB 识别，完成短文件名目录遍历与普通文件读写，并通过边界测试收口。
- 阶段 E：引入轻量 HAL，RISC-V 继续使用 PLIC/virtio，LoongArch64 使用 APIC/EXTIOI 与 ramdisk 启动到 shell。

## 后续提交方向

- `docs: finalize design demo and test report`
- `submit: generate final diff against xv6-riscv rev5`
