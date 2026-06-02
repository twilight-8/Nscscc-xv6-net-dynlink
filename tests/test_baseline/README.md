# test_baseline

> 本测试点用于验证官方 xv6-riscv rev5 基线源码在 RISC-V QEMU 环境中的基础行为。

## 测试目标

在不修改内核功能代码的前提下，运行 xv6 自带的 `usertests -q`，确认后续 VFS/HAL 修改前的基线状态。

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

- `make test_baseline`：记录环境信息，清理并构建 xv6 基线镜像。
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