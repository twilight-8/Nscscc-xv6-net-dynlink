# semantics

[中文](README.md) | [English](README.en.md)

## 目的

验证基础冒烟测试未覆盖的挂载与链接语义：挂载点 `..` 解析、ext2 硬链接、fat32 硬链接拒绝、unlink-while-open 的 POSIX 语义。

## 覆盖点

- 挂载根目录的 `..`：`/mnt/../parent.txt` 与 `/fat/../parent.txt` 必须解析回 xv6 根文件系统。
- ext2 同文件系统硬链接成功且内容一致；fat32 硬链接显式拒绝。
- `unlinkopen /mnt/uop.txt` 与 `unlinkopen /fat/uop.txt`：打开中的文件被 unlink 后仍可读写，最后一次 close 才释放（B2 回归守护，双后端）。

## 关键断言

- expect：`VFS_PARENT_OK`；硬链接文件内容；`link ... /fat/... failed`；`unlinkopen: ok`（×2）；`SEMANTICS_DONE`。
- reject：`panic:`、`kerneltrap`、`mount: failed`、`unlinkopen: FAIL`、ext2 链接失败串。

## 关联

- B2（unlink 延迟释放）；B3 挂载点保护的语义边界。
