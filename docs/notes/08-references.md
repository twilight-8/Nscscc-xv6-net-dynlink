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
| Microsoft FAT Specification (fatgen103) | https://download.microsoft.com/download/1/6/1/161ba512-40e2-4cc9-843a-923143f3456c/fatgen103.doc | fat32 后端实现（BPB、FAT 链、8.3 目录项、LFN 长名；若短链失效可检索 fatgen103.doc） |

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

### 取证要点（2026-08-07 克隆快照实测）

SpringOS（静春山）：

- VFS：`kernel/fs/vfs/` 四个实现文件 file.c 407 + fs.c 101 + inode.c 48 + ops.c 189 = 745 行（不含头文件）；适配层 `kernel/fs/VFS_ext.c` 1090 行。
- 内核总量 30919 行（69 个 .c/.h/.S），其中 lwext4 第三方库 17464 行（56.5%）。
- 仅 EXT4：`kernel/fs/vfs/fs.c` 启动时硬编码 `fs_init(&ext4_fs, ...)`，无其他文件系统后端。
- mount 系统调用：`kernel/syscall/sysfile.c:830` 的 `sys_mount` 与 `:832` 的 `sys_umount2` 均直接 `return 0`；实际挂载在启动时硬编码完成，不暴露给用户态。
- 平台：README 声明 RISC-V/LoongArch 双架构与 VisionFive2、2K1000LA 开发板，含 `make vf2`/`make 2k1000` 目标。
- 测试与文档：`judge/` 评分脚本与 busybox 测例；`doc/` 6 篇 md 及决赛 PDF/PPT。

RuOK：

- C++ 重写，VFS 为抽象基类（`kernel/include/fs/fs.hh` 全纯虚接口）+ dentry 体系；FAT32、ext4、ramfs 三个后端。
- 体量：kernel/hal/hsai/user 合计约 4.9 万行。
- mount 系统调用有完整实现（`kernel/syscall/syscall_handler.cc:996`）。
- 默认 CPUS=1（Makefile 与 QEMU 命令均为 `-smp 1`），未见 SMP 测试证据；仓库内无自动化测试脚本。
- 真机适配：k210 驱动目录在库但 Makefile 中默认注释未启用；2K1000 有适配文档。
- 文档：`doc/` 顶层 13 篇 md（含 `fs/` 子目录共 15 篇）及开发日志 PPT，无最终结题报告。

注：两个参照仓库现已转为私有，以上结论基于 2026-08-07 的克隆快照。
