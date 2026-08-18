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
diff -ruN -d --strip-trailing-cr -B xv6-riscv-src src > submit/xv6-vfs-hal-final.diff
# 去除 ---/+++ 行的时间戳，保证重复生成结果逐字节一致、可复核
sed -i -E 's/^(---|\+\+\+) ([^\t]+)\t.*$/\1 \2/' submit/xv6-vfs-hal-final.diff
git apply --stat -p0 submit/xv6-vfs-hal-final.diff > submit/xv6-vfs-hal-final.diff.stat
sed -i -E 's/[[:space:]]+$//' submit/xv6-vfs-hal-final.diff.stat
```

`-d`（`--minimal`）输出最小变更集，`-B`（`--ignore-blank-lines`）忽略完全由空白行变化构成的 hunk。`-B` 不会删除新增文件或代码与空白混合 hunk 中的空白 `+/-` 行，因此标准补丁仍完整保留可回放的 unified diff 结构。

当前 Windows 检出会将基线 `mkfs/mkfs.c` 写成 CRLF；GNU `patch` 不会自动忽略该行尾差异。重放验证先规范这一文件，再应用补丁：

```sh
sed -i 's/\r$//' xv6-riscv-src/mkfs/mkfs.c  # 仅 CRLF 检出需要
patch --batch -p0 -i submit/xv6-vfs-hal-final.diff
diff -ruN -d --strip-trailing-cr xv6-riscv-src src
```

验证结果为 62 个文件全部应用成功，最后一条命令无输出。行数拆分与分类统计见 `submit/diff.md`。

## 非空白审计版

为单独展示不含纯空白新增/删除行的文本变更量，从标准补丁派生 `xv6-vfs-hal-final.nonblank.diff`。过滤时保留文件头、hunk 头、上下文和全部非空白变更行，只排除满足 `^[+-][[:space:]]*$` 的变更行：

```sh
awk '
BEGIN {
  print "NON-APPLICABLE NONBLANK DIFF REPORT"
  print ""
  print "This audit report is derived from xv6-vfs-hal-final.diff."
  print "It excludes added or deleted lines whose content is only whitespace."
  print "Counts: 62 files, 5602 insertions, 106 deletions, 5708 changed lines."
  print "Use xv6-vfs-hal-final.diff for patch replay."
  print "Do not pass this report to patch or git apply."
  print ""
}
/^(---|\+\+\+) / { print; next }
/^[+-][[:space:]]*$/ { next }
{ print }
' submit/xv6-vfs-hal-final.diff > submit/xv6-vfs-hal-final.nonblank.diff
```

过滤会使原 unified diff 的 hunk 长度失效，所以该文件只用于审计和答辩展示，不能交给 `patch` 或 `git apply`。`xv6-vfs-hal-final.nonblank.diff.stat` 按相同口径逐文件统计；“非空白文本变更”仍包含必要注释，不能表述为“纯代码行”。评委复现和源码恢复始终使用标准 `xv6-vfs-hal-final.diff`。

## 当前增量规模

- 标准可回放 diff：62 个文件，+6405/−113，共 6518 个新增/删除文本行；文件本身 7495 行（还包含文件头、hunk 头与上下文）。
- 非空白审计口径：+5602/−106，共 5708 行；相对标准统计排除 803 个空白新增行和 7 个空白删除行。
- 标准口径下，25 个 rev5 既有文件 +802/−113，37 个新增文件 +5603/−0。
- 对 rev5 原有文件的修改高度集中，增量主体是新增文件（ext2.c、fat32.c、vfs.c、`kernel/arch/loongarch/` 移植层等整文件计入）。
