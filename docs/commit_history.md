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

## 当前阶段总览

```mermaid
flowchart LR
    S0["阶段 0：建立基线"]
    SA["阶段 A：薄 VFS 骨架"]
    SB["阶段 B：挂载表与块设备接口"]
    SC["阶段 C：ext2 最小文件系统支持"]

    S0 --> SA --> SB --> SC
```

- 阶段 0：建立项目基线，保留原 xv6 测试能力。
- 阶段 A：接入薄 VFS 虚拟文件系统分发层，行为仍转发回 xv6 后端。
- 阶段 B：引入挂载表和块设备接口，使 `/mnt` 可切换到 ext2。
- 阶段 C：实现 ext2 最小文件系统支持，`test1/test2` 通过。

## 后续提交方向

- `fat32: add minimal backend for vfs tests`
- `hal: introduce architecture abstraction layer`
- `loongarch: bring up xv6 kernel on qemu-loongarch`
- `docs: finalize design demo and test report`
- `submit: generate final diff against xv6-riscv rev5`
