# tests

This directory stores project test cases, test scripts, and local test logs.
Each subdirectory is one test point. The root `Makefile` provides a simple
two-step workflow:

```sh
make test_<name>
make run
```

or:

```sh
make test_<name> && make run
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
|-- error_path/
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
- `error_path`: checks that invalid VFS operations fail cleanly without panic.

## Commands

Run from the repository root:

```sh
make test_baseline && make run
make test_public_vfs && make run
make test_ext2 && make run
make test_fat32 && make run
make test_error_path && make run
```

## Logs

<<<<<<< HEAD
- `make test_baseline`：构建基础镜像，准备运行 xv6 自带 `usertests -q`。
- `make test_public_vfs`：构建包含公开 VFS 测试程序和 ext2/fat32 镜像的 `fs.img`。
- `make run`：运行最近一次准备好的测试点。

## 当前测试点

- `test_baseline`：运行 xv6 自带 `usertests -q`，验证基础行为不退化。
- `public_vfs`：显式 `mount ext2 /mnt` 后运行公开风格 `test1/test2`，验证 ext2 与 xv6 之间的跨文件系统复制。

## 双架构手动验证

RISC-V：

```sh
cd src
make ARCH=riscv CPUS=1 qemu
```

LoongArch64：

```sh
cd src
make ARCH=loongarch CPUS=1 qemu
```

进入 xv6 shell 后执行：

```sh
usertests -q
mkdir /mnt
mount ext2 /mnt 2
test1
test2
```

当前 RISC-V 与 LoongArch64 均已通过上述 `usertests -q` 和 `test1/test2` 验证。

## 日志

各测试点的 `logs/` 目录用于保存本地运行日志。日志文件属于运行产物，不纳入版本控制；仓库只保留 `logs/README.md`。
=======
Each test writes local logs into its own `logs/` directory. Generated `.log`
files are ignored by Git. The `logs/README.md` files are kept so the directory
structure is preserved in the repository.
>>>>>>> 4169de9 (新增测试)
