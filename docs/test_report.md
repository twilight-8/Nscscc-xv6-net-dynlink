# 测试报告

本文档记录当前阶段的测试内容、测试命令和测试结果。当前已经完成阶段 A/B/C，并重点验证了两件事：

- 加入 VFS 和 ext2 后，原 xv6 行为不能退化。
- `/mnt` 上的 ext2 最小读写路径必须能通过公开测试风格的跨文件系统复制。

## 1. 测试环境

| 项目 | 内容 |
|---|---|
| 主机环境 | Windows + WSL Ubuntu-24.04 |
| 目标平台 | qemu-riscv64 |
| 源码目录 | `xv6-riscv_src` |
| 主要镜像 | `fs.img` |
| ext2 镜像 | `ext2.img`，追加到 `fs.img` 后半部分 |
| 当前阶段 | A/B/C 已完成，C3 已瘦身复查 |

## 2. 测试总览

| 测试项 | 测试目的 | 命令/方式 | 结果 |
|---|---|---|---|
| 内核构建 | 确认源码可编译 | `make kernel/kernel` | PASS |
| 镜像生成 | 确认 xv6 镜像和 ext2 镜像可生成 | `rm -f fs.img ext2.img && make fs.img` | PASS |
| xv6 原始测试 | 确认未破坏原 xv6 行为 | `python3 test-xv6.py usertests -q` | PASS |
| 公开 VFS 路径模拟 | 确认 `/mnt` ext2 读写可用 | 执行 `test1`、`test2` | PASS |
| ext2 一致性检查 | 确认写入后的 ext2 镜像结构正常 | `e2fsck -fn` | PASS |

## 3. 原始 xv6 回归测试

测试目的：

验证 VFS wrapper、挂载表和 ext2 支持没有破坏 xv6 原有文件系统、进程、内存和系统调用行为。

执行命令：

```sh
cd xv6-riscv_src
python3 test-xv6.py usertests -q
```

关键结果：

```text
ALL TESTS PASSED
```

结论：

原 xv6 自带测试全部通过，说明当前 VFS/ext2 改动没有造成明显行为退化。

## 4. 公开 VFS 测试路径模拟

公开测试的核心行为是围绕 `/mnt/hello.c` 进行跨文件系统复制。我们本地模拟了同样的命令序列：

```sh
cat hello.c > /hello.c
mkdir /mnt
cat hello.c > /mnt/hello.c
test1
test2
```

运行过程：

```mermaid
flowchart LR
    A[hello.c in xv6 root] -->|cat > /hello.c| B[/hello.c<br/>xv6]
    A -->|cat > /mnt/hello.c| C[/mnt/hello.c<br/>ext2]
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

`/mnt` 挂载点、ext2 创建、读、写、截断和跨文件系统复制路径均正常。

## 5. ext2 镜像一致性检查

测试目的：

确认 xv6 内核写入 ext2 后，磁盘结构仍能被标准 ext2 检查工具识别，避免只是在 xv6 内部“看起来能读写”。

执行命令：

```sh
cd xv6-riscv_src
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
/tmp/xv6-ext2-check.img: 11/1024 files, 162/4096 blocks
```

结论：

ext2 镜像结构检查通过，说明当前 ext2 写入逻辑没有破坏基本文件系统一致性。

## 6. 当前测试结论

当前阶段可以确认：

- VFS wrapper 不影响原 xv6 文件系统行为。
- mount table 能正确把 `/mnt` 切换到 ext2 根目录。
- ext2 后端能完成公开测试需要的普通文件创建、读取、写入和截断。
- 原始 xv6 测试与 VFS 公开路径测试可以同时通过。
- ext2 镜像经过写入后仍能通过 `e2fsck -fn` 检查。

## 7. 当前未覆盖内容

这些内容尚未作为当前阶段完成目标：

- fat32 文件系统测试。
- LoongArch 平台测试。
- ext2 完整语义测试，例如复杂目录、link/unlink、权限、时间戳、多块组。
- 长时间压力测试和异常断电恢复测试。

后续进入 fat32 和 HAL 阶段后，需要继续扩展本测试报告。
