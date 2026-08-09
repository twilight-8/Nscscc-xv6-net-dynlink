# 08 相关资料调研

本篇按用途分层记录本项目参考的全部资料，每条注明其在本项目中的作用。

## 1. 基础版本

| 资料 | 链接 | 用途 |
|---|---|---|
| MIT xv6-riscv rev5 | https://github.com/mit-pdos/xv6-riscv/releases/tag/xv6-riscv-rev5 | 项目基线（commit `7d7adbb`），diff 生成基准 |

## 2. 教学文档

| 资料 | 链接 | 用途 |
|---|---|---|
| xv6-riscv book | https://github.com/mit-pdos/xv6-riscv-book | 理解 xv6 总体结构与设计取舍 |

## 3. 体系结构规范

| 资料 | 链接 | 用途 |
|---|---|---|
| RISC-V specifications | https://riscv.org/technical/specifications/ | RISC-V 平台启动、页表与中断实现 |
| LoongArch Reference Manual | https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html | LoongArch64 移植（TLB refill、trap、EXTIOI 中断） |

## 4. 文件系统规范

| 资料 | 链接 | 用途 |
|---|---|---|
| The Second Extended File System (ext2-doc) | https://www.nongnu.org/ext2-doc/ext2.html | ext2 后端实现（superblock、组描述符、dinode、间接块、目录项） |
| Microsoft FAT Specification (fatgen103) | https://download.microsoft.com/download/1/6/1/161ba512-40e2-4cc9-843a-923143f3456c/fatgen103.doc | fat32 后端实现（BPB、FAT 链、8.3 目录项、LFN 长名） |

## 5. 官方测例

| 资料 | 链接 | 用途 |
|---|---|---|
| xv6-extend-vfs tests | https://github.com/yanjun-wen/xv6-extend-vfs/tree/main/tests | 赛题指定 VFS 测例；引入版本锚定见 `tests/VFS_TESTS_PIN.txt` |

## 6. 参照项目

| 资料 | 链接 | 用途 |
|---|---|---|
| xv6-loongarch-exp | https://github.com/SKT-CPUOS/xv6-loongarch-exp.git | LoongArch64 启动、trap、页表与中断代码参考；本项目按 rev5 基线与 VFS/HAL 结构裁剪适配 |
| 2025 年内核赛道参照项目（静春山） | https://gitlab.eduxiji.net/educg-group-36002-2710490/T202510558995330-264 | 对比分析取证（架构与测试组织对照） |
| 2025 年内核赛道参照项目（RuOK） | https://gitlab.eduxiji.net/educg-group-36002-2710490/T202510486995232-2402 | 对比分析取证（架构与测试组织对照） |

参照项目仅作对照阅读；本项目保持教学所需的轻量实现，未复制其代码。
