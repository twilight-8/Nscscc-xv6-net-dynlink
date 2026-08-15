# submit

[中文](README.md) | [English](README.en.md)

本目录保存竞赛最终提交材料。各文档的权威版本维护在 `docs/` 与 `tests/`，本目录为交付快照。

## 内容

| 文件 | 说明 |
|---|---|
| `xv6-vfs-hal-final.diff` | 最终版本与 xv6-riscv rev5 基线之间的完整 diff（仅含源文件差异，已验证可干净套用回基线） |
| `xv6-vfs-hal-final.diff.stat` | 上述 diff 的统计摘要（62 个文件，+6612/−119） |
| `diff.md` | diff 生成方式、规模统计与 HAL/VFS/公共三分类拆分 |
| `test_report.md` | 测试报告（权威版本 `docs/contest/test_report.md`，原始日志见 `tests/evidence/`） |
| `commit_history.md` | 比赛过程中的重要进展，按阶段记录（权威版本 `docs/progress.md`） |
| `final_slides.pdf` / `final_slides.pptx` | 2026-06-30 旧进展汇报，仅作历史材料；不是决赛最终答辩稿，提交前必须替换 |
| `演示视频.mp4` | 演示视频（脚本与分镜见 `docs/contest/video_script.md`） |

## 最终验证

- 双架构 8 个测试点全部通过：`run_all: PASS (16/16)`；RISC-V 与 LoongArch 完整 usertests 均输出 `ALL TESTS PASSED`。
- error 测试在 CPUS=3 下对 ext2/FAT32 发起后台/前台挂载请求，并验证两个根路径别名、同类型不同目录与跨类型同路径拒绝；每个架构应精确得到失败 7/7、两后端成功各 1/1。`mtable.oplock` 串行化完整 `mount/umount`，四态负责发布、失败回滚、unlink 可见性与卸载隔离。
- 复制到 ext2/FAT32 的 ELF 均可直接执行并分别输出 `EXT2_EXEC_OK`、`FAT32_EXEC_OK`。修复后双架构回归通过；冷 inode 首访与 `MOUNTING` 发布协议由锁序/内存序审查保证，现有测试不宣称确定性命中这两个窗口。
- `umount` 对打开文件、挂载内 cwd、在途路径引用和子挂载统一返回 busy；成功卸载后恢复下层 xv6 目录，并支持 ext2/FAT32 再挂载。semantics 与 CPUS=3 `umountstress` 已在双架构通过。
- 当前不提供强制/延迟卸载和完整挂载拓扑管理：顺序执行“先挂 `/a/b`、再挂 `/a`”仍可能遮蔽前一挂载，该反向祖先覆盖列为 P1 限制。

## 关联

- 项目说明：仓库根目录 `README.md`
- 设计与过程文档：`../docs/`（设计、计划、进展、学习笔记、赛事文档集）
- 测试体系与证据：`../tests/`
