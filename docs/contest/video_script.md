# 演示视频脚本与关键帧

赛题要求：演示视频需包含①源代码运行环境介绍；②符合任务要求的运行演示效果；③结果说明。本脚本按“每条声明都可在屏幕上直接验证”的原则设计，总时长约 8–9 分钟。

## 录制准备

- 终端：全屏，字体调大（≥16pt），清空历史；深色背景。
- 环境：`bash tests/check_env.sh` 先跑一遍确认工具在位。
- 镜像：录制前 `cd src && make clean && make fs.img`（riscv）保证现场构建。
- 建议工具：asciinema（终端录制，输出可剪辑）或 OBS。

## 分段脚本

### 第 1 段：运行环境介绍（0:00–0:50）

- **画面**：逐条执行 `qemu-system-riscv64 --version`、`qemu-system-loongarch64 --version`、`riscv64-linux-gnu-gcc --version`、`loongarch64-linux-gnu-gcc-14 --version`，最后 `bash tests/check_env.sh`。
- **旁白**：“本项目在 Ubuntu 24.04 上开发，目标平台为 QEMU 的 RISC-V 64 与 LoongArch64 模拟器；这是交叉工具链与模拟器版本，环境自检脚本确认全部在位。”
- **关键帧**：check_env 的全部 OK 输出。

### 第 2 段：一键复现测试体系（0:50–1:40）

- **画面**：`make verify-all` 启动；快进到 `run_all` 汇总表（16/16 PASS）与两个 `ALL TESTS PASSED`。
- **旁白**：“项目所有测试声明可一行命令复现：8 个测试点乘双架构共 16 项回归，加上双架构完整版 usertests。”
- **关键帧**：16/16 汇总表、`verify-all: ALL GREEN`。

### 第 3 段：官方评测流程演示（1:40–3:10）★核心段

- **画面**（RISC-V）：`cd src && make qemu` 启动 → `mkdir /mnt` → `mount ext2 /mnt` → `cd tests` → `ls`（展示 /tests 五文件布局）→ `cat cmds.sh | sh`。
- **旁白**：“这是赛题指定的官方测试流程：启动后手动挂载 ext2，进入 /tests 目录运行官方测例。test1 完成四个方向的跨文件系统复制，test2 复制并读回验证内容。”
- **关键帧**：四条 `test_copy_file(...): succeed` 与 `test_cross_fs_copy(): succeed`；test2 打印的文件内容。

### 第 4 段：三文件系统共存与互操作（3:10–4:40）

- **画面**：再挂 fat32（`mkdir /fat; mount fat32 /fat`）；`cp` 之外用 `cat > ` 做 xv6→ext2、ext2→fat32、fat32→xv6 的互相复制并 `cat` 验证；`ls /mnt /fat` 对照。
- **旁白**：“xv6、ext2、fat32 三个文件系统挂载在同一块虚拟磁盘的不同区段，通过统一 VFS 接口互相操作。”
- **关键帧**：三个系统间互拷后内容一致。

### 第 5 段：功能深度（4:40–6:10）

- **画面**：`bigfile /mnt/big`（1MiB 写入+读回，`bigfile: ok`）；`wc /mnt/hostbig.bin`（外部注入大文件 `0 1 1048576`）；`cat /fat/longfilename.txt`、`cat /fat/shortlong.txt`、`ls /fat`（长名显示）。
- **旁白**：“ext2 支持双重间接块，单文件上限从 268KB 提升到约 64MB，外部工具生成的大文件镜像也可读；fat32 支持长文件名读取，目录列举显示长名。”
- **关键帧**：bigfile ok、wc 精确字节数、长名显示。

### 第 6 段：LoongArch 平台（6:10–7:00）

- **画面**：`make ARCH=loongarch qemu` 启动；重复官方流程（`mount ext2 /mnt; cd tests; cat cmds.sh | sh`）。
- **旁白**：“同一份上层代码在 LoongArch64 平台原样运行，官方测例同样通过。”
- **关键帧**：LoongArch 启动横幅与 succeed 输出。

### 第 7 段：稳定性演示（7:00–8:00）

- **画面**：`make smp && make run`（或播放证据日志）：三路并发写大文件+校验+stressfs；随后展示 `tests/evidence/` 目录列表。
- **旁白**：“多核并发压测下两个文件系统后端均正确完成；所有测试的原始输出归档在 evidence 目录。”
- **关键帧**：SMP_DONE、evidence 目录清单。

### 第 8 段：结果说明（8:00–8:40）

- **画面**：`tests/MATRIX.md` 覆盖矩阵 + diff 统计（`wc -l submit/*.diff` 或 diff.stat）。
- **旁白**：“测试覆盖矩阵与相对 rev5 的增量统计如画面所示；设计、测试报告、合规说明见 docs 目录。”
- **结束语**：“感谢观看。”

## 约定

- 所有演示命令必须在录制前实跑过一遍，杜绝现场翻车；
- 不剪辑掉任何报错——若现场出错，重录该段；
- 旁白只陈述屏幕上可见的事实，不做超出证据的宣称。
