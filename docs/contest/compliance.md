# 合规与来源说明

本文件记录项目的许可证安排与全部第三方来源。

## 1. 基础版本

| 项目 | 内容 |
|---|---|
| 上游项目 | MIT xv6-riscv |
| 基线版本 | xv6-riscv rev5（commit `7d7adbb1b0acbd67c9766a20d0f9900fef2789fa`） |
| 上游许可证 | MIT License（见 `src/LICENSE`） |
| 上游来源 | https://github.com/mit-pdos/xv6-riscv/releases/tag/xv6-riscv-rev5 |

原始 xv6 代码的 MIT License 完整保留，未做任何去除或修改。

## 2. 新增代码许可证

本队新增代码采用 **BSD-2-Clause License**（全文见仓库根目录 `LICENSE`）。

- 自有新增源文件首行统一标注 `SPDX-License-Identifier: BSD-2-Clause`；
- 技术文档、汇报幻灯片与演示视频说明采用 CC-BY-SA 4.0。

## 3. 逐文件来源清单

| 文件/目录 | 来源 | 说明 |
|---|---|---|
| `src/kernel/vfs.c`、`vfs.h`、`ext2.c`、`fat32.c`、`block.c`、`block.h`、`hal.c` | 本队自有 | SPDX: BSD-2-Clause |
| `src/mkfs/mkfat32.c`、`src/user/mount.c`、`unlinkopen.c`、`bigfile.c`、`vfsbench.c`、`hello.c` | 本队自有 | SPDX: BSD-2-Clause |
| `src/kernel/arch/loongarch/` | 衍生自 xv6-loongarch-exp（xv6 系，MIT） | 移植参考后由本队大量修改：HAL 对称化、TLB refill 修复、virtio-pci 接入、中断看门狗等 |
| `src/user/test1.c`、`test2.c`、`src/tests/hello.c`、`src/tests/cmds.sh` | 官方测例仓库 xv6-extend-vfs（GPL-3） | 逐字节引入；版本锚定见 `tests/VFS_TESTS_PIN.txt`（commit `21a6ac68`） |
| 其余 `src/` 文件 | MIT xv6-riscv rev5 | 保留原许可证，见 `src/LICENSE` |

## 4. 第三方来源总表

| 来源 | 用途 | 是否复制代码 |
|---|---|---|
| MIT xv6-riscv rev5 | 基础系统 | 是 |
| xv6-riscv book | 学习 xv6 结构 | 否 |
| RISC-V specifications | 架构参考 | 否 |
| LoongArch Reference Manual | 架构参考 | 否 |
| xv6-loongarch-exp | LoongArch 移植参考 | 是，后续有修改 |
| xv6-extend-vfs tests | 赛题指定测例 | 是，逐字节引入 |
| 2025 年内核赛道参照项目（静春山、RuOK） | 对比分析取证 | 否（仅阅读取证） |

## 5. AI 使用

本项目在保证原创性、符合竞赛规定的基础上合理使用 AI 工具。使用方式与质量保障机制详见 `ai_usage.md`。
