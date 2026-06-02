# logs

本目录保存 `test_baseline` 的真实测试日志。

计划生成：

- `env.log`：由 `make test_baseline` 生成，记录环境信息。
- `build.log`：由 `make test_baseline` 生成，记录构建输出。
- `usertests-quick.log`：由 `make run` 生成，记录 `usertests -q` 原始输出。
- `result.log`：由 `make run` 生成，记录本次测试摘要。


目前该测试点已通过