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
`-- runner/
    `-- run_qemu_case.py
```

## Test Points

- `test_baseline`: runs xv6 `usertests -q` and checks baseline behavior.
- `public_vfs`: reproduces the public VFS flow: explicit `mount ext2 /mnt`,
  then `test1` and `test2`.
- `ext2`: checks ext2 mount, read, create, overwrite, and unlink through VFS.
- `fat32`: checks FAT32 mount and basic 8.3 short-name create, overwrite, and
  unlink through VFS.
- `error`: checks that invalid VFS operations fail cleanly without panic.

## Commands

Run from the repository root:

```sh
make test_baseline && make run
make public_vfs && make run
make ext2 && make run
make fat32 && make run
make error && make run
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
test1
test2
```

## Logs

Each test writes local logs into its own `logs/` directory. Generated `.log`
files are ignored by Git. The `logs/README.md` files are kept so the directory
structure is preserved in the repository.
