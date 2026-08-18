# 测试报告

本文档记录本项目的测试体系、测试覆盖与测试结果。双架构功能回归和完整 usertests 可用 `make verify-all` 一行命令复现；实时日志写入各测试点 `logs/`，关键最终通过证据归档在 `tests/evidence/`。fsck 与性能结论使用各自章节列出的独立命令和证据，不包含在 `verify-all` 中。

> 本文件同时作为 `submit/test_report.md` 交付快照（2026-08-18 同步），两处内容保持一致。

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
make verify-all            # 环境检查 + 22 项双架构回归 + 双架构完整 usertests
bash tests/run_all.sh      # 11 测试点 × 2 架构，输出 22 行 PASS/FAIL 汇总
```

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

说明：`diskfull`/`outofinodes` 两行是测试设计内的内核提示——故意耗尽资源验证内核能否正确拒绝，随后测试通过。`usertests.c` 定义 69 个命名测试（63 quick + 6 slow），两个架构的完整日志各有 69 个 `test ...` 起始行，最终判定均为 `ALL TESTS PASSED`（原始文件：`tests/evidence/usertests-full-riscv.txt`、`usertests-full-loongarch.txt`）。

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

覆盖：挂载不存在目录；拒绝 `/.`、`/..` 根路径别名；在 CPUS=3 下分别向同一 ext2/fat32 挂载点发起后台与前台请求；验证当前静态单实例后端拒绝同 `fstype` 挂到另一目录，并拒绝不同文件系统叠加到同一路径；随后验证跨文件系统硬链接和删除不存在文件（ext2/fat32 各一）。`mtable.oplock` 将完整 mount 调用串行，后台/前台回归用于证明每组最终只有一个成功；`MOUNTING` 的发布、失败回滚和 unlink 可见性由锁序与状态转换审查保证，不把 shell 测试夸大为确定性屏障测试。真实输出片段：

```text
$ mount ext2 /no_such_dir
mount: failed
$ mount ext2 /.
mount: failed
$ mount fat32 /..
mount: failed
$ mount ext2 /mnt &
mount: ext2 on /mnt dev 2
$ mount ext2 /mnt
mount: failed
$ mount ext2 /mnt2
mount: failed
$ mount fat32 /mnt
mount: failed
$ mount fat32 /fat &
mount: fat32 on /fat dev 3
$ mount fat32 /fat
mount: failed
$ ln /mnt/hello.c /fat/cross.txt
link /mnt/hello.c /fat/cross.txt: failed
$ rm /mnt/no_such_file
rm: /mnt/no_such_file failed to delete
$ echo ERROR_PATH_DONE
ERROR_PATH_DONE
```

判定：runner 对 `mount: failed`、ext2 成功提示和 FAT32 成功提示分别执行精确计数断言；RISC-V 与 LoongArch 均为失败 7/7、ext2 成功 1/1、FAT32 成功 1/1。其余 `failed` 提示必须出现，`ERROR_PATH_DONE` 到达结尾（失败清理后系统仍正常运行），且无 panic。结果：双架构 PASS。

### 3.4 semantics 测试点（tests/semantics）

覆盖：将根文件系统的 `/echo` 分别复制到 ext2/fat32 并直接执行、挂载点 `..` 回父文件系统（ext2 与 fat32 两侧）、ext2 硬链接成功且内容一致、fat32 硬链接显式拒绝、`unlinkopen` 双后端，以及 `umount` 的 cwd busy、成功卸载、下层 xv6 目录恢复、ext2/FAT32 重挂载与数据/ELF 再访问。真实输出片段：

```text
$ cat /echo > /mnt/echo
$ /mnt/echo EXT2_EXEC_OK
EXT2_EXEC_OK
$ cat /echo > /fat/echo
$ /fat/echo FAT32_EXEC_OK
FAT32_EXEC_OK
$ cat /mnt/../parent.txt
VFS_PARENT_OK
$ ln /fat/a.txt /fat/b.txt
link /fat/a.txt /fat/b.txt: failed
$ unlinkopen /mnt/uop.txt
unlinkopen: ok
$ unlinkopen /fat/uop.txt
unlinkopen: ok
$ cd /mnt
$ umount /mnt
umount: busy or invalid
$ cd /
$ umount /mnt
umount: /mnt
$ cat /mnt/base.txt
XV6_MNT_BASE
$ mount ext2 /mnt
mount: ext2 on /mnt dev 2
$ umount /fat
umount: /fat
$ mount fat32 /fat
mount: fat32 on /fat dev 3
$ /fat/echo FAT32_REMOUNT_OK
FAT32_REMOUNT_OK
$ echo UMOUNT_SEMANTICS_OK
UMOUNT_SEMANTICS_OK
```

结果：双架构 PASS。runner 对命令回显和程序真实输出分别计数，因此 RISC-V 与 LoongArch 的 `EXT2_EXEC_OK`、`FAT32_EXEC_OK` 均精确命中 2/2；这证明 `kexec()` 的 ELF 文件头、program header 和可装载段均能经 `vfs_readi()` 从 ext2/FAT32 后端读取。`unlinkopen` 是延迟释放修复（B2）的防复发回归；两次精确 busy 与 `UMOUNT_SEMANTICS_OK` 则验证卸载不会越过 cwd 引用，且重挂载后的后端仍可用。

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

覆盖：ext2/fat32 各一组三路并发（两个后台 `bigfile` 加一个前台 `bigfile`），写后逐一 `verify`；`stressfs` 在每个挂载点内运行；`umountstress` 以 4 个子进程交错执行 lookup 与反复 `mount/umount`，并先验证打开文件必然使卸载 busy。真实输出片段：

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
$ umountstress
UMOUNT_STRESS_OK ext2 80 loops 11 ticks
```

结果：双架构 PASS。修复前基线在同一场景下 fat32 段确定性挂死（后端分配器竞争，详见 `problems.md` P6），修复后作为防复发回归保留；新增卸载压力段在 CPUS=3 下均到达 `UMOUNT_STRESS_OK`，无 panic/kerneltrap 或失败终态。

### 3.7 mount_lifecycle 测试点（tests/mount_lifecycle）

覆盖：非法路径和根目录别名卸载拒绝；错误设备触发 ext2/FAT32 后端初始化失败后的挂载表回滚；挂载点删除保护；FAT32 作为 ext2 子挂载时父挂载 busy；子/父卸载后的下层目录恢复；两个后端重挂载后数据再次可见。该用例使用一条确定性时间线覆盖 `MOUNTING → MOUNTED → MOUNT_UNMOUNTING → FREE` 的成功、拒绝和回滚分支。

runner 精确命中：`umount: busy or invalid` 5/5、`mount: failed` 2/2、两个挂载点删除失败各 1/1；下层与持久化标记分别为 2/2、2/2、3/3、3/3。结果：双架构 PASS。

### 3.8 remount_io 测试点（tests/remount_io）

覆盖：ext2/FAT32 各写入一个 1 MiB 确定性模式文件并立即校验，随后完成三轮卸载/重挂载，每轮对两个文件逐字节复验，并读取 xv6 下层标记。ext2 负载跨越直接块、单间接和双重间接；FAT32 负载形成长簇链。精确断言为 8 次挂载、2 次 `keep`、6 次 `verify` 和 6 次下层读取，总计核验 8 MiB 数据。结果：双架构 PASS。

该结论证明正常卸载/重挂载下的数据完整性和后端重初始化正确，不等价于突然断电下的崩溃一致性保证。

### 3.9 mount_storm 测试点（tests/mount_storm，CPUS=3）

`umountstress` 被参数化后，对 ext2 与 FAT32 运行同构压力：每个后端包含 2 个 lookup/open worker 与 2 个 mount/umount worker，每个 worker 256 轮，两个后端合计 2048 次并发 worker 迭代；开始时还确定性检查打开文件导致 busy，结束后读取探针验证最终拓扑。

结果：双架构 PASS，均出现两个后端专属 `UMOUNT_STRESS_OK`，无 panic、trap、挂载失败或 worker 失败。本轮完整回归单次观测为 RISC-V ext2/FAT32 38/39 ticks、LoongArch 7/7 ticks；ticks 仅用于同环境复现，不作为跨平台性能对比或通过阈值。

## 4. 覆盖矩阵与补充验证

测试点 × 覆盖功能面 × 双架构的完整矩阵见 `tests/MATRIX.md`。补充验证：

- `e2fsck -fn` 对完整回归最后一项 LoongArch `mount_storm` 完成后的 ext2 镜像做五阶段只读校验（inode/块/尺寸、目录结构、目录连通性、链接计数、组汇总），结果为**零错误**，原始输出见 `tests/evidence/e2fsck-final.txt`；
- 官方测例版本锚定与镜像布局已核对（`tests/VFS_TESTS_PIN.txt`、`/tests` 五文件布局）；
- `mtable.oplock` 串行化完整 `mount/umount`；`MOUNT_FREE/MOUNTING/MOUNTED/MOUNT_UNMOUNTING` 四态负责发布、失败回滚、unlink 可见性与卸载隔离。短期 `readers` pin 保护表项指针到 `idup()` 的锁外窗口，长期 busy 复用 `inode.ref`。`mount_lifecycle` 验证确定性状态转换，`mount_storm` 验证双后端并发终态；
- runner 在首条及后续命令前等待 shell 提示符稳定，prompt 超时直接失败；该机制修复了 LoongArch CPUS=3 启动时首字符偶发丢失造成的测试工具假阴性；
- ext2/fat32 冷 inode 使用 acquire 快路径、`ip->lock` 内二次检查和 release 发布；该协议已完成锁序/内存序审查，修复后的双架构 SMP 与完整 usertests 均通过，未出现功能回归。现有测试不宣称确定性命中“同一冷 inode 同时首访”；
- 本轮归档的套件日志扫描无 `panic:`。

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
| mount_lifecycle | PASS | PASS |
| remount_io | PASS | PASS |
| mount_storm | PASS | PASS |
| 完整 usertests（不带 -q） | ALL TESTS PASSED | ALL TESTS PASSED |

本轮最终复测汇总（2026-08-16）：`run_all: PASS (22/22)`；两架构完整 usertests 最近一次归档均输出 `ALL TESTS PASSED`。

## 6. 当前非目标范围

以下为有意保留的边界，理由见 `design.md` 相应章节：

- fat32 LFN 写、rename、symlink、强制/延迟卸载；ext2 三重间接（`i_block[14]` 维持拒读）、多 block group；
- 完整挂载拓扑与祖先覆盖检测：顺序执行“先挂 `/a/b`、再挂 `/a`”仍可能遮蔽前一挂载，列为 P1 限制；
- 崩溃一致性日志（ext2/fat32 写直达换取简单性，取舍说明见 `design.md`）；
- procfs/tmpfs 等额外后端、VFS 对象模型与错误码体系重构。

## 7. 日志与证据文件

- 实时日志：`tests/<case>/logs/`（环境、构建、原始 QEMU 输出、结果摘要），git 忽略；新增三组用例的双架构日志已在本轮实际生成并核验；
- 最终证据：`tests/evidence/`（本轮 run_all 汇总，双架构完整 usertests，以及 SMP、error、semantics、mount_lifecycle、remount_io、mount_storm 原始输出和最终 e2fsck 输出；四份 RISC-V/优化基准为本轮 P0 修复前的历史记录，不代表最终源码性能；误标为 LoongArch 的一份记录仅保留审计，不作为性能证据）；
- 功能回归复现：`make verify-all`，或按 `tests/README.md` 的分步命令执行；fsck 与性能按 `tests/evidence/README.md`、`docs/contest/performance.md` 的独立命令复核。
