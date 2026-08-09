# error

[中文](README.md) | [English](README.en.md)

## 目的

验证 VFS 非法操作路径的稳定性：错误输入必须干净地失败，不得造成 panic 或系统状态损坏。

## 覆盖点

- 挂载到不存在的目录（`mount ext2 /no_such_dir`）。
- 正常挂载 ext2 与 fat32 后，尝试跨文件系统硬链接（`ln /mnt/hello.c /fat/cross.txt`）。
- 删除不存在的文件（ext2 与 fat32 各一）。

## 关键断言

- expect：各错误路径的 `failed` 提示；`ERROR_PATH_DONE` 到达结尾（证明系统仍在正常运行）。
- reject：`panic:`、`kerneltrap`、`mount: failed`（合法挂载不得失败）。

## 关联

- 赛题“系统运行稳定”要求；B5（非法挂载拒绝）。
