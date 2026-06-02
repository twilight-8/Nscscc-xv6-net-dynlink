# tests

> 本目录对源码测试进行详细记录。

每个子目录对应一个测试点。当前只有基线测试点：

```text
tests/
└── test_baseline/
    ├── README.md
    ├── src/
    ├── run.sh
    └── logs/
```

## 根目录测试入口

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

- `make test_baseline`：完成基线测试的环境记录、源码清理和基础构建。
- `make run`：运行已准备好的基线测试。

## 当前测试点

- `test_baseline`：对 xv6-riscv rev5 官方基线源码执行 RISC-V `usertests -q` 测试。
