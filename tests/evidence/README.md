# evidence

[中文](README.md) | [English](README.en.md)

本目录归档关键测试的最终通过证据（原始 QEMU 输出与汇总），供评审复核与复现对照。所有内容均可通过 `make verify-all` 重新生成。

## 内容

- `run_all.txt` — 全量回归汇总（双架构 16 项测试点）
- `usertests-full-riscv.txt` — RISC-V 完整 usertests 原始输出（不带 -q，含 6 项慢测试）
- `usertests-full-loongarch.txt` — LoongArch64 完整 usertests 原始输出
- `smp-riscv.txt` / `smp-loongarch.txt` — CPUS=3 并发压测原始输出（ext2/fat32 三路并发大文件写入 + 校验 + 挂载点内 stressfs）
- `bench-riscv.txt` / `bench-loongarch.txt` — vfsbench 三后端基准（双架构）
- `bench-rev5-baseline.txt` — 原版 rev5 同负载对照（VFS 开销量化）
- `bench-fat32-before-opts.txt` / `bench-fat32-nextfree-only.txt` — fat32 两项分配/漫游优化前与中间态对照

## 复现方法

```sh
make verify-all
```

或分步：

```sh
bash tests/check_env.sh
bash tests/run_all.sh
bash tests/full_usertests.sh riscv
bash tests/full_usertests.sh loongarch
make smp && make run
make loongarch_smp && make run
```
