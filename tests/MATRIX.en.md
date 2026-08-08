# Test Coverage Matrix

[中文](MATRIX.md) | [English](MATRIX.en.md)

Overview of the 8 test points on both architectures.  Final passing evidence for each lives in `tests/evidence/`; entry points are documented in `tests/README.md`.

| Test point | Covered surface | Related requirement/defect | RISC-V | LoongArch |
|---|---|---|---|---|
| test_baseline | stock rev5 usertests (-q) | contest task 3 | PASS | PASS |
| test_baseline (full) | + six slow tests, memory-leak check | contest task 3 (extended) | PASS | PASS |
| public_vfs | official evaluation flow, /tests layout, four-way cross-FS copies | contest task 4 | PASS | PASS |
| ext2 | mount/RW/overwrite/unlink/nested dirs/long-name alias/1 MiB double-indirect/external big file | task 1; D1, D2, D3 | PASS | PASS |
| fat32 | mount/8.3 ops/empty file/nested dirs/three LFN paths | task 1; D4 | PASS | PASS |
| error | invalid mount/cross-FS link/remove-missing | stability; B5 | PASS | PASS |
| semantics | mount-root `..`, ext2 hard link, FAT32 link rejection, unlinkopen ×2 | B2, B3 | PASS | PASS |
| persist | write → reboot → read back (incl. 1 MiB double-indirect across boots) | persistence; D1 | PASS | PASS |
| smp | CPUS=3 three-way concurrent writes + verify + stressfs | stability; C1 | PASS | PASS |

Supplementary verification (not test points):

- `e2fsck -fn` five-pass offline check of the ext2 image: zero errors
  (including post-SMP-stress state).
- vfsbench numbers: VFS overhead, per-backend throughput, FAT32
  optimization before/after — see `tests/evidence/bench-*.txt`.
