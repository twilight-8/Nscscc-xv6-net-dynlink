# smp

[中文](README.md) | [English](README.en.md)

## 目的

在多核（CPUS=3）下对两个文件系统后端施加真实并发压力，验证后端
分配器串行化（C1 修复）与 fat32 链漫游缓存的正确性。

## 覆盖点

- ext2 与 fat32 各一组三路并发：两个后台 `bigfile` + 一个前台
  `bigfile` 同时写 1 MiB 文件，随后逐一 `verify` 逐字节校验。
- `stressfs` 在每个挂载点内运行（4 写 1 读的并发创建/写/删）。
- 修复前基线：fat32 段在本场景下确定性挂死（C1 红灯实证）。

## 关键断言

- expect：两种挂载成功串；`bigfile: ok`（keep/full/verify 全序列）；
  `stressfs starting` ×2；`SMP_DONE`。
- reject：`panic:`、`kerneltrap`、`mount: failed`、`bigfile: FAIL`、
  `cannot`。
- runner 使用 `--cpus 3 --prompt-wait`（静默+提示符双判定，防止
  后台命令早提示导致的输入越位）。

## 关联

- C1（后端分配器 SMP 竞争修复）；fat32 链漫游 O(n²)→O(n) 修复；
  赛题"系统运行稳定"。
