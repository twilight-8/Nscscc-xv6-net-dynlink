# Design

> 该文件为本项目的设计文档

## 一、VFS 虚拟文件层统一接口

本阶段采用 inode-based 的薄 VFS 设计。目标不是重写 xv6 文件系统，而是在原有 inode 路径上增加一层很小的分发接口，使后续 ext2 和 fat32 可以接入同一套上层文件接口。

当前读写路径为：

```text
sys_read/sys_write/sys_fstat/sys_open
        ↓
file.c/sysfile.c
        ↓
vfs_readi/vfs_writei/vfs_stati/vfs_itrunc
        ↓
ip->ops
        ↓
xv6 readi/writei/stati/itrunc
```

### 1. 核心结构

- `enum fs_type`：标记 inode 或 mount 属于 `FS_XV6`、`FS_EXT2`、`FS_FAT32`。
- `struct inode_ops`：描述单个 inode 的基本操作，包括 read、write、stat、trunc。
- `struct fs_ops`：描述文件系统级操作，当前只预留 root，用于后续 mount。
- `struct mount`：描述一次挂载实例，记录文件系统类型、设备号、根 inode 和操作表。

### 2. inode 扩展

在 `struct inode` 中新增：

```c
enum fs_type fstype;
struct mount *mnt;
struct inode_ops *ops;
void *fs_private;
```

其中 `ops` 是当前阶段最关键的字段。xv6 inode 在 `iget()` 中默认绑定 `xv6_inode_ops`，所以 VFS wrapper 目前仍然转发到原 xv6 文件系统函数。

### 3. 当前边界

本阶段只接入普通文件的 read/write/stat/trunc 路径，不修改路径解析和目录操作。`namei`、`dirlookup`、`dirlink`、`bio.c`、`log.c` 暂时保持原状。

这样做的原因是先保证 xv6 原有行为稳定，再在下一阶段引入 mount table 和 block layer。

