# xv6 VFS and HAL

本项目参加 2026 年全国大学生计算机系统能力大赛操作系统设计赛 OS 功能挑战赛道，赛题为 `proj34 xv6 虚拟文件系统和硬件抽象层的设计与实现`。

我们基于 MIT xv6-riscv rev5，在保持 xv6 小型教学操作的基础上，增加 VFS 和 HAL 功能，使系统支持 xv6、ext2、fat32 文件系统，并支持 RISC-V 与 LoongArch 平台。

## 当前阶段

当前已经完成 VFS、ext2、fat32 和轻量 HAL 的阶段性实现。

RISC-V 平台继续使用 virtio-mmio 块设备读写 `fs.img`；LoongArch64 平台已接入 virtio-pci 块设备，同样可以在 QEMU 中读写 `fs.img`。两个平台均已通过 xv6-riscv rev5 自带 `usertests -q`，并在显式挂载 ext2 后通过 `test1`、`test2`。

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
- Local source: `src/`

## 仓库结构

```text
.
├── README.md
├── .gitignore
├── docs/                     # 仓库的文档说明，对整体设计、测试结果、迭代记录等进行了简要说明
├── tests/                    # 测试样例、脚本和日志说明
├── submit/                   # 竞赛提交材料
└── src/                      # 源码
```

## 文档 `docs/`

> 对 `docs/` 的目录结构进行介绍
 
- `docs/design.md`：整体设计说明。
- `docs/commit_history.md`：版本迭代记录与说明
- `docs/test_report.md`：测试记录的简要说明说明。
- `docs/compliance.md`：合规与来源说明。
- `docs/references.md`：参考资料。
- `docs/ai_usage.md`：AI 使用说明。

## 提交材料 `submit/`

> 对 `submit` 目录结构进行介绍

- `xv6-vfs-hal-final.diff`：最终版本代码与初始 `xv6-riscv rev5` 源码之间的完整 diff。
- `xv6-vfs-hal-final.diff.stat`：上述 diff 的统计摘要。
- `diff.md`：diff 生成方式、总行数和 HAL/VFS 分类统计说明。
- `README.md`：提交材料目录说明。
- `final_slides.pdf`：最终设计文档的pdf版本
- `final_slides.pptx`：团队分工和赛题推进ppt
- `commit_history`：迭代历史
- `test_report`：测试报告
- `演示视频.mp4`：队伍演示视频

## 详细测试材料 `tests/`

> 对 `tests/` 目录结构进行介绍，该目录的详细结构见该目录内的 `README.md`

##### 内容介绍

- `test_baseline/`：xv6官方测试集测试
- `public_vfs/`：赛题公开测试集测试
- `ext2/`：ext2文件系统支持测试
- `fat32/`：fat32文件系统支持测试
- `error/`：输入错指令时的稳定性测试
- `persist/`：镜像写入测试
- `semantics/`：硬链接指令测试

详细执行指令见`tests/`目录内的 `README.md`

##### 测试环境：

- Host OS: WSL2 Ubuntu 24.04 LTS
- Shell: Bash
- Build tools: `make`, `gcc`, `python3`, `perl`, `bc`
- Debug tool: `gdb-multiarch`
- Version control: `git`

##### 目前包括：

- `test_baseline/`：对基础功能进行测试
- `public_vfs/`：对公开 VFS 风格的 `test1/test2` 进行测试

##### 快速开始：

```sh
make test_baseline && make run
```

该命令在 RISC-V QEMU 环境中运行 xv6-riscv rev5 自带 `usertests -q` 回归测试。

手动启动 RISC-V：

```sh
cd src
make qemu
```

手动启动 LoongArch64：

```sh
cd src
make ARCH=loongarch CPUS=1 qemu
```

LoongArch64 当前使用 virtio-pci 块设备访问 `fs.img`。在 shell 中可以执行：

```sh
usertests -q
mkdir /mnt
mount ext2 /mnt 2
cd tests
cat cmds.sh | sh
```

## Docker 环境

仓库根目录提供 `Dockerfile`，镜像内预装 RISC-V / LoongArch64 交叉工具链、QEMU
及全部测试依赖，并已预构建好两个架构的内核与 `fs.img`，开箱即用：

```sh
docker build -t xv6-vfs-hal .
docker run --rm -it xv6-vfs-hal          # 进入容器，工作目录 /xv6
```

容器内可直接运行上述测试与 QEMU 命令（如 `make test_baseline && make run`，
或 `cd src && make qemu` / `make ARCH=loongarch CPUS=1 qemu`）。

注：若拉取 `ubuntu:24.04` 基础镜像超时，可先在 `/etc/docker/daemon.json` 配置
`registry-mirrors` 镜像加速后重启 Docker。

## 许可证与合规性说明

原始 xv6 代码保留 MIT License（见 `src/LICENSE`）。团队新增代码采用 BSD-2-Clause License（全文见仓库根目录 `LICENSE`），自有新增源文件以单行 SPDX 注释标注。第三方来源（xv6-loongarch-exp 移植参考、官方测例文件）的逐文件说明见 `docs/compliance.md`。技术文档、PPT 和演示视频说明采用 CC-BY-SA 4.0。

## AI 使用声明

本项目在确保原创性的基础上使用 AI 工具进行了简单的需求分析和代码审查等工作，所有 AI 建议均由队员人工理解、修改、验证和测试后才予以采用。

AI 使用说明详见：`docs/ai_usage.md`
