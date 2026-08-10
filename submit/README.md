# submit

[中文](README.md) | [English](README.en.md)

本目录保存竞赛最终提交材料。各文档的权威版本维护在 `docs/` 与 `tests/`，本目录为交付快照。

## 内容

| 文件 | 说明 |
|---|---|
| `xv6-vfs-hal-final.diff` | 最终版本与 xv6-riscv rev5 基线之间的完整 diff（仅含源文件差异，已验证可干净套用回基线） |
| `xv6-vfs-hal-final.diff.stat` | 上述 diff 的统计摘要（60 个文件，+6242/−113） |
| `diff.md` | diff 生成方式、规模统计与 HAL/VFS/公共三分类拆分 |
| `test_report.md` | 测试报告（权威版本 `docs/contest/test_report.md`，原始日志见 `tests/evidence/`） |
| `commit_history.md` | 比赛过程中的重要进展，按阶段记录（权威版本 `docs/progress.md`） |
| `final_slides.pdf` / `final_slides.pptx` | 汇报幻灯片 |
| `演示视频.mp4` | 演示视频（脚本与分镜见 `docs/contest/video_script.md`） |

## 关联

- 项目说明：仓库根目录 `README.md`
- 设计与过程文档：`../docs/`（设计、计划、进展、学习笔记、赛事文档集）
- 测试体系与证据：`../tests/`
