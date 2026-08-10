# Diff 说明

本文档说明 `submit/xv6-vfs-hal-final.diff` 的生成方式、规模统计与分类拆分。

## 生成方式

diff 的两个对比侧：`xv6-riscv-src/`（与官方 `xv6-riscv-rev5` tag 逐文件一致的基线副本，锚定信息见 `docs/contest/baseline.md`）和 `src/`（作品源码）。生成前先在 `src/` 执行 `make clean`，清除全部构建产物（目标文件、符号文件、镜像、编译期生成的汇编与用户态二进制），使 diff 只含源文件差异：

```sh
make -C src clean
diff -ruN -d xv6-riscv-src src > submit/xv6-vfs-hal-final.diff
# 去除 ---/+++ 行的时间戳，保证重复生成结果逐字节一致、可复核
sed -i -E 's/^(---|\+\+\+) ([^\t]+)\t.*$/\1 \2/' submit/xv6-vfs-hal-final.diff
git apply --stat -p0 submit/xv6-vfs-hal-final.diff > submit/xv6-vfs-hal-final.diff.stat
```

其中 `-d`（`--minimal`）让 diff 输出最小变更集。生成后已做套用验证：在基线副本上以 `patch -p0` 套用该 diff，得到的源码树与 `src/` 逐文件一致。

## 当前规模

```text
60 files changed, 6242 insertions(+), 113 deletions(-)
```

diff 文件总行数 7307 行（含文件头与 hunk 头）。对 rev5 原有文件的修改高度集中，增量主体是新增文件（ext2.c、fat32.c、vfs.c、`kernel/arch/loongarch/` 移植层等整文件计入）。

## 分类统计

按职责把 60 个文件拆成三类统计，仅用于分析，不改变最终完整 diff 文件：

| 分类 | 文件数 | 插入 | 删除 | diff 行数 | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| HAL / 平台支持 | 28 | 2361 | 37 | 2795 | `kernel/arch/loongarch/` 移植层、HAL 入口、virtio-pci 磁盘、看门狗与架构相关内存/中断改动 |
| VFS / 文件系统支持 | 29 | 3723 | 50 | 4198 | VFS 层、ext2、fat32、块设备抽象、mkfs/mkfat32 与用户态 mount/测试程序 |
| 公共构建/配置 | 3 | 158 | 26 | 314 | `src/Makefile`、`src/.gitignore`、`src/test-xv6.py` 中同时服务 HAL 与 VFS 的公共调整 |

合计：60 个文件，+6242/−113，7307 行。
