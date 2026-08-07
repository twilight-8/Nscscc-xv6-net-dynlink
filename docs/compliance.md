# Compliance

> 本文件用于记录许可证、第三方来源和比赛合规信息。

## 基础版本

- Project: MIT xv6-riscv
- Version: xv6-riscv rev5
- Source: https://github.com/mit-pdos/xv6-riscv/releases/tag/xv6-riscv-rev5
- License: MIT License
- Local license: `src/LICENSE`

我们保留原始 xv6 的 MIT License。

## 新增代码许可证

本队新增代码采用 BSD-2-Clause License，全文见仓库根目录 `LICENSE`。自有新增源文件首行标注 `SPDX-License-Identifier: BSD-2-Clause`。

## 逐文件来源说明

| 文件/目录 | 来源 | 说明 |
|---|---|---|
| `src/kernel/vfs.c`、`vfs.h`、`ext2.c`、`fat32.c`、`block.c`、`block.h`、`hal.c` | 本队自有 | SPDX: BSD-2-Clause |
| `src/mkfs/mkfat32.c`、`src/user/mount.c`、`unlinkopen.c`、`bigfile.c`、`hello.c` | 本队自有 | SPDX: BSD-2-Clause |
| `src/kernel/arch/loongarch/` | 衍生自 xv6-loongarch-exp（xv6 系，MIT） | 移植参考后由本队大量修改（HAL 对称化、TLB refill、virtio-pci、中断看门狗等） |
| `src/user/test1.c`、`test2.c`、`src/tests/hello.c`、`src/tests/cmds.sh` | 官方测例仓库 [xv6-extend-vfs](https://github.com/yanjun-wen/xv6-extend-vfs)（GPL-3） | 逐字节引入，版本锚定见 `tests/VFS_TESTS_PIN.txt` |
| 其余 `src/` 文件 | MIT xv6-riscv rev5 | 见 `src/LICENSE` |

## 文档许可证

技术文档、PPT 和视频说明采用 CC-BY-SA 4.0。

## 第三方来源

当前来源记录：

| 来源 | 用途 | 是否复制代码 |
|---|---|---|
| MIT xv6-riscv rev5 | 基础系统 | 是 |
| xv6-riscv book | 学习 xv6 结构 | 否 |
| RISC-V specifications | 架构参考 | 否 |
| LoongArch Reference Manual | 架构参考 | 否 |
| xv6-loongarch-exp | 移植代码参考 | 是，后续有修改 |
| xv6-extend-vfs tests | 指定测试 | 后续复制测试文件 |



## AI 使用

本项目在保证项目原创性，符合竞赛规定的基础上合理使用了 AI

AI 使用说明详见 `docs/ai_usage.md`。
