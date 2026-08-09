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

```sh
diff -ruN \
  -x '*.o' -x '*.d' -x '*.sym' -x '*.asm' -x '*.img' \
  -x 'usys.S' -x '_*' -x 'test1' -x 'test2' -x 'hello' \
  -x '.arch-*' -x '.gdbinit' -x 'TAGS' \
  xv6-riscv-src src > submit/xv6-vfs-hal-final.diff
```

排除项均为构建产物或构建期生成的符号链接。统计口径可用`grep -c '^+' / '^-'` 或 `diffstat` 获得。

## 当前增量规模

- 约 +6.4k 行 / −0.2k 行，约 60 个文件（含新增文件整体计入）。
- 对 rev5 原有文件的修改高度集中（约 130 行净增），其余为新增文件。
