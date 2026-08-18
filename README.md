<div align="center">

<p><img src="docs/assets/buaa-logo.png" alt="北京航空航天大学" height="70" /></p>


<p>xv6虚拟文件系统和硬件抽象层的设计与实现</p>

<p><strong>2026 计算机系统能力大赛功能挑战赛道 · 颜值爆表队</strong></p>

<p>
  <a href="docs/design.md"><img src="https://img.shields.io/badge/文件系统-xv6%20%7C%20ext2%20%7C%20FAT32-0053A5" alt="fs" /></a>
  <a href="docs/design.md"><img src="https://img.shields.io/badge/平台-RISC--V%20%7C%20LoongArch-E8912D" alt="platform" /></a>
  <a href="https://gitlab.eduxiji.net/T2026100069911110/project3136859-388873"><img src="https://img.shields.io/badge/License-BSD--2--Clause-7C5CFC" alt="license" /></a>
</p>

</div>

---

[中文](README.md) | [English](README.en.md)

## 项目简介

本项目参加 2026 年全国大学生计算机系统能力大赛操作系统设计赛 OS 功能挑战赛道，赛题为 `proj34 xv6 虚拟文件系统和硬件抽象层的设计与实现`。

项目基于 MIT xv6-riscv rev5，在保持 xv6 小型教学系统风格的前提下，为其增加虚拟文件系统（VFS）与硬件抽象层（HAL）：系统同时支持 xv6、ext2、fat32 三种文件系统，并运行于 RISC-V 与 LoongArch64 两个平台。两个平台均通过 xv6-riscv rev5 自带测例与赛题指定的 VFS 测例，相对原始基线的全部改动以 diff 文件形式交付。

## 项目亮点

- **薄 VFS 分发层**：以操作表统一三种文件系统，通过挂载操作睡眠锁串行化 `mount/umount`，再用四态挂载表完成发布、失败回滚与安全卸载；busy 挂载立即拒绝卸载，对 xv6 原生路径保持最小侵入。
- **单盘三文件系统镜像布局**：一块 virtio 磁盘同时承载 xv6、ext2、fat32 三个文件系统镜像，启动后可按需挂载。
- **双平台对称薄 HAL**：两个平台共用同一套内核代码，平台差异收敛于独立的移植层，中断路由知识单点收敛。
- **机制级稳定性兜底**：针对外部中断链无法保证不丢中断的现实，设计 virtio 看门狗在机制层兜底，SMP 并发压测通过。
- **交互式教学控制台**：`web/` 配套网站在浏览器中运行 xv6 风格终端，随命令同步展示系统调用、VFS、文件系统与 HAL 的源码执行链，支持真实 QEMU 与演示双会话及可选 AI 分析，是演示与答辩的可视化载体。
- **缺陷驱动的测试体系**：11 个测试点 × 2 个架构共 22 项回归全部通过；新增状态机、双后端 1 MiB 重挂载和 CPUS=3 挂载风暴专项测试，功能回归可用 `make verify-all` 一行命令复现。

## 快速开始

仓库根目录提供 `Dockerfile`，镜像内预装 RISC-V / LoongArch64 交叉工具链、QEMU 及全部测试依赖，并已预构建两个架构的内核与 `fs.img`，开箱即用：

```sh
docker build -t xv6-vfs-hal .
docker run --rm -it xv6-vfs-hal          # 进入容器，工作目录 /xv6
```

容器内或本地环境（依赖见 `tests/README.md`）均可执行：

```sh
make verify-all        # 环境检查 + 22 项双架构回归 + 双架构完整 usertests
make test_baseline && make run    # 官方入口执行 usertests -q
```

手动启动系统：

```sh
cd src
make qemu                           # RISC-V
make ARCH=loongarch CPUS=1 qemu     # LoongArch64
```

配套的交互式教学控制台位于 `web/`，可在浏览器中运行 xv6 风格终端，并随命令同步展示用户态、系统调用、VFS、具体文件系统和 HAL 的源码执行链。网站运行于 Node.js 环境，启动命令、真实 QEMU 会话与 AI 助教模式的配置详见 `web/README.md`。

进入 shell 后可按官方参考流程挂载 ext2 并执行 VFS 测例：

```sh
mkdir /mnt
mount ext2 /mnt        # mount 的 dev 参数可省略，系统按文件系统类型选择默认设备
cd tests
cat cmds.sh | sh
cd /
umount /mnt            # 若文件仍打开或 cwd 位于该文件系统，则返回失败
```

注：若拉取 `ubuntu:24.04` 基础镜像超时，可先在 `/etc/docker/daemon.json` 配置 `registry-mirrors` 镜像加速后重启 Docker。

## 赛题文档大纲对照

| 赛题大纲条目 | 位置 |
|---|---|
| 目标描述 | 上文“项目简介” |
| 比赛题目分析和相关资料调研 | [notes](docs/notes) |
| 系统框架设计 | [design.md](docs/design.md)|
| 开发计划 | [plan.md](docs/plan.md) |
| 比赛过程中的重要进展 | [progress.md](docs/progress.md) |
| 系统测试情况 | [test_report.md](docs/contest/test_report.md) |
| 遇到的主要问题和解决方法 | [problems.md](docs/contest/problems.md) |
| 分工和协作 | [collaboration.md](docs/contest/collaboration.md) |
| 提交仓库目录和文件描述 | 下文“仓库结构” |
| 比赛收获 | [summary.md](docs/contest/summary.md) |

## 比赛题目分析与相关资料调研

赛题要求在 xv6-riscv rev5 上同时扩展三类文件系统与两个硬件平台，且以“增加的代码尽量少、系统运行稳定”为约束，因此团队首先对赛题任务、评分要点与基线源码做了系统拆解，再动笔写代码。调研与精读过程沉淀为九篇学习笔记：赛题分析、xv6 rev5 源码结构与启动链路、文件系统调用链、路径解析机制、ext2/fat32 规范要点、VFS 与 HAL 设计推导、调试案例集与资料清单。详见 `docs/notes/`，其中 VFS 与 HAL 两篇设计推导完整记录了从源码事实到设计决策的过程。

## 系统框架设计

系统采用三层结构：上层为薄 VFS 分发层，维护挂载表并把文件操作按挂载点分发到具体后端；中间为三个文件系统实现——xv6 原生文件系统保持原状，ext2 与 fat32 作为新增后端接入同一接口；下层为轻量 HAL，将平台相关代码（启动、中断、块设备）收敛到独立的 arch 移植层，使两个平台共享全部文件系统代码。设计的关键取舍、核心数据结构、并发锁规则与镜像布局均在文档中展开。详见 `docs/design.md`，锁规则专项说明见 `docs/contest/lock_order.md`。

## 开发计划

开发按“基线先行、逐阶段推进、每阶段可验证”的原则组织：先建立基线锚定与测试环境，再依次实现 VFS、ext2、fat32、HAL 与 LoongArch 移植，最后做稳定性加固、合规落地与交付整理。决赛阶段的任务分解、日程安排与完成情况逐日记录在计划文档中。详见 `docs/plan.md`。

## 比赛过程中的重要进展

项目从基线建立到交付共经历十九个阶段（阶段 0 至阶段 R），每阶段按“主要目标、主要改动、验证结果”记录：薄 VFS 分发层、挂载表与块设备接口、ext2 与 fat32 支持、LoongArch64 启动与 virtio-pci 块设备、官方 VFS 测例对接、ext2 双重间接大文件、fat32 长文件名、并发稳定性修复、安全卸载、mount 测试体系扩展、合规与性能测量等。每阶段均可与提交历史及 `tests/evidence/` 的测试日志互相印证。详见 `docs/progress.md`。

## 系统测试情况

测试体系由三层组成：xv6 自带测例（`usertests`，双架构均执行快速版与完整版；完整版各含 69 个命名测试，即 63 quick + 6 slow，判定行均为 `ALL TESTS PASSED`）、赛题指定 VFS 测例（test1/test2 按官方参考流程执行通过，镜像布局与官方一致）、统一编排的 11 个测试点（文件系统功能与错误语义、持久化、SMP I/O、挂载生命周期、1 MiB 多轮重挂载、双后端挂载风暴）。11 测试点 × 2 架构共 22 项全部通过，ext2 镜像经 e2fsck 校验零错误。详见 `docs/contest/test_report.md` 与 `tests/README.md`，性能数据与证据边界见 `docs/contest/performance.md`。

## 遇到的主要问题和解决方法

研发过程中的关键问题均已按“现象、定位、根因、修复、验证”记录，共九项，覆盖评测流程对接、文件系统语义、并发稳定性与测试工程四个方向。代表性案例：LoongArch 平台磁盘完成中断丢失导致系统挂死，最终以 virtio 看门狗在机制层兜底；fat32 大文件写入存在 O(n²) 链漫游导致的分钟级耗时，通过簇链缓存优化到正常水平；打开中的文件被 unlink 后的语义错误通过 inode 缓存一致性与延迟释放修复。完整清单见 `docs/contest/problems.md`，调试细节另见 `docs/notes/07-debug-cases.md`。

## 分工和协作

团队三人按子系统划分责任、交叉评审：顾文达（队长）负责整体技术把控与双平台 HAL 移植，苗含旭负责 VFS 与 ext2/fat32 三个文件系统，李孟希负责决赛阶段的测试体系、稳定性优化与文档建设。协作以托管平台的迭代提交为主线，每阶段完成后进行交叉评审与全量回归。详见 `docs/contest/collaboration.md`。

## 比赛收获

通过本项目，团队在文件系统实现、并发正确性、跨平台移植三个方向获得了完整的工程实践，并形成了一套可复用的工作方法：基线锚定与 diff 克制的纪律、缺陷驱动的测试建设、阶段化进展记录。具体总结见 `docs/contest/summary.md`。

## 仓库结构

```text
.
├── README.md                  # 项目说明（中文主版）
├── README.en.md               # 项目说明（English）
├── LICENSE                    # BSD-2-Clause
├── Makefile                   # 测试编排：11 个测试点 × 2 个架构共 22 项执行
├── Dockerfile                 # 容器化构建与测试环境
├── src/                       # 作品源码
│   ├── kernel/                # 内核
│   ├── mkfs/                  # 镜像打包工具
│   ├── user/                  # 用户程序（含官方测例 test1/test2 与团队测试程序）
│   └── tests/                 # 装入镜像 /tests 目录的数据文件
├── xv6-riscv-src/             # xv6-riscv rev5 原始基线副本
├── tests/                     # 宿主机测试编排
├── docs/                      # 项目文档
│   ├── contest/               # 赛事资料
│   └── notes/                 # 学习笔记
├── web/                       # xv6 终端、执行链与源码联动教学网站
└── submit/                    # 竞赛提交材料
```

各目录的详细说明见对应的 README：`docs/README.md`、`tests/README.md`、`submit/README.md`。

## 提交材料 `submit/`

- `xv6-vfs-hal-final.diff`：最终版本与 xv6-riscv rev5 基线之间的标准、可回放 diff（62 个文件，+6405/−113；生成方式见 `docs/contest/baseline.md`）。
- `xv6-vfs-hal-final.diff.stat`：上述标准 diff 的统计摘要。
- `xv6-vfs-hal-final.nonblank.diff`：排除纯空白新增/删除行的审计展示版（+5602/−106，共 5708 行）；该文件不具备补丁回放语义。
- `xv6-vfs-hal-final.nonblank.diff.stat`：非空白文本变更的逐文件统计摘要。
- `final_slides.pdf` / `final_slides.pptx`：汇报幻灯片。
- `演示视频.mp4`：演示视频（脚本与分镜见 `docs/contest/video_script.md`）。
- `test_report.md`、`diff.md`、`commit_history.md`：测试报告、diff 说明与提交历史快照。

## 许可证与合规性说明

原始 xv6 代码保留 MIT License（见 `src/LICENSE`）。团队新增代码采用 BSD-2-Clause License（全文见仓库根目录 `LICENSE`），自有新增源文件以单行 SPDX 注释标注。第三方来源（xv6-loongarch-exp 移植参考、官方测例文件）的逐文件说明见 `docs/contest/compliance.md`。技术文档、PPT 和演示视频说明采用 CC-BY-SA 4.0。

## AI 使用声明

本项目采用“人设计、AI 实现、人把关”的方式使用 AI 工具：AI 在队员给定的设计约束下辅助完成部分实现、测试用例与文档初稿，全部产出均经队员逐行理解、修改与双架构实测通过后才合入。AI 使用说明详见 `docs/contest/ai_usage.md`。
