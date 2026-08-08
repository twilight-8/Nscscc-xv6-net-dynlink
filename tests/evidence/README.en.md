# evidence

[中文](README.md) | [English](README.en.md)

This directory archives the final passing evidence of the key test runs (raw QEMU output and summaries), for reviewers to cross-check and reproduce.  Everything here can be regenerated with `make verify-all`.

## Contents

- `run_all.txt` — full regression summary (16 test points, both archs)
- `usertests-full-riscv.txt` — RISC-V complete usertests raw output
  (without `-q`, including the six slow tests)
- `usertests-full-loongarch.txt` — LoongArch64 complete usertests output
- `smp-riscv.txt` / `smp-loongarch.txt` — CPUS=3 concurrency stress raw
  output (three-way concurrent 1 MiB writes + verification + stressfs
  inside each mount point)
- `bench-riscv.txt` / `bench-loongarch.txt` — vfsbench numbers for the
  three backends on both architectures
- `bench-rev5-baseline.txt` — pristine rev5 under the same workload
  (VFS overhead measurement)
- `bench-fat32-before-opts.txt` / `bench-fat32-nextfree-only.txt` —
  FAT32 allocation/walk states before and between the two optimizations

## How to reproduce

```sh
make verify-all
```

or step by step:

```sh
bash tests/check_env.sh
bash tests/run_all.sh
bash tests/full_usertests.sh riscv
bash tests/full_usertests.sh loongarch
make smp && make run
make loongarch_smp && make run
```
