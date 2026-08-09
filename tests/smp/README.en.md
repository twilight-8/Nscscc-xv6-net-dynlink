# smp

[中文](README.md) | [English](README.en.md)

## Purpose

Apply true multi-core (CPUS=3) concurrency pressure to both file-system backends, validating the backend allocator serialization (C1 fix) and the FAT32 chain-walk cache.

## Coverage

- Three-way concurrency on ext2 and on FAT32: two background `bigfile` writers plus one foreground `bigfile`, each writing 1 MiB, followed by byte-by-byte `verify` of every file.
- `stressfs` inside each mount point (4 writers + 1 reader concurrently creating/writing/unlinking).
- Pre-fix baseline: the FAT32 section deterministically hung in this scenario (C1 red evidence).

## Key assertions

- expect: both mount strings; the full `bigfile: ok` sequence (keep/full/verify); `stressfs starting` ×2; `SMP_DONE`.
- reject: `panic:`, `kerneltrap`, `mount: failed`, `bigfile: FAIL`, `cannot`.
- The runner uses `--cpus 3 --prompt-wait` (quiescence + prompt dual detection, preventing input overruns caused by early prompts from background commands).

## Links

- C1 (backend allocator SMP serialization); the FAT32 chain-walk O(n²)→O(n) fix; the contest's stability requirement.
