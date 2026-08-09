# 07 调试案例集

本篇汇总本项目决赛阶段的调试案例。内核缺陷的完整“现象—根因—修复—复测”记录见 `../contest/lock_order.md` 与 `../contest/problems.md`；本篇侧重**调试方法与工程教训**，即这些缺陷是怎么被抓住的。

## 方法论案例

### M1. 让测试先红再绿

修复 SMP 竞争前，先构造能稳定复现的最小并发场景（三路并发 bigfile），确认修复前必挂、修复后必过——“红灯→绿灯”对照使修复的有效性可被第三方复核，而不是“改了好像能跑”。

### M2. 用 gdb stub 抓挂死现场

系统挂死且无输出时，用 `make qemu-gdb` + `gdb-multiarch` 抓取：进程表睡眠通道、virtio used 环两个索引的差值（设备已投递 2 项而客户机未处理）——两个数字直接钉死了“中断丢失”的结论，避免了盲猜。

### M3. 先证伪自己的工具，再怀疑内核

SMP 测试连续两轮“红灯”其实是测试驱动自身的 typed-ahead 截断（126B 输入恰好压在 UART 128B 缓冲边界）。因此，测试结论异常时，先验证测试设施本身的可靠性，再下“系统有 bug”的结论。

## 工程环境教训

1. **/tmp 会被系统定时清理**——临时文件一律放仓库内忽略目录（`plan/scratch/`）。
2. **强杀测试驱动会遗留 QEMU 持有镜像写锁**——后续会话报“Failed to get write lock”；收尾动作必须确认无残留 qemu 进程。
3. **官方测试脚本在 guest panic 时会阻塞读死等**——任何自动调用都要包一层超时兜底。
4. **基线副本也会被 .gitignore 误伤**——导入第三方源码后要逐文件校验完整性（见 `../contest/baseline.md`）。

## 缺陷清单索引

| 案例 | 文档位置 |
|---|---|
| exec 根目录回退（P1） | `../contest/problems.md` |
| iget 缓存覆盖（B1） | `../contest/lock_order.md` 案例 1 |
| unlink 延迟释放（B2） | `../contest/lock_order.md` 案例 2 |
| 挂载点删除 / 重复挂载（B3/B5） | `../contest/problems.md` P3 |
| dinode 拷贝越界（P4） | `../contest/lock_order.md` 案例 5 |
| 中断丢失与看门狗（P5） | `../contest/lock_order.md` 案例 4 |
| SMP 分配竞争（C1） | `../contest/lock_order.md` 案例 3 |
| fat32 O(n²) 链漫游（P7） | `../contest/problems.md` |
| runner 三处等待机制（P8） | `../contest/problems.md` |
| 基线缺失文件（P9） | `../contest/baseline.md` |
