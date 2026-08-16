# Diff 说明

本文档说明 `submit/xv6-vfs-hal-final.diff` 的生成方式、规模统计与分类拆分。

## 生成方式

diff 的两个对比侧：`xv6-riscv-src/`（与官方 `xv6-riscv-rev5` tag 逐文件一致的基线副本，锚定信息见 `docs/contest/baseline.md`）和 `src/`（作品源码）。生成前先在 `src/` 执行 `make clean`，清除全部构建产物（目标文件、符号文件、镜像、编译期生成的汇编与用户态二进制），使 diff 只含源文件差异：

```sh
make -C src clean
diff -ruN -d --strip-trailing-cr xv6-riscv-src src > submit/xv6-vfs-hal-final.diff
# 去除 ---/+++ 行的时间戳，保证重复生成结果逐字节一致、可复核
sed -i -E 's/^(---|\+\+\+) ([^\t]+)\t.*$/\1 \2/' submit/xv6-vfs-hal-final.diff
git apply --stat -p0 submit/xv6-vfs-hal-final.diff > submit/xv6-vfs-hal-final.diff.stat
sed -i -E 's/[[:space:]]+$//' submit/xv6-vfs-hal-final.diff.stat
```

其中 `-d`（`--minimal`）让 diff 输出最小变更集，`--strip-trailing-cr` 消除 Windows CRLF 与基线 LF 造成的伪差异。生成后已在一次性基线副本中做套用验证：先将 Windows 检出中带 CRLF 的 `mkfs/mkfs.c` 规范为 LF，再从目录名前缀后以 `patch -p1` 套用该 diff，62 个文件全部应用成功，所得源码树与 `src/` 在忽略行尾格式后逐文件一致：

```sh
replay=$(mktemp -d)
cp -a xv6-riscv-src/. "$replay"/
sed -i 's/\r$//' "$replay/mkfs/mkfs.c"  # 仅 CRLF 检出需要
patch --batch -p1 -d "$replay" -i "$PWD/submit/xv6-vfs-hal-final.diff"
diff -ruN -d --strip-trailing-cr "$replay" src
```

最后一条命令无输出即表示一致。保留这一步行尾规范化，可避免把未发生语义变化的整份 `mkfs.c` 误计入增量。

## 当前规模

```text
62 files changed, 6635 insertions(+), 119 deletions(-)
```

diff 文件总行数 7741 行（含文件头与 hunk 头），SHA-256 为 `9578692fc63468f27c322adc5af46d8a5561e47c2334d107ca99c686a0b95102`。对 rev5 原有文件的修改高度集中，增量主体是新增文件（ext2.c、fat32.c、vfs.c、`kernel/arch/loongarch/` 移植层等整文件计入）。

## 分类统计

按职责把 62 个文件拆成三类统计，仅用于分析，不改变最终完整 diff 文件：

| 分类 | 文件数 | 插入 | 删除 | diff 行数 | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| HAL / 平台支持 | 28 | 2340 | 37 | 2763 | `kernel/arch/loongarch/` 移植层、HAL 入口、virtio-pci 磁盘、看门狗与架构相关内存/中断改动 |
| VFS / 文件系统支持 | 31 | 4135 | 56 | 4662 | VFS 层、ext2、fat32、块设备抽象、mkfs/mkfat32 与用户态 mount/umount/测试程序 |
| 公共构建/配置 | 3 | 160 | 26 | 316 | `src/Makefile`、`src/.gitignore`、`src/test-xv6.py` 中同时服务 HAL 与 VFS 的公共调整 |

合计：62 个文件，+6635/−119，7741 行。
