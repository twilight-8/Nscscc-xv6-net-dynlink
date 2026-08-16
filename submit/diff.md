# Diff 说明

本文档说明标准可回放补丁 `submit/xv6-vfs-hal-final.diff`、非空白审计版 `submit/xv6-vfs-hal-final.nonblank.diff` 的生成方式、规模统计与分类拆分。

## 生成方式

diff 的两个对比侧：`xv6-riscv-src/`（与官方 `xv6-riscv-rev5` tag 逐文件一致的基线副本，锚定信息见 `docs/contest/baseline.md`）和 `src/`（作品源码）。生成前先在 `src/` 执行 `make clean`，清除全部构建产物（目标文件、符号文件、镜像、编译期生成的汇编与用户态二进制），使 diff 只含源文件差异：

```sh
make -C src clean
diff -ruN -d --strip-trailing-cr -B xv6-riscv-src src > submit/xv6-vfs-hal-final.diff
# 去除 ---/+++ 行的时间戳，保证重复生成结果逐字节一致、可复核
sed -i -E 's/^(---|\+\+\+) ([^\t]+)\t.*$/\1 \2/' submit/xv6-vfs-hal-final.diff
git apply --stat -p0 submit/xv6-vfs-hal-final.diff > submit/xv6-vfs-hal-final.diff.stat
sed -i -E 's/[[:space:]]+$//' submit/xv6-vfs-hal-final.diff.stat
```

其中 `-d`（`--minimal`）让 diff 输出最小变更集，`-B`（`--ignore-blank-lines`）忽略完全由空白行变化构成的 hunk，`--strip-trailing-cr` 消除 Windows CRLF 与基线 LF 造成的伪差异。`-B` 不会去掉新增文件或代码与空白混合 hunk 中的空白变更行。生成后已在一次性基线副本中做套用验证：先将 Windows 检出中带 CRLF 的 `mkfs/mkfs.c` 规范为 LF，再从目录名前缀后以 `patch -p1` 套用该 diff，62 个文件全部应用成功，所得源码树与 `src/` 在忽略行尾格式后逐文件一致：

```sh
replay=$(mktemp -d)
cp -a xv6-riscv-src/. "$replay"/
sed -i 's/\r$//' "$replay/mkfs/mkfs.c"  # 仅 CRLF 检出需要
patch --batch -p1 -d "$replay" -i "$PWD/submit/xv6-vfs-hal-final.diff"
diff -ruN -d --strip-trailing-cr "$replay" src
```

最后一条命令无输出即表示一致。保留这一步行尾规范化，可避免把未发生语义变化的整份 `mkfs.c` 误计入增量。

## 非空白审计版

`xv6-vfs-hal-final.nonblank.diff` 从标准补丁派生，只过滤满足 `^[+-][[:space:]]*$` 的纯空白新增/删除行，并保留文件头、hunk 头、上下文及全部非空白变更。标准补丁中被过滤的是 803 个空白新增行和 7 个空白删除行。

过滤后 unified diff 的 hunk 长度不再有效，因此文件首部明确标记 `NON-APPLICABLE NONBLANK DIFF REPORT`。它只用于改动量审计和答辩展示，不能作为补丁套用；源码回放必须使用标准 `xv6-vfs-hal-final.diff`。此外，5708 行是“非空白文本变更”，其中仍包含必要注释，不能表述为“纯代码行”。完整生成命令见 `docs/contest/baseline.md`。

## 当前规模

```text
standard replayable diff: 62 files, 6405 insertions(+), 113 deletions(-)
nonblank audit view:      62 files, 5602 insertions(+), 106 deletions(-)
nonblank changed lines:   5708
```

标准 diff 文件共 7495 行（含文件头、hunk 头与上下文），SHA-256 为 `3c9d7e757ea4c0823a3fe2a85987db421e504ffce90d4c81b783af9bb3165075`。非空白审计版共 6693 行，SHA-256 为 `37f1a5b2ebabfb96fdc3b0051425ba51776bc14746fc9666f6ec51e22fc39bf0`。标准口径下，37 个新增文件贡献 +5603 行，25 个 rev5 既有文件为 +802/−113；非空白口径分别为 +4877 和 +725/−106。

## 分类统计

按职责把 62 个文件拆成三类统计，仅用于分析，不改变最终完整 diff 文件：

| 分类 | 文件数 | 标准插入 | 标准删除 | 非空白插入 | 非空白删除 | 说明 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| HAL / 平台支持 | 28 | 2143 | 37 | 1857 | 36 | `kernel/arch/loongarch/` 移植层、HAL 入口、virtio-pci 磁盘、看门狗与架构相关内存/中断改动 |
| VFS / 文件系统支持 | 31 | 4106 | 53 | 3603 | 47 | VFS 层、ext2、fat32、块设备抽象、mkfs/mkfat32 与用户态 mount/umount/测试程序 |
| 公共构建/配置 | 3 | 156 | 23 | 142 | 23 | `src/Makefile`、`src/.gitignore`、`src/test-xv6.py` 中同时服务 HAL 与 VFS 的公共调整 |

合计：标准口径 +6405/−113；非空白口径 +5602/−106，共 5708 行。
