# Test Report

> 本文件对测试内容以及测试结果进行简要介绍。

## 当前测试点

| 测试点 | 测试内容 | 平台 | 状态 | 运行命令 |
|---|---|---|---|---|
| `test_baseline` | xv6-riscv rev5 官方基线 `usertests -q` | RISC-V | PASS | `make test_baseline && make run` |
| `vfs_stage_a` | 薄 VFS wrapper 接入后回归 `usertests -q` | RISC-V | PASS | `cd xv6-riscv_src && python3 test-xv6.py usertests -q` |

## 阶段 A 测试记录

本阶段新增 VFS wrapper，但底层仍然转发到 xv6 原文件系统，因此主要验证目标是“不破坏原有行为”。

执行命令：

```sh
cd xv6-riscv_src
make clean && make kernel/kernel
python3 test-xv6.py usertests -q
```

结果：

```text
make kernel/kernel: PASS
usertests -q: ALL TESTS PASSED
```

结论：阶段 A 的 VFS 骨架没有导致 xv6 自带测试退化，可以进入 mount table 与 block layer 阶段。
