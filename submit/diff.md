# Diff说明

本文档说明 `submit/xv6-vfs-hal-final.diff` 的生成方式和行数拆分。

## 完整diff

完整diff对比初始 `xv6-riscv rev5` 源码副本和当前项目源码：

```sh
git diff --no-index --minimal --find-renames ./xv6-riscv-src ./src > submit/xv6-vfs-hal-final.diff
git diff --no-index --minimal --find-renames --stat ./xv6-riscv-src ./src > submit/xv6-vfs-hal-final.diff.stat
```

当前统计：

```text
submit/xv6-vfs-hal-final.diff       6699 lines
submit/xv6-vfs-hal-final.diff.stat    57 lines
56 files changed, 5653 insertions(+), 103 deletions(-)
```

## 分类统计

为了便于说明代码变化规模，可以按职责把完整diff拆成三类统计。该拆分仅用于分析，不改变最终完整diff文件。

| 分类 | diff行数 | 文件数 | 插入 | 删除 | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| HAL / 平台支持 | 2609 | 25 | 2274 | 31 | LoongArch64架构目录、HAL入口、virtio-pci磁盘、架构相关内存和中断改动 |
| VFS / 文件系统支持 | 3805 | 29 | 3241 | 47 | VFS层、ext2、fat32、块设备抽象、mkfs和用户态mount/测试程序 |
| 公共构建/配置 | 285 | 2 | 138 | 25 | `src/Makefile` 和 `src/.gitignore` 中同时服务HAL与VFS的公共调整 |

合计：

```text
6699 lines
56 files changed, 5653 insertions(+), 103 deletions(-)
```
