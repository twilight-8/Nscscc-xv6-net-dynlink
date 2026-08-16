# 基线锚定

本文记录项目基线（xv6-riscv rev5）的版本锚定信息、校验方法与 diff 生成命令，保证“最终版与原版的差异”这一交付物可复现、可核查。

## 基线版本

- 项目：MIT xv6-riscv
- 版本：xv6-riscv rev5（官方 Release tag：`xv6-riscv-rev5`）
- 基线 commit：`7d7adbb1b0acbd67c9766a20d0f9900fef2789fa`
- 来源：https://github.com/mit-pdos/xv6-riscv/releases/tag/xv6-riscv-rev5
- 本地基线副本：`xv6-riscv-src/`（仓库内）

## 基线完整性校验

本地基线副本已于 2026-08-07 与官方 tag 浅克隆做全量递归比对：

```sh
git clone --depth 1 --branch xv6-riscv-rev5 \
  https://github.com/mit-pdos/xv6-riscv.git rev5-check
diff -r -q -x '.git*' xv6-riscv-src rev5-check     # 输出为空 = 逐文件一致
```

校验结果：逐文件完全一致。

## diff 生成命令

生成前先在 `src/` 执行 `make clean`，清除全部构建产物（目标文件、符号文件、镜像、编译期生成的汇编与用户态二进制），使 diff 只含源文件差异：

```sh
make -C src clean
diff -ruN -d --strip-trailing-cr xv6-riscv-src src > submit/xv6-vfs-hal-final.diff
# 去除 ---/+++ 行的时间戳，保证重复生成结果逐字节一致、可复核
sed -i -E 's/^(---|\+\+\+) ([^\t]+)\t.*$/\1 \2/' submit/xv6-vfs-hal-final.diff
git apply --stat -p0 submit/xv6-vfs-hal-final.diff > submit/xv6-vfs-hal-final.diff.stat
sed -i -E 's/[[:space:]]+$//' submit/xv6-vfs-hal-final.diff.stat
```

`-d`（`--minimal`）输出最小变更集。当前 Windows 检出会将基线 `mkfs/mkfs.c` 写成 CRLF；GNU `patch` 不会自动忽略该行尾差异。重放验证先规范这一文件，再应用补丁：

```sh
sed -i 's/\r$//' xv6-riscv-src/mkfs/mkfs.c  # 仅 CRLF 检出需要
patch --batch -p0 -i submit/xv6-vfs-hal-final.diff
diff -ruN -d --strip-trailing-cr xv6-riscv-src src
```

验证结果为 62 个文件全部应用成功，最后一条命令无输出。行数拆分与分类统计见 `submit/diff.md`。

## 当前增量规模

- 62 个文件，+6635/−119（diff 文件总行数 7741，含文件头与 hunk 头）。
- 其中 25 个 rev5 既有文件 +806/−119，37 个新增文件 +5829/−0。
- 对 rev5 原有文件的修改高度集中，增量主体是新增文件（ext2.c、fat32.c、vfs.c、`kernel/arch/loongarch/` 移植层等整文件计入）。
