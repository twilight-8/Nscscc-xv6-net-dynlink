# 决赛备赛计划书

- 项目：xv6-riscv VFS + HAL（proj34）
- 制定日期：2026-08-04
- 提交截止：2026-08-12
- 本文档基于对项目代码、文档、测试体系、上游测试仓库的完整审查，以及对同类教学实现方案的调研制定。内容包括：问题清单、提交物要求映射、逐日任务安排、风险管理与提交核对清单。

---

## 1. 赛题要求与评分结构

### 1.1 硬性任务

|   | 任务 | 现状 |
|---|------|------|
| 1 | 同时支持 xv6、ext2、fat32 文件系统 | 已实现，深度存在短板（见 §3.4） |
| 2 | 同时支持 RISC-V 和 LoongArch 平台 | 已实现（约 2000 行 arch 代码的完整移植） |
| 3 | 两平台通过 xv6-riscv 第 5 版自带测例 | 双架构完整 `usertests` 均输出 `ALL TESTS PASSED`，证据已归档 |
| 4 | 通过指定 VFS 测试用例（yanjun-wen/xv6-extend-vfs） | 官方测例已按锚定版本原样入库，双架构回归通过 |
| 5 | 提交与原版 rev5 的 diff 文件 | 已在最终代码上重新生成：62 个文件，+6405/−113（见 `submit/diff.md`） |

### 1.2 评审维度（各占 20%）

设计精巧度、功能实现完成度、运行稳定性、文档质量和完整性、Demo 质量。

### 1.3 提交物要求（“功能挑战”赛道）

1. 完整的设计方案等开发文档、项目源代码、项目测试结果的功能/性能/创新性分析（包括与类似项目的对比分析）；
2. 作品进展汇报幻灯片，内容包括参赛队员分工、项目开发时间进度安排及相应任务的推进与完成情况；
3. 作品演示视频，内容包括项目源代码运行环境介绍、符合项目任务要求的运行演示效果及结果说明；
4. 现场答辩展示 PPT；
5. 开发文档内容须包括：项目研发的设计思路、实现描述、代码说明、研发过程中遇到的问题和解决方法、本队作品源码和文档中的非本队来源说明。

---

## 2. 现状总体评估

项目整体完成度较高：三种文件系统真实并存，LoongArch 为完整移植，diff 规模克制，文档体系基本完整。制定本计划时，审查发现的工作集中在四个方面：

- 合规性：任务 3、4 的证据链不完整；评审验收体验（测例布局、手动挂载流程、版本锚定）未对齐官方参考流程；
- 正确性：ext2/fat32 后端存在 2 个高严重度的并发与语义缺陷，可导致数据损坏；
- 功能深度：ext2 单文件上限约 268KB、fat32 不支持长文件名读取，为功能完成度的主要缺口；
- 提交物完整性：需求跟踪矩阵、性能量化、创新性分析、对比分析、演示脚本等文档承接物缺失。

工作总原则：每一个评审得分点都应有对应的、可核查的承接物——功能点有代码，稳定性有日志，设计有文档，过程有记录，演示有脚本。

---

## 3. 问题清单

问题按类别组织，每项注明严重度（高/中/低）、位置与修复方法。

### 3.1 A 类：赛题合规性问题（优先级 P0）

**A1. 官方外部测例未原样运行**（严重度：高，已于 Day 1 修复）
- 现状：`src/user/test1.c`、`test2.c` 为自行重写版（输出 `test1: succeed`），官方原版输出为 `test_copy_file(...): succeed` 及中文提示；`docs/contest/compliance.md:17` 自述“后续复制测试文件”；`docs/contest/test_report.md` 未声明 test1/test2 是重写版。
- 已核实：官方 `test1.c/test2.c/cmds.sh/hello.c` 仅使用标准 xv6 系统调用（open/read/write/close/printf），涉及路径 `/hello.c`、`/tests/hello.c`、`/mnt/hello.c` 在本地镜像中均已具备，可原样编译并通过，内核层面无障碍；仅需同步测试断言字符串。官方流程为启动后手动 `mount ext2 /mnt` 再执行测试。
- 修复方法：官方 4 个文件原样入库并加入 UPROGS（替换现有重写版），双架构原样跑通，test_report 增设官方测例映射表。

**A2. 自带测例仅执行快速版**（严重度：高，已于 Day 3 修复并固化为推送门禁）
- 现状：`tests/test_baseline/run.sh` 执行 `usertests -q`，完整版（`bigfile`、`bigdir`、`fourteen` 等慢速用例）在两个架构上均无通过记录。
- 修复方法：双架构执行完整 `usertests`，结果写入测试报告。

**A3. 测试证据不可复现**（严重度：高，已于 Day 5 修复）
- 现状：所有 `*.log` 被 gitignore，历史日志已删除；`tests/*/logs/` 仅有占位 README；根 Makefile 无一键全量测试目标。
- 修复方法：新增 `make verify-all`（双架构 × 7 测试点共 14 组串行执行并输出汇总表）；14 份代表性日志与双架构全量启动测试输出（`riscv_test_output.txt`、`loongarch_test_output.txt`）提交入库。

**A4. 评审验收体验未对齐官方参考流程**（严重度：中，已于 Day 1 修复）
- 现状：测试二进制位于镜像根目录（`_test1`），评审须自行查阅文档才能操作；启动后须手动挂载 ext2。
- 修复方法：镜像 `/tests` 目录内置官方 test1/test2 二进制与 cmds.sh、hello.c，保留官方要求的手动 `mount ext2 /mnt`，随后支持 `cd /tests; cat cmds.sh | sh` 原流程。

**A5. 官方测例无版本锚定**（严重度：低，已于 Day 1 修复）
- 背景：官方测试仓库声明“测例建设中，会动态扩充”，且经核实上游测例内容已发生过变动。
- 修复方法：新增 `tests/VFS_TESTS_PIN.txt`，填写完整的 repository_url、pinned_commit、pinned_date，锁定开发、测试、提交的统一测例基准。

### 3.2 B 类：内核正确性缺陷（优先级 P0，可导致数据损坏）

**B1. inode 缓存被陈旧磁盘数据覆盖**（严重度：高，已于 Day 1 修复）
- 位置：`src/kernel/ext2.c:231-233`、`src/kernel/fat32.c:377-379`。
- 问题：`ext2_iget`/`fat32_iget` 在 `iget()` 命中缓存后无条件用磁盘 dinode 重填内存 inode。xv6 为可抢占内核，CPUS=1 时同样可触发：进程 A 写文件中途（内存 `addrs/size` 已更新、尚未回写），进程 B 的一次 lookup 即以磁盘旧值覆盖内存状态，造成数据丢失与块泄漏。原版 xv6 仅在 `ip->valid == 0` 时填充。
- 修复方法：仅在 `valid == 0` 时填充（持 `ip->lock` 判断）。

**B2. 打开中的文件被 unlink 后 inode 复活**（严重度：高，已于 Day 1 修复）
- 位置：`src/kernel/ext2.c:784-789`；`fs.c:347-356` 对非 xv6 文件系统不做延迟释放。
- 问题：`ext2_unlink` 无视 `ref>1` 立即清除 inode 位图并清零磁盘 dinode；仍持有该文件描述符的进程继续写入时，`ext2_sync_inode` 将非零 mode 写回已释放的 dinode，而位图位已清除、原数据块可能已分配给其他文件，造成跨文件损坏。fat32 后果较轻（写入失败），但 POSIX unlink 语义同样不成立。
- 修复方法：unlink 仅递减 `nlink`；截断与释放移入 `iput` 的 `ref==1 && nlink==0` 分支，与 xv6 原生语义对齐（`fs.c:358`）。

**B3. 挂载点目录可被删除**（严重度：中，已于 Day 1 修复）
- 位置：`src/kernel/sysfile.c:205`（仅当父目录不属于 xv6 时才转入 `vfs_unlink`）。
- 问题：`rm /mnt` 经原生路径删除挂载点目录项后，mtable 残留引用、NMOUNT 槽位泄漏；后续 `mkdir /mnt` 复用同一 inum，与旧挂载条目混叠（`vfs.c:232-242`）。
- 修复方法：unlink/rmdir 路径拒绝 `vfs_mountpoint(ip) != 0` 的目录。

**B4. ext2 位图扫描越界风险**（严重度：中，已于 Day 1 修复）
- 位置：`src/kernel/ext2.c:320`（块位图）、`ext2.c:381`（inode 位图）。
- 问题：循环上界使用 `s_blocks_per_group`（8192）而非实际块数（4096）；当前镜像因 mke2fs 将越界位填充为 1 而未暴露问题，其他工具生成的镜像可能使块分配越过 ext2 区域边界，经 `virtio_disk.c:377-380` 的偏移映射落入 FAT32 区域，造成跨文件系统损坏。
- 修复方法：循环上界钳位至 `s_blocks_count - s_first_data_block` / `s_inodes_count`。

**B5. `mount xv6 /x 1` 静默成功但无效**（严重度：低，已于 Day 1 修复）
- 位置：`src/kernel/vfs.c:61-69,78`。
- 问题：`xv6_mount` 总返回 0 且 `mnt->root = 0`，占用 NMOUNT 槽位而永不生效，并干扰重复挂载检查。
- 修复方法：`vfs_mount` 拒绝非根 FS_XV6 挂载；同时校验 dev 与 fstype 的配对关系（ext2↔2，fat32↔3）。

### 3.3 C 类：稳定性问题（优先级 P1）

**C1. SMP 环境下后端全局状态无锁保护**（严重度：中，已于 Day 5 修复）
- 位置：`src/kernel/ext2.c:103`（`ext2fs`）、`fat32.c:67`（`fat32fs`）。
- 问题：静态全局结构无锁保护；`begin_op` 允许多个并发事务，CPUS>1 时两个 CPU 可同时进入 `ext2_create`/`ext2_alloc_block`；超级块/组描述符计数的读改写及多步元数据操作存在竞争。（`mtable.lock` 本身使用正确，无持锁睡眠。）
- 修复方法：为后端增加 sleeplock 包裹 ext2/fat32 变更操作；或在文档中声明 CPUS=1 基线并附 SMP 实测结果。

**C2. ext2/fat32 写入绕过日志，无崩溃一致性**（严重度：已知设计取舍；取舍说明已文档化）
- 位置：`src/kernel/block.c:47`（`block_write_bytes` 直接 `bwrite`）。
- 处置：不修改设计（符合教学系统定位），但文档须正面说明该取舍及掉电影响，并准备答辩应答。

**C3. 测试 runner 定时硬编码，慢速主机上结果不稳定**（严重度：中，已于 Day 5 落地提示符等待）
- 位置：`tests/runner/run_qemu_case.py:29-30`（`--boot-wait 5.0`、`--step-wait 1.0`），各 `run.sh` 未覆盖默认值；`--expect` 仅在结束时检查一次。
- 修复方法：改为按 shell 提示符 pattern 等待就绪，超时参数化。

**C4. 压力、并发与边界场景测试空白**（严重度：中，已于 Day 5 补齐 tests/smp）
- 现状：ext2/fat32 的全部写入均为一行 echo 级别；未对挂载点执行 `stressfs` 压测；无 SMP 测试（runner 固定 `CPUS=1`）；无反复创建/删除循环（位图/FAT 泄漏探测）；无挂载点内 mkdir、嵌套目录、大文件用例。
- 处置：见 Day 5 任务安排。

### 3.4 D 类：功能深度（优先级 P1，对应功能完成度）

**D1. ext2 不支持双重间接块，文件上限约 268KB**（严重度：高，已于 Day 3 修复）
- 位置：`src/kernel/ext2.c:436-444`（12 直接 + 256 单间接 = 274,432 字节）；`ext2.c:228` 直接拒绝读取含双重间接的外来 ext2 文件（`ext2_iget` 返回 0）。
- 评估：双重间接为 ext2 标准结构，实现后单文件上限提升至约 64MB。在测例动态扩充的背景下，“跨文件系统复制大文件”是自然的扩充方向，此项为功能完成度的直接缺口。
- 处置：Day 3 实现（含截断释放路径），解除拒读限制。

**D2. 挂载点内目录操作无测试覆盖**（严重度：中，已于 Day 3 补测）
- 已核实：`ext2_create`/`fat32_create` 的 T_DIR 路径实现正确（`.`、`..` 均正确初始化，`ext2.c:660-725`、`fat32.c:772-794`），mkdir 实际可用，但无测试证明。
- 处置：补充 mkdir、嵌套路径、多文件 `ls` 用例并写入报告。

**D3. ext2 超过 14 字符的文件名不可见**（严重度：低，已于 Day 2 修复）
- 位置：`src/kernel/ext2.c:494,527,859` 均要求 `name_len <= DIRSIZ`(14)。
- 影响：长名文件 `ls` 不可见且无法打开（ext2 规范允许 255 字符）。
- 修复方法：查找比较时使用完整文件名，仅在拷贝进 `struct dirent` 时截断。

**D4. fat32 无长文件名（LFN）读支持**（严重度：中，已于 Day 4 修复）
- 现状：`fat32.c:276` 遍历时跳过 LFN 目录项，仅支持 8.3 短名；宿主机（Windows/Linux）写入的长名文件在系统内不可见，缺乏与真实世界 FAT32 数据交互的能力。
- 修复方法：实现 LFN **读**支持——解析属性 0x0F 的长名目录项、UTF-16 字符重组、多个 LFN 条目按序拼接后匹配，lookup 与目录遍历可识别长名（核心代码约 60 行）；写路径维持 8.3 创建，边界明确。

**D5. 可插拔根文件系统（选做冲刺项）**（严重度：低）
- 价值：以 ext2 作为根文件系统启动时，从 init 起的全部路径解析与文件操作均运行在外来文件系统上，是对 VFS 完整性的最高强度自证。
- 处置：仅在 Day 1–4 全部达标的前提下，于 Day 5 缓冲时间实施：Makefile 增加 `ROOT_FSTYPE` 开关，`vfsinit()` 按宏选择根后端，提供以 ext2 镜像启动的构建路径。未达标则放弃，不影响合规。

**D6. 明确不做的功能**
- FAT32 LFN **写**支持、rename、symlink、强制/延迟卸载、ext2 多 block group、VFS 对象模型与错误码体系重构、procfs/tmpfs 等额外后端、编译期裁剪开关。
- 理由：超出赛题硬性要求，或决赛阶段接口重构风险大于收益；现有 ops 表薄分发设计经复核无缺陷，不做架构性扰动。

### 3.5 E 类：设计与代码整洁（优先级 P1，对应设计精巧度）

**E1. HAL 中断抽象在 LoongArch 侧未生效，两平台不对称**（严重度：中，已于 Day 2 修复）
- 位置：`src/kernel/arch/loongarch/hal.c:24-33`（`hal_irq_claim` 返回 0、`hal_irq_complete` 为空操作）；`arch/loongarch/trap.c:235-251` 直接调用 `extioi_claim/complete`，绕过 HAL。RISC-V 侧正常经 HAL 分发（`trap.c:194,208` → `hal.c:24-33` → plic）。
- 影响：评审阅读 diff 时容易发现的“设计不精巧”问题。
- 修复方法：LoongArch `trap.c` 改经 `hal_irq_*` 分发，`extioi_*` 调用收进 `arch/loongarch/hal.c`，两平台对称。改动小、收益高。

**E2. `arch/loongarch/ramdisk.c` 为死代码**（严重度：低，已于 Day 2 修复）
- 确认依据：`src/Makefile:48-63` 的 LoongArch `ARCH_OBJS` 不含 `ramdisk.o`；`RAMDISK_HDR` 在两个架构均为空；`ramdisk_img.o` 构建规则无依赖者。
- 修复方法：删除该文件及 Makefile 残留规则。

**E3. Makefile 构建脆弱点**（严重度：低，已于 Day 2 修复）
- `src/Makefile:230-238`：`ext2.img` 未依赖 `kernel/param.h`，修改 `EXT2SIZE` 会遗留旧镜像导致布局错位（当前 FSSIZE+EXT2SIZE=6096=FAT32START 一致，无现存错位）；`mkfs.ext2`/`debugfs` 等宿主工具无存在性检查，失败信息不透明。
- 本机 LoongArch 交叉工具链为 `loongarch64-linux-gnu-gcc-14`（带版本后缀），需在干净环境确认 Makefile 前缀解析正常，保证评审环境可复现。
- 修复方法：补充依赖关系与工具检查；提供工具链检查脚本。

**E4. 锁安全工程未文档化**（严重度：低，已文档化：docs/contest/lock_order.md）
- 现状：锁规则与 B1/B2 等缺陷修复仅存在于代码与计划中，未沉淀为工程文档。
- 修复方法：新增 `docs/LOCK-ORDER.md`，定义锁层级与持有规则（如 itable.lock → ip->lock → bcache.lock → b->lock 的获取顺序、持 spinlock 不得睡眠等）；将 B1/B2 修复按“失败—分析—修复—复测”格式记录，形成“规则—案例—文档”闭环，同步转化为创新性分析素材。

### 3.6 F 类：文档问题（优先级 P2，对应文档质量）

| # | 问题 | 位置 |
|---|------|------|
| F1 | “目前包括”一节仅列 2 个测试点，与上方 7 套件表矛盾（已修复：测试点列表已补齐，现为 11 项） | `README.md:90-93` 对比 `:72-78` |
| F2 | 仓库结构清单遗漏 `xv6-riscv-src/`（diff 基线）（已修复：仓库结构已含完整描述） | `README.md:31-39` |
| F3 | mount 用法不统一，未说明 dev 可省略（已修复：统一为 `mount ext2 /mnt` 并注明 dev 可省略） | `README.md:122` 对比 `docs/contest/test_report.md:165,210,323` |
| F4 | 文件名缺少 `.md` 后缀（已修复：已补后缀，commit_history 更名 progress.md） | `submit/README.md:13-14`、`README.md:62-63` |
| F5 | 许可证仍为“拟采用”表述，仓库根无 LICENSE（已修复：BSD-2-Clause LICENSE 于 Day 6 落地） | `README.md:129`、`docs/contest/compliance.md:17` |
| F6 | test_report 未声明 test1/test2 为重写版，未引用上游仓库（情况已变：Day 1 起 test1/test2 已为官方原版，test_report.md 列入 Day 8 重写同步） | `docs/contest/test_report.md:45,150,179-180` |
| F7 | “后续提交方向”事项已完成但未清理（已修复：progress.md 已更新为收尾事项） | `docs/progress.md` 结尾 |
| F8 | design.md 需同步（部分完成：HAL 对称化与阶段 H–J 已同步，K–O 对应内容列入 Day 8 最终同步） | `docs/design.md` |
| F9 | 缺基线锚定文档（已修复：docs/contest/baseline.md 已落地） | 新增 `docs/BASELINE.md` |

### 3.7 G 类：经复核排除的问题

以下各项经代码审查确认无问题，无需处理：

- 跨挂载点 `..` 引用计数平衡（`vfs.c:258-267` 正确 `idup`），无丢失或双重 `iput`；
- dev 1/2/3 键控的 inode 缓存无冲突；fat32 以首簇号为 inum 且有 root 去重；
- lseek 越过 EOF 写入：ext2 稀疏区读零（`ext2.c:883-884`）、fat32 中间簇分配并清零（`fat32.c:258`），均正确；
- 写入超过 268KB 时返回短写错误而非数据损坏（`ext2.c:906-925`）；
- 错误路径无 `brelse` 泄漏、无位图双重释放；
- `usys.pl` 的 LoongArch 系统调用 ABI 正确（`li.d $a7; syscall 0; jirl`）；
- `/hello.c` 与 `/tests/hello.c` 无命名冲突；
- 构建产物（`.o/.d/.asm/.img`）未纳入 git 管理，`git status` 干净；
- 全仓库无 TODO/FIXME 残留，文件系统代码无 panic，无调试打印残留。

---

## 4. 提交物要求映射与任务分解

### 4.1 设计文档包

| 要求项 | 对应物 | 缺口与动作 |
|---|---|---|
| 设计思路、实现描述、代码说明 | `docs/design.md`（三层架构、mermaid 图、文件责任表、阶段 A–G） | 同步 E1/E2/D1/D4 变更（F8） |
| 研发过程中遇到的问题和解决方法 | 分散于 progress.md | 增设专题章节并以 E4（LOCK-ORDER）承接：B1/B2 缺陷的“失败—分析—修复—复测”记录、LoongArch TLB-refill 调试（阶段 G），形成完整的研发叙事 |
| 非本队来源说明 | `docs/contest/compliance.md` | 更新：官方测例原样引入及版本锚定说明、xv6-loongarch-exp 引用范围、许可证表述定稿 |
| 基线锚定 | 新增 `docs/BASELINE.md`（F9） | 记录 rev5 基线 commit hash、diff 生成命令与复现方法 |

### 4.2 测试结果分析（需重点扩充）

- 功能分析：11 测试点 × 2 架构矩阵、官方测例映射表、完整 usertests 结果；
- **需求跟踪矩阵**：需求编号—需求描述—设计文档—实现文件—测试状态五列追溯，覆盖赛题功能需求与派生设计需求，使评审可按行抽查“需求—设计—实现—测试”一致性；
- 性能分析：ext2/fat32 顺序读写吞吐（大文件拷贝计时）、fat32 簇分配优化前后对比、**VFS 开销量化**（同一文件操作在原生 xv6 路径与 VFS 分发路径的对比计时，预先回答“VFS 引入多少开销”）；双架构编译、启动时间与内核镜像大小仅在最终源码完成可复核采集后引用；
- 创新性分析：提炼编号创新点，按“创新内容/实现手段/创新价值”三段展开。候选：逻辑设备号偏移复用单一 virtio 盘、薄 VFS ops 分发表、HAL 双平台对称中断抽象、B1/B2 缺陷的根因分析与修复工程、双平台一致性验证方法；
- 与类似项目的对比分析：参照系为静春山、RuOK、Linux、原版 xv6，从功能、架构设计、代码规模、性能、文档质量、创新性六个维度对比。须实际浏览参照仓库取证，对比结论须有依据。

### 4.3 作品进展汇报幻灯片

在现有 final_slides 基础上补充：

- 参赛队员分工页（当前缺失，为硬性要求）；
- 开发时间进度页：阶段 0/A–G 时间线及各任务推进与完成情况（由 progress.md 提炼，含决赛冲刺阶段计划）；
- 三个合规叙事专页：**参照版本**（基线与第三方来源）、**增量贡献**（diff 规模与新增内容）、**AI 工具使用声明**；
- 保留并更新：架构图、测试矩阵、演示截图。

### 4.4 作品演示视频

- 先撰写《演示视频脚本和关键帧》文档（逐句旁白 + 分段时间轴 + 画面规划），再按分镜录制；
- 视频三要素：① 运行环境介绍（qemu 版本、双架构工具链、宿主机配置）；② 符合任务要求的运行演示（启动后 ext2 已自动挂载、`cd /tests; cat cmds.sh | sh` 官方流程原样通过、三文件系统同挂互拷、ext2 大文件、fat32 长名文件读取、LoongArch 平台实跑、压力测试）；③ 结果说明（`verify-all` 汇总表与测试日志展示）。

### 4.5 现场答辩 PPT

- 建议结构（12–15 页）：题目与核心亮点 → 架构总览（VFS/HAL 各一图）→ 三项关键设计决策（ops 表薄分发、逻辑设备号偏移、HAL 双平台对称）→ 三文件系统并存演示截图 → 双平台运行证据 → 测试矩阵与参考项目对比 → 研发难点（B1/B2/TLB-refill）→ 局限与取舍（如实列出 non-goals）→ 总结；
- 同步准备质询应答库：崩溃一致性取舍的说明（C2）、fat32 LFN 仅支持读的理由、HAL “薄”设计的定位、真实磁盘持久化路线（virtio 块设备）与内存嵌入式镜像路线的差异。

---

## 5. 逐日任务安排（8.4 – 8.12）

安排原则：**前期（Day 1–5）集中完成赛题工程性任务与代码实现优化，后期（Day 6–8）集中进行文档体系建设与展示材料制作**，构建“得分点—承接物”的完整映射。

每日回归基线：当天结束时双架构全部测试点必须全部通过；不达标当晚修复，不积压。

### 进度速览（8.18 更新）

| 日 | 状态 | 门禁结果 |
|---|---|---|
| Day 1 官方测例合规 + B 类修复 | 已完成 | 14/14 回归 PASS，已推送（4 笔提交） |
| Day 2 HAL 对称化与批量修复 | 已完成 | 14/14 回归 PASS，已推送（4 笔提交） |
| Day 3 ext2 双重间接 + 大文件测试 | 已完成 | 14/14 回归 PASS；完整 usertests（不带 -q）双架构 PASS；e2fsck 离线校验零错误；已推送（5 笔提交） |
| Day 4 fat32 LFN 读支持 | 已完成 | 14/14 回归 PASS；完整 usertests 双架构 PASS；已推送（3 笔提交） |
| Day 5 稳定性证据与一键复现 | 已完成 | 16/16 回归 PASS（新增 smp 双架构）；完整 usertests 双架构 PASS；SMP 压测后 e2fsck 零错误；证据入库 tests/evidence/；已推送（3 笔提交） |
| Day 6 合规落地与性能测量 | 已完成 | LICENSE/SPDX 落地；基线副本补齐并与官方 rev5 逐文件校验一致；vfsbench 全量测量与证据归档；参照项目取证完成；16/16 回归 + 完整 usertests 双架构全绿；已推送（3 笔提交） |
| Day 7 文档体系建设 | 已完成 | tests/ 体系规范化、docs/notes 八篇、contest/ 六篇、baseline/lock_order、docs 三层索引、progress.md 改写、三文档重写全部入库；演示视频与双 PPT 顺延至 Day 8 |
| Day 8 交付态收敛 | 已完成 | test_report.md 重写（含 mount 测试点与 22/22 口径）；最终 diff 重生成；submit/ 材料聚合完成；演示视频就位 |
| 8.13–8.16 收尾增补（计划外迭代） | 已完成 | mount 三态/四态锁与 umount 落地（阶段 P/Q）；mount_lifecycle/remount_io/mount_storm 三测试点（16→22 项）；web 教学辅助网站上线；最终 diff 与 nonblank 审计版重生成（62 个文件，+6405/−113） |

推送前门禁（自 Day 3 起强制执行）：`tests/run_all.sh` 全量 + `tests/full_usertests.sh` 双架构全绿，缺一不推。（测试点两次扩展：Day 5 起 16/16，8.16 mount 扩展后 22/22。）

### 第一阶段：代码实现优化（Day 1–5）

**Day 1（8.4，周二）：官方测例合规工程 + 高严重度缺陷修复**
- [✔] 上午（A1/A4/A5）：下载官方 `test1.c/test2.c/cmds.sh/hello.c` 原样入库；`src/user/` 以官方原版替换重写版并加入 UPROGS；mkfs 将 test1/test2/cmds.sh/hello.c 置入镜像 `/tests` 目录；~~`user/init.c` 增加启动自动挂载 ext2 至 /mnt~~（**修正**：官方 README 明确要求手动挂载，自动挂载会使评测者的手动 mount 报错，故放弃）；新增 `tests/VFS_TESTS_PIN.txt` 并填写完整锚定信息；同步 `tests/public_vfs/run.sh` 断言串为官方输出格式。
- [✔] 下午（B 类）：修复 B1（`valid==0` 时才填充）、B2（unlink 语义对齐 xv6）、B3（拒绝删除挂载点）、B5（拒绝非根 xv6 挂载）。B4（位图钳位）提前至本日完成。
- [✔] 晚上：双架构 7 测试点回归；官方流程（`cd /tests; cat cmds.sh | sh`）双架构原样跑通。
- 产出：任务 4 合规落地，评审验收体验对齐官方流程；4 个正确性补丁。
- **计划外增补**：上午探针实证发现官方流程在 `cd tests` 后全部 `exec failed`（阻断性缺陷），当日实现 exec 裸命令名根目录回退修复；新增 `unlinkopen` 回归测试（B2 守护）；输出与官方参考逐字节一致。

**Day 2（8.5，周三）：HAL 对称化与低严重度缺陷批量修复**
- [✔] 上午：E1 HAL 对称修复（LoongArch trap.c 改经 hal_irq_* 分发，电平/边沿路由知识收敛进 `arch/loongarch/hal.c`）；E2 删除 ramdisk 死代码（文件、Makefile 规则、defs.h 声明）；E3 提供 `tests/check_env.sh` 环境检查脚本（本机 gcc-14 后缀回退路径实测可用）。
- [✔] 下午：修复 B4（位图钳位）、D3（ext2 长文件名，采用“截断显示 + 唯一前缀别名查找”方案，长名文件可列/可 stat/可读）、E3（Makefile 补 `param.h` 依赖与宿主工具检查）；可选项 fat32 簇分配 next-free 提示已实施（含回绕扫描与释放端下调）。
- [✔] 晚上：双架构回归 14/14；design.md 同步（当日变更当日记录）。
- 产出：diff 更为整洁，设计精巧度无硬伤。

**Day 3（8.6，周四）：ext2 双重间接块 + 目录与大文件测试**
- [✔] 全天：D1 `ext2_bmap` 双重间接分支（读/写/截断释放），解除 `ext2.c:228` 的拒读限制，文件上限提升至约 64MB（三重间接维持拒读）。
- [✔] 同步补充测试（D2）：ext2/fat32 下 mkdir、嵌套路径、多文件 `ls`；新增 `bigfile` 用户程序写入 1MiB 确定性模式并逐字节读回校验（keep/verify 模式支撑跨启动持久性验证）；镜像常驻注入 1MiB 外部文件（必含双重间接块）以 `wc` 校验可读。
- [✔] 晚上：双架构回归 14/14；新用例并入 `tests/ext2/`、`tests/fat32/`、`tests/persist/`；`e2fsck -fn` 离线校验 ext2 分区五阶段零错误。
- 回退预案：未触发（实现一次调通）。
- **计划外增补**：
  - 回归抓获 `file.h` 扩展 `addrs` 后 `iupdate/ilock` 拷贝越界（覆写相邻 dinode 的 type，`fourfiles` panic），已修复并确立“以 `sizeof(dip->addrs)` 为拷贝上界”的约束，写入 design.md；
  - 完整版 usertests 首次在 LoongArch 暴露**磁盘完成中断丢失**（初始移植遗留，gdb 取证：设备已投递完成而客户机未处理）；修复为 devintr 处理循环 + 定时器看门狗 `virtio_disk_watchdog()` 双层防护，双架构完整 usertests（不带 -q，含 6 项慢测试）全部通过；
  - 测试 runner 增加 `--final-wait`（C3 最小落地），`test_baseline` 增加 timeout 兜底（guest panic 不再挂死回归）；
  - 新增 `tests/full_usertests.sh` 并确立推送前门禁（run_all + 完整 usertests 双绿才允许推送）。

**Day 4（8.7，周五）：fat32 LFN 读支持 + 完整 usertests**
- [✔] 上午至下午早些时候：D4 实现 fat32 LFN 读支持——解析 0x0F 长名目录项、UTF-16 重组、链式拼接匹配，lookup 与目录遍历可识别长名；写路径维持 8.3。（落地要点：链校验和验证、乱序/删除项断链保护、匹配规则与 ext2 别名语义一致；`mkfat32.c` 注入 `longfilename.txt`/`ShortLong.txt` 两个夹具文件。）
- [✔] 下午：A2 双架构执行完整版 `usertests`（不带 `-q`），记录结果。（提前于 Day 3 完成，并固化为 `tests/full_usertests.sh` 推送门禁；本日对最终代码再次双架构复测通过。）
- [✔] 晚上：双架构回归（含 LFN 读取用例：宿主机构造的长名文件在系统内按长名/小写名/8.3 残名三种方式 cat 成功，`ls` 显示装配名）；当日缺陷按 E4 格式记录。
- 回退预案：未触发（实现一次调通，双架构行为一致）。

**Day 5（8.8，周六）：稳定性证据与一键复现（含选做冲刺项）**
- [✔] 上午：C4 SMP 压测取证——新增 `tests/smp` 测试点（runner 增加 `--cpus`），CPUS=3 下 ext2/fat32 挂载点三路并发 `bigfile` + 挂载点内 `stressfs`。修复前红灯实证：fat32 并发写挂死（C1 坐实）。
- [✔] 下午：C1 修复落地（两后端各一把 sleeplock 包裹分配/释放路径，锁序：inode 锁 → 后端锁 → 缓冲锁）；计划外修复 fat32 链漫游 O(n²)（inode 空槽位缓存漫游位置，O(1)/块）；C3 落地为 runner 提示符等待（静默+`$ `双判定）；A3 新增 `make verify-all`；修复后 SMP 双架构 PASS，压测后 e2fsck 五阶段零错误。
- [✔] 晚上：门禁双项全绿（16/16 + 完整 usertests 双架构）；证据归档 `tests/evidence/`（16 项汇总、双架构完整 usertests、双架构 SMP 原始输出）。D5 经评估放弃：超出赛题硬性要求，需 ext2 设备节点与启动路径改动，收尾期风险/收益不成立，记档不实施。
- 产出：完整 usertests、SMP、压力测试证据；评审可一行命令复现全部声明。

### 第二阶段：文档体系建设与展示材料（Day 6–8）

**Day 6（8.9，周日）：合规落地与性能测量**
- [✔] 许可证与来源合规：BSD-2-Clause `LICENSE` 落地仓库根；12 个自有源文件加单行 SPDX 注释头；`compliance.md` 定稿逐文件来源清单；README 许可证表述定稿。
- [✔] 基线完整性修复（新增发现并解决的问题）：基线副本 `xv6-riscv-src/` 缺失 `mkfs/mkfs.c`（初赛导入时被 `.gitignore` 规则误伤漏交），已补回并与官方 rev5 tag（commit 7d7adbb）全量递归比对逐文件一致；`baseline.md` 落地（F9 修复）。
- [△] 性能测量：新增 `vfsbench` 基准程序；本轮 P0 修复前已采集 RISC-V 的 VFS 开销、三后端吞吐和 fat32 两项优化前后三点历史数据（写 273→57、读 86→4 ticks），原始日志归档 `tests/evidence/bench-*.txt`。这些记录用于说明优化方向，不代表最终源码性能；LoongArch 吞吐及最终源码的双架构构建/启动/体积数据仍待重新采集，不引用误标记录。
- [✔] 参照项目取证：克隆分析两个 2025 参照项目仓库，提取基线/规模/VFS-HAL 形态/功能/测试证据，形成对比分析数据底稿。
- [✔] tests/ 体系规范化：9 套测试点 README 双语四段式重写、覆盖矩阵、占位目录移除、runner/门禁脚本入库。
- 产出：门禁双项全绿（16/16 + 完整 usertests 双架构）；3 笔提交推送。
- 说明：原计划的 test_report 扩充与创新性分析顺延（文档体量大于预期），拆分为 Day 7 的 contest/ 六篇文档与 Day 8 的 test_report 重写。

**Day 7（8.10，周一）：文档体系建设（实际执行）与演示材料（顺延）**
- [✔] tests/ 体系规范化（9 套双语四段式 README、覆盖矩阵、占位移除）并提交（f9f9dd3）。
- [✔] docs/notes 学习笔记 8 篇（赛题分析至调试案例，编号成序）并提交（8aa9440）。
- [✔] docs/contest/ 六篇（problems/innovation/comparison/performance/video_script/README 映射）、baseline.md、lock_order.md、docs 三层索引完成。
- [✔] progress.md 改写（更名自 commit_history.md，续写阶段 K–O、总览与收尾事项更新）；ai_usage/compliance/references 统一重写。
- [✔] performance.md 数据真实性复核：修正启动时间测量错误（原 0.40s/2.77s 为 make 开销污染，直接启动实测双架构均约 0.2s）并删除错误归因。
- [ ] 演示视频录制与双 PPT 制作：顺延至 Day 8（素材已备：video-script.md、comparison.md、progress.md）。

**Day 8（8.11，周二）：交付态收敛与最终打包（预留缓冲）**
- [✔] test_report.md 重写（F6：与官方原版测例及当前测试体系同步）；design.md 最终同步（F8 余项）（已完成：含三个 mount 测试点与 22/22 口径，四态挂载设计已同步）。
- [ ] 演示视频按 `video_script.md` 分镜录制（成品 `submit/演示视频.mp4` 已就位）；汇报幻灯片与答辩 PPT 定稿（新版已定稿，待替换 submit/ 旧版）。
- [✔] 仓库交付态清理：移除临时文件、过程性 TODO、调试残留，评审所见即最终叙事。
- [✔] `make clean` 后重新生成 `xv6-vfs-hal-final.diff` 与 `.diff.stat`，复核无调试残留、行数与文档声明一致（任务 5）（已完成：62 个文件，+6405/−113，套用回基线验证逐文件一致）。
- [ ] 在干净 clone 上全流程复现（模拟评审环境）：构建 → `verify-all` → 官方流程 `cd /tests; cat cmds.sh | sh`。
- [ ] 按 §6 清单更新核对 `submit/` 全部材料；预留半天缓冲；答辩 PPT 二次打磨。

**Day 9（8.12，周三）：提交日**
- [ ] 仅执行最终检查与上传，不安排任何代码改动。

---

## 6. 提交物核对清单

**代码与 diff**
- [✔] `xv6-vfs-hal-final.diff` 与 `.diff.stat`（干净源码树重新生成，62 个文件，+6405/−113）
- [✔] B1–B5、E1–E3、D1–D4 修复全部合入并回归通过
- [✔] 官方测例逐字节入库 + `VFS_TESTS_PIN.txt` 填写完整 + `/tests` 布局（手动挂载，与官方流程一致；自动挂载项经实证放弃）
- [✔] 无调试残留、无死代码（ramdisk.c）、无 TODO/FIXME；仓库交付态收敛

**测试证据**
- [✔] 官方流程（手动挂载后执行 `cd /tests; cat cmds.sh | sh`）双架构通过并纳入回归
- [✔] 完整版 `usertests` 双架构通过日志入库（任务 3）
- [✔] 11 个测试点 × 2 架构汇总证据入库
- [✔] `make verify-all` 可用且 22/22 通过
- [✔] SMP（CPUS=3）与 stressfs 压力测试记录
- [✔] 冲刺期缺陷的“失败—分析—修复—复测”记录入库（`docs/contest/problems.md` P1–P13 与 `lock_order.md` 案例）

**文档包**
- [✔] design.md 定稿（HAL 对称、双重间接、LFN 读、四态挂载与研发问题专题）
- [✔] test_report.md 扩充版（需求矩阵见 `tests/MATRIX.md`，性能/创新性/对比分析分篇落地，VFS 开销量化见 performance.md）
- [✔] compliance.md 更新（官方测例引入与锚定说明、非本队来源完整）
- [✔] baseline.md（基线锚定）、lock_order.md（锁安全工程）（落地于 `docs/contest/`）
- [✔] LICENSE（BSD-2-Clause）与新增文件 SPDX 头
- [✔] README.md 与 submit/README.md 全部陈旧项修复（F1–F4）

**展示材料**
- [ ] 进展汇报幻灯片（分工页、进度时间线页、参照版本/增量贡献/AI 声明专页）（新版已定稿，待替换 submit/ 旧版）
- [✔] 演示视频（脚本与关键帧文档 + 按分镜录制成品）
- [ ] 现场答辩 PPT（12–15 页）与质询应答库

---

## 7. 风险管理

| 风险 | 预案 |
|---|---|
| D1 双重间接超期 | Day 3 16:00 收缩为“读路径 + 解除拒读”，写路径维持现状并文档说明 |
| D4 LFN 读超期 | Day 4 晚间未调通则降级为 non-goal 说明；不影响 Day 5 及以后日程 |
| D5 可插拔根文件系统 | 严格限定为选做冲刺项，前提为 Day 1–4 全部达标；任何犹豫即放弃 |
| SMP 压力暴露深层竞争（C1） | 预案为后端 sleeplock（改动约 50 行以内）；若仍不稳定，文档声明 CPUS=1 基线并如实报告 SMP 现状 |
| runner 或宿主机性能波动导致结果不稳定 | Day 5 pattern 等待改造根治；`verify-all` 对单项失败允许重试一次 |
| 上游测例在冲刺期间变动 | 以 `VFS_TESTS_PIN.txt` 锚定版本为准；提交前检查上游是否有更新并在锚定文件中注明 |
| 整体进度落后 | 保底三项：Day 1（官方测例合规工程）、Day 5（verify-all 与日志入库）、Day 8（打包），分别对应任务 4、运行稳定性评分、任务 5 |
| 范围蔓延 | 明确不做清单见 D6；每日核对当日任务是否越界 |

---

## 附录：关键文件位置索引

- VFS 层：`src/kernel/vfs.c`（507 行）、`vfs.h`（57 行）；挂载发布见 `vfs_mount()`，路径切换见 `fs.c:namex()`
- ext2：`src/kernel/ext2.c`（1216 行）；冷 inode 加载见 `ext2_iget()`，延迟释放见 `ext2_unlink()`/`ext2_itrunc()`，双重间接见 `ext2_bmap()`
- fat32：`src/kernel/fat32.c`（1183 行）；冷 inode 加载见 `fat32_iget()`，并发分配与链遍历见后端锁及 FAT 链操作，LFN 读取见 `fat32_lookup_lfn()`
- HAL：`src/kernel/hal.c`（46 行）、`src/kernel/arch/loongarch/hal.c`（52 行）、`arch/loongarch/trap.c`（中断入口）
- 启动与挂载：`src/kernel/vfs.c:vfsinit()` 初始化根挂载；用户按官方流程执行 `mount ext2 /mnt`
- 设备偏移：`src/kernel/virtio_disk.c:377-380`；常量定义 `src/kernel/param.h:7-16`
- 构建：`src/Makefile`（ARCH 分支 29-69，镜像构建 230-247，E3 见 230-238）；根 `Makefile`（测试目标 290-410，`verify-all` 见 409-414）
- 测试：`tests/runner/run_qemu_case.py`（提示符等待与精确计数断言）；各 `tests/*/run.sh`、`cmds.sh`
- 官方测例：https://github.com/yanjun-wen/xv6-extend-vfs/tree/main/tests （4 个文件：cmds.sh、hello.c、test1.c、test2.c）
- 参考项目：静春山 https://gitlab.eduxiji.net/educg-group-36002-2710490/T202510558995330-264 ；RuOK https://gitlab.eduxiji.net/educg-group-36002-2710490/T202510486995232-2402
