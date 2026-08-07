# tests

This directory stores project test cases, test scripts, and local test logs.
Each subdirectory is one test point. The root `Makefile` provides a simple
two-step workflow:

```sh
make <name>
make run
```

or:

```sh
make <name> && make run
```

## Layout

```text
tests/
|-- test_baseline/
|   |-- README.md
|   |-- run.sh
|   `-- logs/
|-- public_vfs/
|   |-- README.md
|   |-- cmds.sh
|   |-- run.sh
|   `-- logs/
|-- ext2/
|   |-- README.md
|   |-- cmds.sh
|   |-- run.sh
|   `-- logs/
|-- fat32/
|   |-- README.md
|   |-- cmds.sh
|   |-- run.sh
|   `-- logs/
|-- error/
|   |-- README.md
|   |-- cmds.sh
|   |-- run.sh
|   `-- logs/
|-- semantics/
|   |-- README.md
|   |-- cmds.sh
|   |-- run.sh
|   `-- logs/
|-- persist/
|   |-- README.md
|   |-- write.cmds.sh
|   |-- read.cmds.sh
|   |-- run.sh
|   `-- logs/
|-- smp/
|   |-- README.md
|   |-- cmds.sh
|   |-- run.sh
|   `-- logs/
|-- VFS_TESTS_PIN.txt
|-- check_env.sh
|-- run_all.sh
|-- full_usertests.sh
`-- runner/
    `-- run_qemu_case.py
```

## Test Points

- `test_baseline`: runs xv6 `usertests -q` and checks baseline behavior.
- `public_vfs`: reproduces the pinned upstream VFS evaluation flow (see
  `VFS_TESTS_PIN.txt`): `mount ext2 /mnt`, then `cd tests` and run the
  upstream `cmds.sh`, including the `test1`/`test2` cross-filesystem
  copy cases with their original output strings.
- `ext2`: checks ext2 mount, read, create, overwrite, and unlink through VFS.
- `fat32`: checks FAT32 mount and basic 8.3 short-name create, overwrite, and
  unlink through VFS.
- `error`: checks that invalid VFS operations fail cleanly without panic.
- `semantics`: checks mount-root `..`, ext2 hard link success, FAT32 hard
  link rejection, and unlink-while-open semantics on ext2 and FAT32
  (`unlinkopen`).
- `persist`: writes files to ext2/FAT32, restarts QEMU, remounts, and reads the
  files back from the image.
- `smp`: runs with `--cpus 3`; concurrent bigfile writers on ext2 and FAT32
  with post-write verification, plus `stressfs` inside each mount point.
  Exercises the backend allocator serialization (C1).

## Commands

Run from the repository root:

```sh
make test_baseline && make run
make public_vfs && make run
make ext2 && make run
make fat32 && make run
make error && make run
make semantics && make run
make persist && make run
make smp && make run
```

The old names `make test_public_vfs`, `make test_ext2`, `make test_fat32`, and
`make test_error_path` are kept as compatibility aliases.

## LoongArch Commands

The same test flow can be prepared for LoongArch with short targets:

```sh
make loongarch_baseline && make run
make loongarch_public_vfs && make run
make loongarch_ext2 && make run
make loongarch_fat32 && make run
make loongarch_error && make run
make loongarch_semantics && make run
make loongarch_persist && make run
make loongarch_smp && make run
```

These targets build `src` with `ARCH=loongarch`, record the selected
architecture in `.last-test-arch`, and then `make run` launches the matching
LoongArch QEMU command through the shared runner.

## Manual Dual-Architecture Checks

RISC-V:

```sh
cd src
make ARCH=riscv CPUS=1 qemu
```

LoongArch64:

```sh
cd src
make ARCH=loongarch CPUS=1 qemu
```

After entering the xv6 shell, run:

```sh
usertests -q
mkdir /mnt
mount ext2 /mnt
cd tests
cat cmds.sh | sh
```

## Utility Scripts

- `tests/check_env.sh`: verifies host tools, both cross toolchains, and
  both QEMU emulators; exits non-zero and prints what is missing.
- `tests/run_all.sh`: runs all eight test points on both architectures
  back to back and prints a 16-line PASS/FAIL summary.
- `tests/full_usertests.sh [arch]`: runs the complete `usertests`
  (without `-q`, so the six slow tests `bigdir`, `manywrites`,
  `badwrite`, `execout`, `diskfull`, `outofinodes` are included) in the
  official CPUS=3 QEMU environment, and saves the raw log under
  `test_baseline/logs/`.

## Pre-push Gate

Both of the following must be green before every push to the remote:

```sh
bash tests/run_all.sh                      # 16/16 on both architectures
bash tests/full_usertests.sh riscv         # complete usertests, no -q
bash tests/full_usertests.sh loongarch
```

`make verify-all` runs the whole gate (environment check, all suites,
both complete usertests) with a single command.

## Logs

Each test writes local logs into its own `logs/` directory. Generated `.log`
files are ignored by Git. The `logs/README.md` files are kept so the directory
structure is preserved in the repository.

`test_baseline` shows `usertests -q` output in real time and also saves it to
its log file. The VFS tests (`public_vfs`, `ext2`, `fat32`, and `error`) keep
the terminal concise by default and save raw QEMU output to their log files.
When invoking `tests/runner/run_qemu_case.py` directly, add `--live` if live
QEMU output is needed.
