# 测试报告

本文档记录本项目的测试体系、测试覆盖与测试结果。全部结论均有原始日志支撑：实时日志在各测试点 `logs/` 目录，最终通过证据归档在 `tests/evidence/`，并可用 `make verify-all` 一行命令复现。

## 1. 测试环境与复现入口

| 项目 | 内容 |
|---|---|
| 宿主机 | Ubuntu 24.04（内核构建与 QEMU 运行环境） |
| 目标平台 | qemu-system-riscv64、qemu-system-loongarch64（8.2.2） |
| 交叉工具链 | riscv64-linux-gnu-gcc、loongarch64-linux-gnu-gcc-14 |
| 镜像工具 | mkfs.ext2 / debugfs（e2fsprogs）、自研 mkfat32 |
| 代码目录 | `src/`；测试编排目录 `tests/` |

环境自检：

```sh
bash tests/check_env.sh    # 全部工具在位输出 OK，任一缺失给出明确提示
```

统一复现入口：

```sh
make verify-all            # 环境检查 + 16 项双架构回归 + 双架构完整 usertests
bash tests/run_all.sh      # 8 测试点 × 2 架构，输出 16 行 PASS/FAIL 汇总
```

推送前门禁（项目内部纪律）：`run_all` 与两个架构的完整 usertests 全部通过才允许推送，本报告记录的全部结果均在该门禁下产出。

## 2. 官方测例执行结果

### 2.1 xv6 自带测例（赛题任务 3）

以官方入口 `test-xv6.py` 执行 `usertests -q`（CPUS=3），并另行执行不带 `-q` 的完整版（含 bigdir、manywrites、badwrite、execout、diskfull、outofinodes 六项慢测试与内存泄漏检查）。原始输出（RISC-V 完整版尾部）：

```text
test bigdir: OK
test manywrites: OK
test badwrite: OK
test execout: OK
test diskfull: balloc: out of blocks
test outofinodes: ialloc: no inodes
ALL TESTS PASSED
```

说明：`diskfull`/`outofinodes` 两行是测试设计内的内核提示——故意耗尽资源验证内核能否正确拒绝，随后测试通过。两个架构的完整版判定行均为 `ALL TESTS PASSED`，OK 计数各 60 项（原始文件：`tests/evidence/usertests-full-riscv.txt`、`usertests-full-loongarch.txt`）。

### 2.2 官方 VFS 测例（赛题任务 4）

官方测例四个文件（test1.c、test2.c、cmds.sh、hello.c）逐字节引入并锚定版本（`tests/VFS_TESTS_PIN.txt`，上游 commit `21a6ac68`）。镜像 `/tests` 目录按官方参考布局放置 cmds.sh、hello.c、test1、test2、hello。按官方参考流程执行——启动后手动挂载 ext2，`cd tests; cat cmds.sh | sh`。真实终端输出（RISC-V）：

```text
$ mount ext2 /mnt
mount: ext2 on /mnt dev 2
$ cd tests
$ ls
.              1 4 112
..             1 1 1024
cmds.sh        2 5 73
hello.c        2 6 96
test1          2 7 40480
test2          2 8 40392
hello          2 9 33416
$ cat cmds.sh | sh
$ $ mkdir: /mnt failed to create
$ $
--------- test1: begin... -----------------{
test_copy_file(/mnt/hello.c,/hello.c): succeed
test_copy_file(/mnt/hello.c,/tests/hello.c): succeed
test_copy_file(/hello.c,/mnt/hello.c): succeed
test_copy_file(/tests/hello.c,/mnt/hello.c): succeed
----------- test1: finished -----------------}
$
--------- test2: begin... ---------------------{
将从 xv6 文件系统复制文件到 EXT2 文件系统

✓ 文件复制成功！

验证复制结果:
✓ 复制成功！文件内容:
#include "kernel/types.h"
#include "user/user.h"
void main () {
  printf ("Hello, world!\n");
}

现在您可以用以下命令查看复制的文件:
cat /mnt/hello.c
test_cross_fs_copy(): succeed
--------- test2: finished -------------------}
```

LoongArch 输出与上述一致。四条 `test_copy_file(...): succeed` 覆盖 ext2↔xv6 四个方向的复制，test2 复制后读回验证内容并逐字节打印。输出与官方仓库 README 中的参考输出逐字节一致（含 `$ $` 提示符回声与 `mkdir: /mnt failed to create` 这一官方流程固有提示）。

## 3. 自拟测试点逐项结果

### 3.1 ext2 测试点（tests/ext2）

覆盖：显式挂载、预置文件读取、长名文件读取（`verylongfilename.txt` 经截断别名）、创建/覆盖/删除、嵌套目录（`mkdir d1/d2`）、1 MiB 大文件写入并逐字节读回（`bigfile`，覆盖直接块+单间接+双重间接全路径及释放路径）、外部注入 1 MiB 文件（`hostbig.bin`，必含双重间接块）以 `wc` 校验全量可读。真实输出片段：

```text
$ bigfile /mnt/bigfile
bigfile: ok (1048576 bytes, full)
$ wc /mnt/hostbig.bin
0 1 1048576 /mnt/hostbig.bin
```

判定：挂载串、内容串、`bigfile: ok`、`0 1 1048576` 必须出现；`panic:`、`kerneltrap`、`cannot stat`、`bigfile: FAIL` 不得出现。结果：双架构 PASS。

### 3.2 fat32 测试点（tests/fat32）

覆盖：显式挂载、8.3 短名创建/覆盖/删除、空文件、嵌套目录、FAT32 长文件名（LFN）三条访问路径与目录列举。真实输出片段：

```text
$ ls /fat
longfilename.t 2 3 13
ShortLong.txt  2 4 13
$ cat /fat/longfilename.txt
fat32-lfn-ok
$ cat /fat/shortlong.txt
fat32-lfn-ok
$ cat /fat/longfi~1.txt
fat32-lfn-ok
```

16 字符全名经 namei 截断后由别名规则命中；小写查询命中混合大小写 LFN（大小写不敏感）；8.3 残名兼容可用；`ls` 显示装配长名而非残名。另设负断言：残名 `LONGFI~1` 不得出现在 `ls` 输出中。结果：双架构 PASS。

### 3.3 error 测试点（tests/error）

覆盖：挂载不存在目录、跨文件系统硬链接、删除不存在文件（ext2/fat32 各一）。真实输出片段：

```text
$ mount ext2 /no_such_dir
mount: failed
$ ln /mnt/hello.c /fat/cross.txt
link /mnt/hello.c /fat/cross.txt: failed
$ rm /mnt/no_such_file
rm: /mnt/no_such_file failed to delete
$ echo ERROR_PATH_DONE
ERROR_PATH_DONE
```

判定：各 `failed` 提示必须出现，`ERROR_PATH_DONE` 到达结尾（系统仍在正常运行），无 panic。结果：双架构 PASS。

### 3.4 semantics 测试点（tests/semantics）

覆盖：挂载点 `..` 回父文件系统（ext2 与 fat32 两侧）、ext2 硬链接成功且内容一致、fat32 硬链接显式拒绝、`unlinkopen`（打开中的文件 unlink 后仍可读写，最后一次 close 才释放）双后端。真实输出片段：

```text
$ cat /mnt/../parent.txt
VFS_PARENT_OK
$ ln /fat/a.txt /fat/b.txt
link /fat/a.txt /fat/b.txt: failed
$ unlinkopen /mnt/uop.txt
unlinkopen: ok
$ unlinkopen /fat/uop.txt
unlinkopen: ok
```

结果：双架构 PASS。`unlinkopen` 同时是 unlink 延迟释放修复（B2）的防复发回归。

### 3.5 persist 测试点（tests/persist）

双会话设计：第一段会话写入 `persist.txt`/`p.txt` 并以 `bigfile keep` 写入 1 MiB 双间接文件；关闭并重启 QEMU 后第二段会话重新挂载，读回全部文件并以 `bigfile verify` 逐字节校验。真实输出片段：

```text
$ bigfile /mnt/bigfile verify
bigfile: ok (1048576 bytes, verify)
$ wc /mnt/hostbig.bin
0 1 1048576 /mnt/hostbig.bin
```

结果：双架构 PASS。该测试证明写入经 virtio 块设备真实落盘到 `fs.img`，而非停留在内存路径。

### 3.6 smp 测试点（tests/smp，CPUS=3）

覆盖：ext2/fat32 各一组三路并发（两个后台 `bigfile` 加一个前台 `bigfile`），写后逐一 `verify`；`stressfs` 在每个挂载点内运行。真实输出片段：

```text
$ bigfile /fat/a keep &
$ bigfile /fat/b keep &
$ bigfile /fat/solo
bigfile: ok (1048576 bytes, keep)
bigfile: ok (1048576 bytes, keep)
bigfile: ok (1048576 bytes, full)
$ bigfile /fat/a verify
bigfile: ok (1048576 bytes, verify)
$ bigfile /fat/b verify
bigfile: ok (1048576 bytes, verify)
```

结果：双架构 PASS。修复前基线在同一场景下 fat32 段确定性挂死（后端分配器竞争，详见 `problems.md` P6），修复后作为防复发回归保留。

## 4. 覆盖矩阵与补充验证

测试点 × 覆盖功能面 × 双架构的完整矩阵见 `tests/MATRIX.md`。补充验证：

- `e2fsck -fn` 对最终 ext2 镜像做五阶段只读校验（inode/块/尺寸、目录结构、目录连通性、链接计数、组汇总），结果为**零错误**，含 SMP 压测后的镜像状态；
- 官方测例版本锚定与镜像布局已核对（`tests/VFS_TESTS_PIN.txt`、`/tests` 五文件布局）；
- 全部套件日志扫描无 `panic:`。

## 5. 结果汇总

| 项目 | RISC-V | LoongArch |
|---|---|---|
| test_baseline（usertests -q） | PASS | PASS |
| public_vfs | PASS | PASS |
| ext2 | PASS | PASS |
| fat32 | PASS | PASS |
| error | PASS | PASS |
| semantics | PASS | PASS |
| persist | PASS | PASS |
| smp | PASS | PASS |
| 完整 usertests（不带 -q） | ALL TESTS PASSED | ALL TESTS PASSED |

汇总：`run_all: PASS (16/16)`。

## 6. 当前非目标范围

以下为有意保留的边界，理由见 `design.md` 相应章节：

- fat32 LFN 写、rename、symlink、umount；ext2 三重间接（`i_block[14]` 维持拒读）、多 block group；
- 崩溃一致性日志（ext2/fat32 写直达换取简单性，取舍说明见 `design.md`）；
- procfs/tmpfs 等额外后端、VFS 对象模型与错误码体系重构。

## 7. 日志与证据文件

- 实时日志：`tests/<case>/logs/`（环境、构建、原始 QEMU 输出、结果摘要），git 忽略；
- 最终证据：`tests/evidence/`（run_all 汇总、双架构完整 usertests、双架构 SMP 原始输出、五份基准日志）；
- 复现方式：`make verify-all`，或按 `tests/README.md` 的分步命令执行。
