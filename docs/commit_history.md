# commit_history

> 该文件进行每次提交的迭代记录

### 第一次提交

构建基线目录结构、进行基础测试


### 第二次提交

主题：`vfs: introduce thin inode operation wrappers`

本次提交的主要工作是在不改变当前 xv6 行为的前提下，搭建一层薄 VFS 骨架，为后续 ext2、fat32 和 mount 机制预留接口。

目标结构：

```text
sys_open/sys_read/sys_write
        ↓
VFS 统一入口
        ↓
xv6fs backend / ext2 backend / fat32 backend
```

主要改动：

- 新增 `kernel/vfs.h`，定义 `fs_type`、`inode_ops`、`fs_ops`、`mount`。
- 新增 `kernel/vfs.c`，实现 `vfs_readi`、`vfs_writei`、`vfs_stati`、`vfs_itrunc`。
- 在 `struct inode` 中加入 `fstype`、`mnt`、`ops`、`fs_private` 字段。
- 在 `iget()` 中初始化 inode 的 VFS 字段，当前默认绑定 xv6 文件系统操作表。
- 将 `file.c` 中普通文件的 read/write/stat 路径切换到 VFS wrapper。
- 将 `sys_open()` 中的 `O_TRUNC` 切换到 `vfs_itrunc()`。
- 在 `main.c` 中加入 `vfsinit()`，为后续 mount table 初始化预留入口。
- 在 `Makefile` 中加入 `kernel/vfs.o`。

当前状态：

- 上层完成虚拟文件层分发
- 底层仍然转发到原 xv6 文件系统。
- 不引入 mount、ext2、fat32 逻辑。

测试结果：

- `make clean && make kernel/kernel`：通过。
- `python3 test-xv6.py usertests -q`：通过，结果为 `ALL TESTS PASSED`。

