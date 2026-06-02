# xv6 VFS and HAL

本项目参加 2026 年全国大学生计算机系统能力大赛操作系统设计赛 OS 功能挑战赛道，赛题为 `proj34 xv6 虚拟文件系统和硬件抽象层的设计与实现`。

我们基于 MIT xv6-riscv rev5，在保持 xv6 小型教学操作的基础上，增加 VFS 和 HAL 功能，使系统支持 xv6、ext2、fat32 文件系统，并支持 RISC-V 与 LoongArch 平台。

## 当前阶段

当前处于 Commit 1(第一次提交)：基础状态与仓库结构设计。

本阶段不修改内核功能代码，只完成基础说明、合规说明和目录结构设计。

## 目标

- 支持 xv6、ext2、fat32 文件系统。
- 支持 RISC-V、LoongArch 平台。
- 通过 xv6-riscv rev5 自带测试。
- 完成赛题指定 VFS 测试。
- 提交最终版本相对 xv6-riscv rev5 的 diff 文件。

## 基础版本

- Base project: MIT xv6-riscv
- Base version: xv6-riscv rev5
- Source: https://github.com/mit-pdos/xv6-riscv/releases/tag/xv6-riscv-rev5
- Original license: MIT License
- Local source: `xv6-riscv_src/`

## 仓库结构

```text
.
├── README.md
├── .gitignore
├── docs/                     # 仓库的文档说明，对整体设计、测试结果、迭代记录等进行了简要说明
├── tests/                    # 源码详细测试记录
├── submit/                   # 竞赛提交辅助材料
└── xv6-riscv_src/            # 源码
```

## 文档

> 对 `docs/` 的目录结构进行介绍
 
- `docs/design.md`：整体设计说明。
- `docs/commit_history.md`：版本迭代记录与说明
- `docs/test_report.md`：测试记录的简要说明说明。
- `docs/compliance.md`：合规与来源说明。
- `docs/references.md`：参考资料。
- `docs/ai_usage.md`：AI 使用说明。

## 详细测试材料

> 对 `tests/` 目录结构进行介绍，该目录的详细结构见该目录内的 `README.md`

## 提交辅助材料

> 对 `submit` 目录结构进行介绍

## 许可证与合规性说明

原始 xv6 代码保留 MIT License。团队新增代码拟采用比赛认可的开源协议，当前计划为 BSD-2-Clause License。技术文档、PPT 和演示视频说明采用 CC-BY-SA 4.0。

详细说明见 `docs/compliance.md`。

## AI 使用声明

本项目在确保原创性的基础上使用 AI 工具进行了简单的需求分析和代码审查等工作，所有 AI 建议均由队员人工理解、修改、验证和测试后才予以采用。

AI 使用说明详见：`docs/ai_usage.md`