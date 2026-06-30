# tests

本目录用于保存项目测试样例、测试脚本和测试日志说明。每个子目录对应一个测试点，便于后续把公开测试、自制 ext2 测试、自制 fat32 测试和异常路径测试分开维护。

## 当前结构

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
`-- runner/
    `-- run_qemu_case.py
```

## 根目录测试入口

在仓库根目录执行：

```sh
make test_baseline
make run
```

或：

```sh
make test_public_vfs
make run
```

也可以连写：

```sh
make test_public_vfs && make run
```

其中：

- `make test_baseline`：构建基础镜像，准备运行 xv6 自带 `usertests -q`。
- `make test_public_vfs`：构建包含公开 VFS 测试程序和 ext2/fat32 镜像的 `fs.img`。
- `make run`：运行最近一次准备好的测试点。

## 当前测试点

- `test_baseline`：运行 xv6 自带 `usertests -q`，验证基础行为不退化。
- `public_vfs`：显式 `mount ext2 /mnt` 后运行公开风格 `test1/test2`，验证 ext2 与 xv6 之间的跨文件系统复制。

## 日志

各测试点的 `logs/` 目录用于保存本地运行日志。日志文件属于运行产物，不纳入版本控制；仓库只保留 `logs/README.md`。
