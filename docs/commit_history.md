# commit_history

> 该文件进行每次提交的迭代记录

### 第一次提交

构建基线目录结构、进行基础测试


### 第二次提交

> 本次提交的主要工作是**在不改变当前xv6行为的前提下，提前留好未来需要支持的多个文件系统的接口**，即搭建 VFS 骨架

我们要实现这样文件系统层次结构

```text
sys_open/sys_read/sys_write
        ↓
VFS 统一入口
        ↓
xv6fs backend / ext2 backend / fat32 backend
```

本阶段的任务就是完成 VFS 统一接口部分，

