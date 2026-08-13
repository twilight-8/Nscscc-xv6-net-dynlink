# HandsomeOS 教学控制台

这是参赛内核的配套教学网站。页面把可交互的 xv6 终端、命令执行链、节点参数释义和当前仓库源码上下文放在同一个工作台中。

## 功能

- 在浏览器中使用 xv6 风格终端，支持 RISC-V 与 LoongArch64 视角切换。
- 执行 `ls`、`cat`、`echo`、`mkdir`、`rm`、`ln`、`mount`、`cd` 等命令后，自动生成对应执行链。
- 按用户态、陷阱、系统调用、文件对象、VFS、具体文件系统、块层/HAL 区分节点。
- 点击节点可查看函数作用、参数/字段含义以及仓库中的真实源码上下文。
- 挂载 ext2 或 FAT32 后，后续路径追踪会自动切换到对应文件系统后端。
- 优先连接 WSL 中的真实 QEMU；环境不完整时自动进入教学演示会话，保证离线 Demo 可用。

## 启动

需要 Windows 上的 Node.js 20 或更高版本。在 PowerShell 中执行：

```powershell
cd web
npm.cmd install
npm.cmd run dev
```

开发页面默认位于 <http://localhost:4180>，后端位于 `4182`。如果 PowerShell 允许执行 npm 脚本，也可以把 `npm.cmd` 写成 `npm`。

生产模式：

```powershell
cd web
npm.cmd run build
npm.cmd start
```

访问 <http://localhost:4182>。

已启动网站后，可复用本机 Microsoft Edge 执行桌面/手机端自动检查：

```powershell
npm.cmd run qa
```

若网站不在默认端口，可先设置 `QA_URL`；截图输出到 `web/qa-artifacts/`。

## 真实 QEMU 会话

后端会探测 `Ubuntu-24.04` WSL 发行版中的作品源码、`make` 和 `qemu-system-riscv64`。默认源码映射为仓库的 `src/` 目录。

可通过环境变量覆盖配置：

```powershell
$env:XV6_WSL_DISTRO = "Ubuntu-24.04"
$env:PORT = "4182"
npm.cmd start
```

探测成功后可在终端工具栏选择“真实 QEMU”。否则页面会说明原因并自动回退到演示会话。演示会话用于教学和答辩展示，不等同于真实内核运行结果；正式功能结论仍以仓库测试日志和真实 QEMU 回归为准。

## 推荐演示流程

在页面终端中逐行执行：

```sh
ls /
mkdir /mnt
mount ext2 /mnt
cat /mnt/hello
mkdir /fat
mount fat32 /fat
ln /fat/HELLO.TXT /fat/LINK.TXT
```

执行每条命令后，观察左侧的后端标识变化并点击 VFS、文件系统或 HAL 节点。最后一条命令会展示 FAT32 不支持硬链接时的拒绝链路。
