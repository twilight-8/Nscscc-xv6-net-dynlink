# logs

本目录用于保存 `public_vfs` 测试运行时生成的本地日志。

日志文件属于运行产物，不纳入版本控制；仓库只保留本说明文件。

计划生成：

- `env.log`：由 `make public_vfs` 生成，记录环境信息。
- `build.log`：由 `make public_vfs` 生成，记录构建输出。
- `qemu-public-vfs.log`：由 `make run` 生成，记录 QEMU 原始输出。
- `result.log`：由 `make run` 生成，记录测试摘要。
