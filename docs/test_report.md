# 测试报告

本文档记录当前项目的测试组织、测试命令、测试覆盖点和测试结果。测试围绕赛题要求展开：在 xv6 原有行为不退化的前提下，验证 VFS、ext2、FAT32 和 LoongArch HAL 的可用性与稳定性。

当前测试样例统一放在 `tests/` 目录下，每个子目录对应一个测试点；根目录 `Makefile` 提供两步式入口：

```sh
make <test-name>
make run
```

也可以合并执行：

```sh
make <test-name> && make run
```

## 1. 测试环境

| 项目 | 内容 |
|---|---|
| 主机环境 | Windows + WSL Ubuntu-24.04 |
| 源码目录 | `src` |
| 测试目录 | `tests` |
| 目标平台 | RISC-V、LoongArch64 |
| RISC-V 模拟器 | `qemu-system-riscv64` |
| LoongArch 模拟器 | `qemu-system-loongarch64` |
| 根文件系统镜像 | `src/fs.img` |
| ext2 镜像 | 构建时追加到 `fs.img`，挂载设备号为 `2` |
| FAT32 镜像 | 构建时追加到 `fs.img`，挂载设备号为 `3` |
| 测试方式 | 自动启动 QEMU，向 xv6 shell 注入命令，检查期望输出和拒绝输出 |

运行测试前进入 WSL：

```sh
wsl -d Ubuntu-24.04
cd /mnt/d/our_Os/project3136859-388873
```

## 2. 测试总览

| 测试项 | 目录 | 主要覆盖点 | RISC-V 命令 | LoongArch 命令 | 判定标志 | 当前结果 |
|---|---|---|---|---|---|---|
| xv6 原始回归测试 | `tests/test_baseline` | `usertests -q`，确认原 xv6 行为不退化 | `make test_baseline && make run` | `make loongarch_baseline && make run` | `ALL TESTS PASSED` | PASS |
| 公开 VFS 风格测试 | `tests/public_vfs` | 显式挂载 ext2 到 `/mnt`，运行 `test1/test2` | `make public_vfs && make run` | `make loongarch_public_vfs && make run` | `test1: succeed`、`test2: succeed` | PASS |
| ext2 基础读写测试 | `tests/ext2` | ext2 挂载、读取、创建、覆盖写、删除 | `make ext2 && make run` | `make loongarch_ext2 && make run` | `EXT2_DONE` | PASS |
| FAT32 基础读写测试 | `tests/fat32` | FAT32 挂载、8.3 短文件名、创建、覆盖写、空文件、删除 | `make fat32 && make run` | `make loongarch_fat32 && make run` | `FAT32_DONE` | PASS |
| 异常路径测试 | `tests/error` | 非法挂载、跨文件系统硬链接、删除不存在文件 | `make error && make run` | `make loongarch_error && make run` | `ERROR_PATH_DONE` | PASS |
| VFS 语义测试 | `tests/semantics` | 挂载点 `..` 语义、ext2 硬链接、FAT32 拒绝硬链接 | `make semantics && make run` | `make loongarch_semantics && make run` | `SEMANTICS_DONE` | PASS |
| 持久化测试 | `tests/persist` | ext2/FAT32 写回 `fs.img`，重启后重新挂载读取 | `make persist && make run` | `make loongarch_persist && make run` | `PERSIST_WRITE_DONE`、`PERSIST_READ_DONE` | PASS |

说明：`tests/*/logs/result.log` 记录最近一次运行结果；若连续切换 RISC-V 和 LoongArch，同一个测试项的 `result.log` 会被最近一次结果覆盖，原始 QEMU 输出保存在对应 `logs/` 目录中。

## 3. 运行命令汇总

RISC-V 全量测试：

```sh
make test_baseline && make run
make public_vfs && make run
make ext2 && make run
make fat32 && make run
make error && make run
make semantics && make run
make persist && make run
```

LoongArch 全量测试：

```sh
make loongarch_baseline && make run
make loongarch_public_vfs && make run
make loongarch_ext2 && make run
make loongarch_fat32 && make run
make loongarch_error && make run
make loongarch_semantics && make run
make loongarch_persist && make run
```

手动进入 QEMU 的命令：

```sh
cd src
make ARCH=riscv CPUS=1 qemu
make ARCH=loongarch CPUS=1 qemu
```

退出 QEMU：

```text
Ctrl-A，然后按 X
```

## 4. 自动化测试原理

根目录 `Makefile` 负责准备测试镜像并记录测试状态：

```text
make ext2
  -> 构建 src/kernel/kernel
  -> 生成 src/fs.img
  -> 记录 .last-test = ext2
  -> 记录 .last-test-arch = riscv 或 loongarch

make run
  -> 读取 .last-test 和 .last-test-arch
  -> 调用对应 tests/<name>/run.sh
  -> run.sh 调用 tests/runner/run_qemu_case.py
  -> 启动 QEMU
  -> 向 xv6 shell 逐条输入 cmds.sh 中的命令
  -> 检查 expect/reject 模式
```

LoongArch 入口的原理是给同一套测试传入 `TEST_ARCH=loongarch`。例如：

```makefile
loongarch_ext2:
	$(MAKE) TEST_ARCH=loongarch ext2
```

随后 `src/Makefile` 会收到 `ARCH=loongarch`，选择 LoongArch 专属启动代码、陷入处理、页表代码、链接脚本和 `qemu-system-loongarch64`。

## 5. xv6 原始回归测试

目录：`tests/test_baseline`

测试命令：

```sh
make test_baseline && make run
make loongarch_baseline && make run
```

测试内容：

- 构建当前内核和 `fs.img`。
- 运行 xv6 自带 `usertests -q`。
- 检查 VFS、ext2、FAT32、HAL 修改没有破坏 xv6 原有系统调用、文件系统、进程和内存管理行为。

判定标准：

| 检查项 | 期望 |
|---|---|
| `usertests -q` | 正常结束 |
| 输出 | 包含 `ALL TESTS PASSED` |
| 内核错误 | 不出现 `panic:`、`kerneltrap` |

结果：PASS。

## 6. 公开 VFS 风格测试

目录：`tests/public_vfs`

测试命令：

```sh
make public_vfs && make run
make loongarch_public_vfs && make run
```

注入 xv6 shell 的命令：

```sh
mkdir /mnt
mount ext2 /mnt
ls /mnt
test1
test2
echo PUBLIC_VFS_DONE
```

测试内容：

| 命令 | 覆盖点 |
|---|---|
| `mkdir /mnt` | 在 xv6 根文件系统创建挂载点 |
| `mount ext2 /mnt` | 显式挂载 ext2 到 `/mnt`，符合公开测试说明 |
| `ls /mnt` | 验证 ext2 根目录可读 |
| `test1` | 验证 xv6 与 ext2 之间的跨文件系统复制 |
| `test2` | 验证从 xv6 文件系统复制文件到 ext2，并读回确认 |
| `echo PUBLIC_VFS_DONE` | 输出自动化完成标志 |

判定标准：

| 类型 | 内容 |
|---|---|
| 必须出现 | `mount: ext2 on /mnt dev 2` |
| 必须出现 | `test1: succeed` |
| 必须出现 | `test2: succeed` |
| 必须出现 | `PUBLIC_VFS_DONE` |
| 不允许出现 | `panic:`、`kerneltrap`、`mount: failed`、`test1: failed`、`test2: failed` |

结果：PASS。

## 7. ext2 基础读写测试

目录：`tests/ext2`

测试命令：

```sh
make ext2 && make run
make loongarch_ext2 && make run
```

注入 xv6 shell 的命令：

```sh
mkdir /mnt
mount ext2 /mnt
cat /mnt/hello.c
echo ext2-first > /mnt/a.txt
cat /mnt/a.txt
echo ext2-second > /mnt/a.txt
cat /mnt/a.txt
rm /mnt/a.txt
echo EXT2_DONE
```

测试内容：

| 命令 | 覆盖点 |
|---|---|
| `mkdir /mnt` | 创建挂载点 |
| `mount ext2 /mnt` | 挂载 ext2 后端 |
| `cat /mnt/hello.c` | 读取 ext2 中预置文件，验证目录查找、inode 加载和文件读 |
| `echo ext2-first > /mnt/a.txt` | 创建 ext2 新文件并写入 |
| `cat /mnt/a.txt` | 写后读验证 |
| `echo ext2-second > /mnt/a.txt` | 覆盖写已有文件 |
| `cat /mnt/a.txt` | 覆盖写后读验证 |
| `rm /mnt/a.txt` | 删除 ext2 文件，验证 `unlink`、目录项清理和块回收路径 |
| `echo EXT2_DONE` | 输出完成标志 |

判定标准：

| 类型 | 内容 |
|---|---|
| 必须出现 | `mount: ext2 on /mnt dev 2` |
| 必须出现 | `Hello, world` |
| 必须出现 | `ext2-first` |
| 必须出现 | `ext2-second` |
| 必须出现 | `EXT2_DONE` |
| 不允许出现 | `panic:`、`kerneltrap`、`mount: failed`、`failed to delete`、`open /mnt/a.txt failed` |

结果：PASS。

## 8. FAT32 基础读写测试

目录：`tests/fat32`

测试命令：

```sh
make fat32 && make run
make loongarch_fat32 && make run
```

注入 xv6 shell 的命令：

```sh
mkdir /fat
mount fat32 /fat
ls /fat
echo fat32-one > /fat/a.txt
cat /fat/a.txt
echo fat32-two > /fat/a.txt
cat /fat/a.txt
echo > /fat/e.txt
cat /fat/e.txt
rm /fat/a.txt
rm /fat/e.txt
echo FAT32_DONE
```

测试内容：

| 命令 | 覆盖点 |
|---|---|
| `mkdir /fat` | 创建 FAT32 挂载点 |
| `mount fat32 /fat` | 挂载 FAT32 后端 |
| `ls /fat` | 读取 FAT32 根目录 |
| `echo fat32-one > /fat/a.txt` | 自动创建 8.3 短文件名文件并写入 |
| `cat /fat/a.txt` | 写后读验证 |
| `echo fat32-two > /fat/a.txt` | 覆盖写已有 FAT32 文件 |
| `cat /fat/a.txt` | 覆盖写后读验证 |
| `echo > /fat/e.txt` | 创建空/极小文件 |
| `cat /fat/e.txt` | 验证空/极小文件读取路径稳定 |
| `rm /fat/a.txt` | 删除普通 FAT32 文件 |
| `rm /fat/e.txt` | 删除空/极小 FAT32 文件 |
| `echo FAT32_DONE` | 输出完成标志 |

判定标准：

| 类型 | 内容 |
|---|---|
| 必须出现 | `mount: fat32 on /fat dev 3` |
| 必须出现 | `fat32-one` |
| 必须出现 | `fat32-two` |
| 必须出现 | `FAT32_DONE` |
| 不允许出现 | `panic:`、`kerneltrap`、`mount: failed`、`failed to delete`、`open /fat/a.txt failed` |

结果：PASS。

说明：当前 FAT32 实现定位为教学型最小实现，测试限定在 8.3 短文件名、普通文件创建、读取、覆盖写和删除；不把长文件名、硬链接、重命名、完整时间戳作为本阶段支持范围。

## 9. 异常路径测试

目录：`tests/error`

测试命令：

```sh
make error && make run
make loongarch_error && make run
```

注入 xv6 shell 的命令：

```sh
mount ext2 /no_such_dir
mkdir /mnt
mkdir /fat
mount ext2 /mnt
mount fat32 /fat
ln /mnt/hello.c /fat/cross.txt
rm /mnt/no_such_file
rm /fat/no_such.txt
echo ERROR_PATH_DONE
```

测试内容：

| 命令 | 覆盖点 |
|---|---|
| `mount ext2 /no_such_dir` | 非法挂载点应失败，不应污染 VFS 状态 |
| `mkdir /mnt`、`mkdir /fat` | 创建合法挂载点 |
| `mount ext2 /mnt` | 失败挂载后 ext2 仍可正常挂载 |
| `mount fat32 /fat` | FAT32 可同时挂载 |
| `ln /mnt/hello.c /fat/cross.txt` | 跨文件系统硬链接应被 VFS 拒绝 |
| `rm /mnt/no_such_file` | 删除 ext2 不存在文件应失败但不崩溃 |
| `rm /fat/no_such.txt` | 删除 FAT32 不存在文件应失败但不崩溃 |
| `echo ERROR_PATH_DONE` | 输出完成标志 |

判定标准：

| 类型 | 内容 |
|---|---|
| 必须出现 | `mount: failed` |
| 必须出现 | `mount: ext2 on /mnt dev 2` |
| 必须出现 | `mount: fat32 on /fat dev 3` |
| 必须出现 | `link /mnt/hello.c /fat/cross.txt: failed` |
| 必须出现 | `rm: /mnt/no_such_file failed to delete` |
| 必须出现 | `rm: /fat/no_such.txt failed to delete` |
| 必须出现 | `ERROR_PATH_DONE` |
| 不允许出现 | `panic:`、`kerneltrap` |

结果：PASS。

## 10. VFS 语义测试

目录：`tests/semantics`

测试命令：

```sh
make semantics && make run
make loongarch_semantics && make run
```

注入 xv6 shell 的命令：

```sh
echo VFS_PARENT_OK > /parent.txt
mkdir /mnt
mkdir /fat
mount ext2 /mnt
mount fat32 /fat
cat /mnt/../parent.txt
cat /fat/../parent.txt
ln /mnt/hello.c /mnt/hlink.c
cat /mnt/hlink.c
echo fat-link > /fat/a.txt
ln /fat/a.txt /fat/b.txt
echo SEMANTICS_DONE
```

测试内容：

| 命令 | 覆盖点 |
|---|---|
| `echo VFS_PARENT_OK > /parent.txt` | 在根文件系统创建父目录验证文件 |
| `mkdir /mnt`、`mkdir /fat` | 创建两个挂载点 |
| `mount ext2 /mnt`、`mount fat32 /fat` | 同时挂载 ext2 和 FAT32 |
| `cat /mnt/../parent.txt` | 验证 ext2 挂载根目录的 `..` 能回到挂载点父目录 |
| `cat /fat/../parent.txt` | 验证 FAT32 挂载根目录的 `..` 能回到挂载点父目录 |
| `ln /mnt/hello.c /mnt/hlink.c` | ext2 同文件系统硬链接应成功 |
| `cat /mnt/hlink.c` | 验证 ext2 硬链接可读 |
| `echo fat-link > /fat/a.txt` | 创建 FAT32 普通文件 |
| `ln /fat/a.txt /fat/b.txt` | FAT32 不支持硬链接，应明确失败 |
| `echo SEMANTICS_DONE` | 输出完成标志 |

判定标准：

| 类型 | 内容 |
|---|---|
| 必须出现 | `mount: ext2 on /mnt dev 2` |
| 必须出现 | `mount: fat32 on /fat dev 3` |
| 必须出现 | `VFS_PARENT_OK` |
| 必须出现 | `Hello, world` |
| 必须出现 | `link /fat/a.txt /fat/b.txt: failed` |
| 必须出现 | `SEMANTICS_DONE` |
| 不允许出现 | `panic:`、`kerneltrap`、`mount: failed`、`link /mnt/hello.c /mnt/hlink.c: failed`、`open /mnt/hlink.c failed` |

结果：PASS。

## 11. 持久化测试

目录：`tests/persist`

测试命令：

```sh
make persist && make run
make loongarch_persist && make run
```

本测试分两轮 QEMU 会话。第一轮写入文件并退出 QEMU；第二轮重新启动 xv6，重新挂载 ext2/FAT32 后读取上一轮写入的文件。

第一轮写入命令：

```sh
mkdir /mnt
mkdir /fat
mount ext2 /mnt
mount fat32 /fat
echo persist-ext2 > /mnt/persist.txt
cat /mnt/persist.txt
echo persist-fat > /fat/p.txt
cat /fat/p.txt
echo PERSIST_WRITE_DONE
```

第二轮读取命令：

```sh
mount ext2 /mnt
mount fat32 /fat
cat /mnt/persist.txt
cat /fat/p.txt
echo PERSIST_READ_DONE
```

测试内容：

| 阶段 | 命令 | 覆盖点 |
|---|---|---|
| 写入阶段 | `echo persist-ext2 > /mnt/persist.txt` | ext2 创建并写入文件 |
| 写入阶段 | `cat /mnt/persist.txt` | ext2 写后立即读取 |
| 写入阶段 | `echo persist-fat > /fat/p.txt` | FAT32 创建并写入文件 |
| 写入阶段 | `cat /fat/p.txt` | FAT32 写后立即读取 |
| 重启阶段 | `mount ext2 /mnt` | 重新挂载 ext2 镜像 |
| 重启阶段 | `mount fat32 /fat` | 重新挂载 FAT32 镜像 |
| 重启阶段 | `cat /mnt/persist.txt` | 验证 ext2 文件写回 `fs.img` |
| 重启阶段 | `cat /fat/p.txt` | 验证 FAT32 文件写回 `fs.img` |

判定标准：

| 类型 | 内容 |
|---|---|
| 第一轮必须出现 | `persist-ext2`、`persist-fat`、`PERSIST_WRITE_DONE` |
| 第二轮必须出现 | `persist-ext2`、`persist-fat`、`PERSIST_READ_DONE` |
| 两轮均必须出现 | `mount: ext2 on /mnt dev 2`、`mount: fat32 on /fat dev 3` |
| 不允许出现 | `panic:`、`kerneltrap`、`mount: failed`、`open /mnt/persist.txt failed`、`open /fat/p.txt failed` |

结果：PASS。

该测试说明 ext2 和 FAT32 的写入不是只停留在内存路径中，而是能够写回到 `fs.img`，退出 QEMU 后再次启动仍可读回。

## 12. 日志与结果文件

每个测试目录下都有 `logs/` 子目录，保存环境、构建、原始 QEMU 输出和结果摘要。

| 文件 | 含义 |
|---|---|
| `tests/<case>/logs/env.log` | 测试环境、工具链、Git 状态 |
| `tests/<case>/logs/build.log` | 构建内核和镜像的输出 |
| `tests/<case>/logs/qemu-*.log` | 原始 QEMU 输出 |
| `tests/<case>/logs/result.log` | 自动化测试结果摘要 |

`test_baseline` 会实时显示 `usertests -q` 输出，并同步保存到日志；其余 VFS 测试默认保持终端简洁，只显示注入命令、期望检查和最终结果，完整 QEMU 输出保存到日志中。

## 13. 当前测试结论

当前测试体系覆盖了赛题要求中的核心路径：

- RISC-V 和 LoongArch 均可通过统一入口构建、启动和运行测试。
- xv6 原始 `usertests -q` 通过，说明 VFS/HAL 修改没有破坏原有系统行为。
- ext2 可以显式挂载到 `/mnt`，并支持公开测试需要的读取、创建、写入、覆盖、删除和跨文件系统复制路径。
- FAT32 可以显式挂载到 `/fat`，并支持 8.3 短文件名下的基础创建、读取、覆盖写、空文件和删除。
- VFS 能正确拒绝非法挂载、跨文件系统硬链接和不存在文件删除等异常路径，系统保持稳定。
- 挂载点 `..` 语义、ext2 硬链接成功路径、FAT32 硬链接拒绝路径均已测试。
- ext2/FAT32 写入内容可以在 QEMU 重启后重新挂载读回，说明镜像写回路径可用。

## 14. 当前未覆盖或非目标范围

以下内容不是当前教学型最小实现的重点，文档中明确为非目标或后续扩展项：

- FAT32 长文件名、硬链接、重命名、完整时间戳维护。
- ext2 多 block group、复杂权限、完整 POSIX 语义、崩溃一致性恢复。
- 断电恢复、长时间压力测试和随机化文件系统测试。
- 多核并发文件系统压力测试。

当前方案的重点是保持代码精巧，在公开测试和展示路径上证明 VFS 抽象、ext2/FAT32 后端、RISC-V/LoongArch 双平台运行路径稳定可用。
