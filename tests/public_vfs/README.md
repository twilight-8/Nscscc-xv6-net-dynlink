# public_vfs

本测试点用于复现赛题公开 VFS 测试流程：系统从 xv6 文件系统启动，启动后手动将 ext2 挂载到 `/mnt`，再运行公开风格的 `test1`、`test2` 跨文件系统复制测试。

## 测试目标

- 验证 `mount ext2 /mnt` 是显式挂载，不依赖自动挂载。
- 验证 `/mnt/hello.c` 能从 ext2 中读取。
- 验证 ext2 与 xv6 文件系统之间可以双向复制普通文件。
- 验证测试过程中不会出现 `panic` 或 `kerneltrap`。

## 运行方式

在仓库根目录执行：

```sh
make public_vfs
make run
```

也可以连写：

```sh
make public_vfs && make run
```

其中：

- `make public_vfs`：清理并构建 RISC-V 内核和 `fs.img`，同时生成 ext2/fat32 镜像。
- `make run`：启动 QEMU，读取 `tests/public_vfs/cmds.sh`，自动向 xv6 shell 输入测试命令。

旧入口 `make test_public_vfs` 仍保留为兼容别名。

## 测试命令

实际投喂给 xv6 shell 的命令保存在：

```text
tests/public_vfs/cmds.sh
```

当前命令为：

```sh
mkdir /mnt
mount ext2 /mnt
ls /mnt
test1
test2
echo PUBLIC_VFS_DONE
```

## 判定标准

必须出现：

- `mount: ext2 on /mnt dev 2`
- `test1: succeed`
- `test2: succeed`
- `PUBLIC_VFS_DONE`

不得出现：

- `panic:`
- `kerneltrap`
- `mount: failed`
- `test1: failed`
- `test2: failed`

## 日志

运行日志保存在：

```text
tests/public_vfs/logs/
```

主要文件：

- `env.log`：环境信息。
- `build.log`：构建输出。
- `qemu-public-vfs.log`：QEMU 原始输出。
- `result.log`：测试摘要。
