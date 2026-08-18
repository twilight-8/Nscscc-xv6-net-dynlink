# 01 xv6 rev5 源码结构导览

本篇是阅读 xv6-riscv rev5 源码时建立的整体地图，按“启动链路”和“子系统分布”两个视角组织。

## 启动链路（RISC-V）

```text
entry.S → start.c: 机器态初始化，设置栈，跳 main
main.c:   依次初始化 console/内存/页表/进程表/中断(hal_intr_init，
          RISC-V 侧转发 PLIC)/缓冲(binit)/inode 表(iinit)/
          文件表(fileinit)/vfsinit/磁盘(hal_disk_init)，
          最后 userinit 创建 init 进程
          （vfsinit 与 hal_* 为本项目新增调用，其余为 rev5 原生步骤）
proc.c:   scheduler() 接管，开始调度
user/init.c: 第一个用户进程，打开 console，exec sh
```

LoongArch 路径结构相同，平台差异在 `arch/loongarch/` 内（entry/start/ vm/tlbrefill/trap/apic/extioi）。

## 内核源码按子系统分布

| 子系统 | 文件 | 职责一句话 |
|---|---|---|
| 进程 | proc.c / swtch.S / trap.c / kernelvec.S | 进程表、调度、上下文切换、陷阱分发 |
| 内存 | kalloc.c / vm.c | 物理页分配、页表管理 |
| 文件系统 | fs.c / log.c / file.c / sysfile.c | inode 缓存与磁盘 inode、写日志、文件描述符、文件类系统调用 |
| 块层 | bio.c / virtio_disk.c | 缓冲区缓存、virtio 块设备驱动 |
| 系统调用 | syscall.c / sysproc.c / usys.pl | 分发表与入口 |
| 并发 | spinlock.c / sleeplock.c | 两类锁原语 |
| 用户支持 | exec.c / pipe.c / printf.c / console.c / uart.c | ELF 装载、管道、内核打印、控制台 |
| 构建 | Makefile / kernel.ld / mkfs/ | 构建、链接脚本、镜像打包 |

## 读代码的顺序建议

1. 先读 `main.c` 的初始化序列，建立全局顺序观；
2. 再读 `sysfile.c` 的一个完整系统调用（如 `sys_open`）自上而下追到`fs.c` 与 `bio.c`；
3. 然后读 `fs.c` 的 inode 缓存（iget/ilock/iupdate/iput 四个函数是本项目后续所有语义修复的锚点）；
4. 最后读 `virtio_disk.c` 的中断完成路径（理解 sleep/wakeup 与 used环的关系——这是 LoongArch 中断缺陷的案发地）。

## 本项目的挂载点

- VFS 分发层接在 `fs.c`/`file.c` 的调用边界上（`vfs.c/vfs.h`）；
- 后端在 `ext2.c`/`fat32.c`，块访问经 `block.c` 的字节偏移接口；
- 平台抽象在 `hal.c` 与 `arch/loongarch/`。
