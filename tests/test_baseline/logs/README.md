# logs

本目录用于保存本地运行 `test_baseline` 时生成的测试日志。

日志文件属于运行产物，不纳入版本控制；仓库只保留本说明文件。

计划生成：

- `env.log`：由 `make test_baseline` 生成，记录环境信息。
- `build.log`：由 `make test_baseline` 生成，记录构建输出。
- `usertests-quick.log`：由 `make run` 生成，记录 `usertests -q` 原始输出。
- `result.log`：由 `make run` 生成，记录本次测试摘要。


当前该测试点已通过。复现方式：

```sh
make test_baseline && make run
```
