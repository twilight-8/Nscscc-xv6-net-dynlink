# 测试覆盖矩阵

8 个测试点 × 双架构的覆盖总览。每项均可在 `tests/evidence/` 找到最终通过证据；执行入口见 `tests/README.md`。

| 测试点 | 覆盖功能面 | 关联需求/缺陷 | RISC-V | LoongArch |
|---|---|---|---|---|
| test_baseline | rev5 自带 usertests（-q 快速版） | 赛题任务 3 | PASS | PASS |
| public_vfs | 官方评测流程、/tests 布局、四向跨盘复制 | 赛题任务 4 | PASS | PASS |
| ext2 | 挂载/读写/覆盖/删除/嵌套目录/长名别名/1MiB 双间接/外部大文件 | 任务 1；D1、D2、D3 | PASS | PASS |
| fat32 | 挂载/8.3 增删改/空文件/嵌套目录/LFN 三路径 | 任务 1；D4 | PASS | PASS |
| error | 非法挂载/CPUS=3 mount 操作锁最终互斥/跨盘硬链接/删不存在文件 | 稳定性；B5；挂载发布边界 | PASS | PASS |
| semantics | 跨后端 ELF、挂载点 `..`、硬链接、unlinkopen、umount busy/成功/重挂载 | exec VFS 分发；B2、B3；卸载生命周期 | PASS | PASS |
| persist | 写→重启→读回（含 1MiB 双间接跨启动校验） | 持久性；D1 | PASS | PASS |
| smp | CPUS=3 三路并发写 + 校验 + stressfs + lookup/mount/umount 竞态 | 稳定性；C1；卸载并发 | PASS | PASS |

补充验证（非测试点）：

- 完整版 usertests：在快速版之外增加 6 项慢测试和内存泄漏检查，双架构均输出 `ALL TESTS PASSED`；它是 `verify-all` 的额外门禁，不计入上述 8 × 2 项回归。
- `e2fsck -fn` 对 ext2 镜像五阶段离线校验：零错误（含 SMP 压测后状态）。
- vfsbench 基准：VFS 开销、三后端吞吐、fat32 优化前后对比，数据见`tests/evidence/bench-*.txt`。
