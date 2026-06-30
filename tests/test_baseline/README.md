# test_baseline

> 本测试点用于对当前改造后的项目运行 xv6-riscv rev5 自带回归测试，确认原有行为不退化。

## 测试目标

运行 xv6 自带的 `usertests -q`，确认当前 VFS/HAL/ext2/fat32 改动没有破坏 xv6 原有进程、内存、文件系统和系统调用行为。

## 运行方式

在仓库根目录执行：

```sh
make test_baseline
make run
```

也可以连写为：

```sh
make test_baseline && make run
```

其中：

- `make test_baseline`：记录环境信息，清理并构建当前项目镜像。
- `make run`：启动 QEMU，运行 xv6 自带 `usertests -q`。

## 日志

日志保存到：

```text
tests/test_baseline/logs/
```

## 测试环境

- Host OS: WSL2 Ubuntu 24.04 LTS
- Shell: Bash
- Build tools: `make`, `gcc`, `python3`, `perl`, `bc`
- Debug tool: `gdb-multiarch`
- Version control: `git`

## 测试结果

通过
