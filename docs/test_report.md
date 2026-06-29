# 测试报告

本文档记录当前阶段的测试内容、测试命令和测试结果。当前已经完成阶段 A/B/C/C4/D0-D4，并重点验证了三件事：

- 加入 VFS 和 ext2 后，原 xv6 行为不能退化。
- 显式挂载 ext2 到 `/mnt` 后，ext2 最小读写路径必须能通过公开测试风格的跨文件系统复制。
- 显式挂载 fat32 到 `/fat` 后，fat32 的目录遍历、普通文件创建、读取、覆盖写入和子目录访问可用。
- 引入 HAL 后，RISC-V 回归测试仍通过，LoongArch64 可以在 QEMU 中启动到 shell 并访问 ramdisk 文件系统。

## 1. 测试环境

| 项目 | 内容 |
|---|---|
| 主机环境 | Windows + WSL Ubuntu-24.04 |
| 目标平台 | qemu-riscv64、qemu-system-loongarch64 |
| 源码目录 | `src` |
| 主要镜像 | `fs.img` |
| ext2 镜像 | `ext2.img`，追加到 `fs.img` 后半部分 |
| fat32 镜像 | `fat32.img`，追加到 ext2 区域之后 |
| 当前阶段 | A/B/C/D/E 已完成 |

## 2. 测试总览

| 测试项 | 测试目的 | 命令/方式 | 结果 |
|---|---|---|---|
| 内核构建 | 确认源码可编译 | `make kernel/kernel` | PASS |
| 镜像生成 | 确认 xv6、ext2、fat32 镜像可生成 | `rm -f fs.img ext2.img fat32.img && make fs.img` | PASS |
| xv6 原始测试 | 确认未破坏原 xv6 行为 | `python3 test-xv6.py usertests -q` | PASS |
| 显式挂载 VFS 路径模拟 | 确认 `mount ext2 /mnt` 后 ext2 读写可用 | 执行 `test1`、`test2` | PASS |
| ext2 一致性检查 | 确认写入后的 ext2 镜像结构正常 | `e2fsck -fn` | PASS |
| fat32 镜像接入 | 确认 fat32 镜像已追加且 BPB 可识别 | `mount fat32 /fat` | PASS |
| fat32 最小读写闭环 | 确认 fat32 目录和普通文件读写可用 | `cat/ls/echo/mkdir` 组合测试 | PASS |
| fat32 边界测试 | 确认空文件、覆盖写、跨 cluster、小目录和长文件名拒绝 | D4 命令组 | PASS |
| 项目 baseline 入口 | 确认根目录脚本仍可工作 | `make test_baseline && make run` | PASS |
| LoongArch64 构建 | 确认 LA 内核可编译 | `cd src && make ARCH=loongarch kernel/kernel` | PASS |
| LoongArch64 启动 | 确认 LA 内核可启动到 shell 并访问根目录 | `cd src && make ARCH=loongarch CPUS=1 qemu` 后执行 `ls` | PASS |

## 3. 原始 xv6 回归测试

测试目的：

验证 VFS wrapper、挂载表和 ext2 支持没有破坏 xv6 原有文件系统、进程、内存和系统调用行为。

执行命令：

```sh
cd src
python3 test-xv6.py usertests -q
```

关键结果：

```text
ALL TESTS PASSED
```

结论：

原 xv6 自带测试全部通过，说明当前 VFS/ext2 改动没有造成明显行为退化。

## 4. 公开 VFS 测试路径模拟

公开测试的核心行为是围绕 `/mnt/hello.c` 进行跨文件系统复制。根据题目说明，测试前需要手动挂载 ext2 到 `/mnt`。为匹配 `test1` 一开始从 `/mnt/hello.c` 读取的行为，构建 `ext2.img` 时会预置一份 `hello.c`。

```sh
mkdir /mnt
mount ext2 /mnt
test1
test2
```

运行过程：

```mermaid
flowchart LR
    A[hello.c in xv6 root] --> B[/hello.c<br/>xv6]
    P[ext2.img 预置 hello.c] --> C[/mnt/hello.c<br/>ext2]
    C -->|test1 copy| B
    C -->|test1 copy| D[/tests/hello.c<br/>xv6]
    B -->|test1 copy| C
    D -->|test1 copy| C
    A -->|test2 write/read| C
```

关键输出：

```text
copy /mnt/hello.c -> /hello.c: ok
copy /mnt/hello.c -> /tests/hello.c: ok
copy /hello.c -> /mnt/hello.c: ok
copy /tests/hello.c -> /mnt/hello.c: ok
test1: succeed
test2: succeed
```

结论：

显式 `mount ext2 /mnt` 后，ext2 创建、读、写、截断和跨文件系统复制路径均正常。

## 5. ext2 镜像一致性检查

测试目的：

确认 xv6 内核写入 ext2 后，磁盘结构仍能被标准 ext2 检查工具识别，避免只是在 xv6 内部“看起来能读写”。

执行命令：

```sh
cd src
dd if=fs.img of=/tmp/xv6-ext2-check.img bs=1024 skip=2000 count=4096 status=none
e2fsck -fn /tmp/xv6-ext2-check.img
```

关键结果：

```text
Pass 1: Checking inodes, blocks, and sizes
Pass 2: Checking directory structure
Pass 3: Checking directory connectivity
Pass 4: Checking reference counts
Pass 5: Checking group summary information
```

结论：

ext2 镜像结构检查通过，`e2fsck -fn` 未报告错误，说明当前 ext2 写入逻辑没有破坏基本文件系统一致性。

## 6. fat32 D0-D3 最小读写测试

测试目的：

确认 fat32 镜像已经接入统一磁盘布局，`FAT32DEV` 能正确映射到 `fs.img` 后续区域；同时验证 fat32 后端能完成 8.3 短文件名目录遍历和普通文件读写。

执行命令：

```sh
mkdir /fat
mount fat32 /fat
cat /tests/hello.c > /fat/hello.c
ls /fat
cat /fat/hello.c
echo tiny > /fat/hello.c
cat /fat/hello.c
mkdir /fat/dir
cat /tests/hello.c > /fat/dir/a.c
ls /fat/dir
cat /fat/dir/../dir/a.c
```

关键结果：

```text
mount: fat32 on /fat dev 3
hello.c        2 3 101
Hello, world!
tiny
a.c            2 5 101
```

同时在宿主机检查 `fs.img` 中 fat32 起始偏移处的 BPB：

```text
sig=55aa
type=b'FAT32   '
bps=512 spc=1 fats=2 total=131072 fatsz=1024 root=2
```

结论：

D0-D3 已经完成 fat32 镜像生成、追加、设备映射、BPB 识别、目录遍历、普通文件创建、读取、覆盖写入和子目录访问。当前 fat32 仍刻意限制在短文件名和普通文件路径，不支持长文件名、`unlink/link/rename` 和完整时间戳维护。

## 7. fat32 D4 边界测试

测试目的：

在不扩大功能范围的前提下，确认 fat32 最小实现对常见边界情况是稳定的。

执行命令：

```sh
mkdir /fat
mount fat32 /fat
cat /missing > /fat/empty
ls /fat
echo old > /fat/s.c
echo new > /fat/s.c
cat /fat/s.c
cat /README > /fat/big
wc /fat/big
mkdir /fat/d
echo one > /fat/d/a.c
echo two > /fat/d/b.c
echo tre > /fat/d/c.c
ls /fat/d
echo bad > /fat/toolongname.c
ls /fat
cat /fat/d/../big
```

关键结果：

```text
empty          2 3 0
new
48 334 2473 /fat/big
a.c            2 11 4
b.c            2 12 4
c.c            2 13 4
open /fat/toolongname.c failed
xv6 is a re-implementation
```

结论：

- 空文件可以创建并显示为 0 字节。
- 覆盖写触发 `O_TRUNC` 后内容正确更新。
- 大于单 cluster 的文件可以跨 cluster 读写。
- 小目录中多个短文件名文件可以正常创建和列出。
- 超出 8.3 规则的长文件名会被拒绝，符合当前设计边界。

## 8. 当前测试结论

当前阶段可以确认：

- VFS wrapper 不影响原 xv6 文件系统行为。
- `mkdir` 和 `mount` 职责分离，mount table 能在显式 `mount ext2 /mnt` 后把 `/mnt` 切换到 ext2 根目录。
- ext2 后端能完成公开测试需要的普通文件创建、读取、写入和截断。
- fat32 可以通过显式 `mount fat32 /fat` 接入 VFS，并完成短文件名目录遍历与普通文件读写。
- fat32 边界测试覆盖了空文件、覆盖写、跨 cluster、小目录和长文件名拒绝。
- 原始 xv6 测试与 VFS 公开路径测试可以同时通过。
- ext2 镜像经过写入后仍能通过 `e2fsck -fn` 检查。
- 根目录 baseline 脚本 `make test_baseline && make run` 可以通过。
- LoongArch64 内核可以构建并启动到 shell，`ls` 可读取 ramdisk 中的根目录内容。

## 9. LoongArch64 HAL 启动测试

测试目的：

确认新增 HAL 和 LoongArch64 架构代码可以完成内核启动、进程切换、用户态 shell 进入，以及通过 ramdisk 访问 `fs.img` 内容。

执行命令：

```sh
cd src
make ARCH=loongarch kernel/kernel
make ARCH=loongarch CPUS=1 qemu
```

在 shell 中执行：

```sh
ls
```

结论：

LoongArch64 可以启动到 xv6 shell，并能列出根目录内容。当前 LA 块设备后端是内嵌 ramdisk，写入只影响本次 QEMU 运行期间的内存镜像，不会回写宿主机 `fs.img`。

## 10. 当前未覆盖内容

这些内容尚未作为当前阶段完成目标：

- fat32 长文件名、`unlink/link/rename` 和完整时间戳语义。
- LoongArch64 下的完整 `usertests -q` 和指定 VFS 测试。
- LoongArch64 下持久化写回宿主机 `fs.img` 的 virtio/PCI 块设备支持。
- ext2 完整语义测试，例如复杂目录、link/unlink、权限、时间戳、多块组。
- 长时间压力测试和异常断电恢复测试。

后续扩展 LoongArch64 块设备和完整测试后，需要继续扩展本测试报告。
