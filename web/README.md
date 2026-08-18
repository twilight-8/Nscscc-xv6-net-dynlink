# HandsomeOS 教学控制台

[中文](README.md) | [English](README.en.md)

这是参赛内核的配套教学网站。页面把可交互的 xv6 终端、命令执行链、节点参数释义和当前仓库源码上下文放在同一个工作台中。

## 功能

- 在浏览器中使用 xv6 风格终端，支持 RISC-V 与 LoongArch64 视角切换。
- 演示会话维护独立的内存文件系统状态；`mkdir`、重定向写文件、`ln`、`rm`、`mount`、`umount` 与 `cd` 会真实影响该浏览器会话中的后续命令结果。
- 命令执行完成后，依据成功或失败结果生成 `ls`、`cat`、`echo`、`mkdir`、`rm`、`ln`、`mount`、`umount`、`cd` 等命令的执行链；失败命令不会误改教学状态。
- 确定性规则链始终即时展示；启动 AI 后，后端会并行检索当前仓库源码并生成补充分析，不阻塞命令执行和规则链交互。
- AI 完成后由用户点击“显示 AI 分析”查看结果，并可随时切回规则链；失败或超时只影响本次 AI 任务，不影响终端和规则链。
- 按用户态、陷阱、系统调用、文件对象、VFS、具体文件系统、块层/HAL 区分节点。
- 点击节点可查看函数作用、参数/字段含义以及仓库中的真实源码上下文。
- 挂载 ext2 或 FAT32 后，后续路径追踪会自动切换到对应文件系统后端。
- 优先连接 WSL 中的真实 QEMU；环境不完整时自动进入教学演示会话，保证离线 Demo 可用。

## 启动和关闭网站

需要 Windows 上的 Node.js 20 或更高版本。推荐直接使用生产模式。

第一次启动时，在 PowerShell 中依次执行：

```powershell
cd ./web
npm.cmd install
npm.cmd run build
npm.cmd start
```

看到下面的信息表示服务器已经启动（默认端口 4182）：

```text
HandsomeOS teaching server: http://localhost:4182
```

保持这个 PowerShell 窗口开启，然后在浏览器访问 <http://localhost:4182>。PowerShell 停留在运行状态是正常现象，网页中的 xv6 命令应输入右侧教学终端，而不是继续输入到 PowerShell。

关闭网站时，回到运行 `npm.cmd start` 的 PowerShell 窗口并按 `Ctrl+C`。关闭浏览器标签页不会停止网站服务器。

如果出现 `EADDRINUSE`，表示该端口已经有网站进程在运行。可以直接访问对应地址，也可以换一个端口（例如 4187）重新启动：

```powershell
$env:PORT = "4187"
npm.cmd start
```

此时访问 <http://localhost:4187>。

开发模式仅用于修改前端源码时自动刷新。确认默认后端端口 `4182` 没有被占用后执行：

```powershell
npm.cmd run dev
```

开发页面位于 <http://localhost:4180>。普通展示和答辩不需要使用开发模式。

## AI 助教模式

AI 需要完成“配置服务、启动网站、点击网页开关”三个步骤。只配置环境变量并不会自动启动 AI。

第一步，在准备运行网站的同一个 PowerShell 窗口中配置兼容 Chat Completions 格式的模型服务：

```powershell
cd ./web

$env:AI_API_URL = "服务商提供的完整接口地址"
$env:AI_MODEL = "服务商提供的模型名称"
$env:AI_API_KEY = "API密钥"
$env:AI_TIMEOUT_MS = "30000"
$env:AI_THINKING = "disabled"
$env:PORT = "4187"

npm.cmd start
```

第二步，浏览器打开上述端口，例如 <http://localhost:4187>。

第三步，点击调用链区域右上角的“启动 AI”，然后在终端执行命令。规则链会立即显示；AI 完成后再点击“显示 AI 分析”。

关闭 AI 时，点击同一位置的“关闭 AI”；分析过程中该按钮显示“停止 AI”，点击后会取消当前请求并关闭后续后台分析。关闭 AI 不会关闭网站，也不会停止 xv6 终端。

`AI_API_URL` 必须是完整的 Chat Completions 接口地址，`AI_MODEL` 是服务商提供的模型标识。API Key 只保存在启动网站的后端进程中，不会发送到浏览器。云端服务通常需要 `AI_API_KEY`；本地兼容服务允许不设置。对于支持思考开关的 DeepSeek 兼容接口，答辩演示建议设置 `AI_THINKING=disabled`，以缩短响应时间；不支持该字段的服务不要设置它。修改任何 AI 环境变量后，都必须按 `Ctrl+C` 停止原网站，再在同一个 PowerShell 窗口执行 `npm.cmd start`。

页面中的“启动 AI”是后台分析开关。开启后，命令完成时仍立即生成并展示规则链；AI 结果通过源码校验后，页面才出现“显示 AI 分析”按钮。输入新命令、重启会话、切换架构或切换真实/演示模式时，旧 AI 请求会被取消，旧结果不会覆盖新命令。

网站不会直接信任模型给出的源码位置。服务端先收集规则链、用户程序、系统调用入口和相关 VFS/HAL 源码片段；模型返回后，再逐项检查文件是否在证据集合中、符号是否真实存在，并由当前源码重新计算行号。少于三个节点通过校验、请求超时或服务不可用时，规则链照常工作，页面会提供 AI 重试入口。

已启动网站后，可复用本机 Microsoft Edge 执行桌面/手机端自动检查：

```powershell
npm.cmd run qa
```

真实 QEMU 与演示会话连续切换回归：

```powershell
npm.cmd run qa:real
```

该检查默认切换 3 轮；可用 `QA_REAL_ROUNDS` 调整为 1 到 10 轮。若真实运行环境不可用，脚本会说明原因并跳过，不会把演示结果误报为真实 QEMU 结果。

已配置模型服务时，可单独执行一次真实 AI 端到端检查：

```powershell
npm.cmd run qa:ai
```

该检查会实际发送一次 `ls /` 教学分析请求，验证结果按钮、源码校验后的调用链和浏览器渲染；模型不可用时会明确跳过。它不读取或输出 API Key。

演示终端状态回归测试：

```powershell
npm.cmd test
```

若网站不在默认端口，可先设置 `QA_URL`；截图输出到 `web/qa-artifacts/`。

## 真实 QEMU 会话

后端会探测 `Ubuntu-24.04` WSL 发行版中的作品源码、`make` 和 `qemu-system-riscv64`。默认源码映射为仓库的 `src/` 目录。

可通过环境变量覆盖配置：

```powershell
$env:XV6_WSL_DISTRO = "Ubuntu-24.04"
$env:XV6_PROBE_TIMEOUT_MS = "10000"
npm.cmd start
```

探测成功后可在终端工具栏选择“真实 QEMU”。前端会在 WSL 冷启动探测期间自动刷新状态；`XV6_PROBE_TIMEOUT_MS` 可按机器启动速度调整，允许范围为 3500 到 30000 毫秒。探测失败时页面会说明原因并自动回退到演示会话。演示模式是有状态的 xv6/VFS 语义模型，适合稳定展示命令效果与源码调用链，但不冒充真实内核执行；正式功能结论仍以仓库测试日志和真实 QEMU 回归为准。

## 演示流程

在页面终端中逐行执行：

```sh
ls /
mkdir /mnt
mount ext2 /mnt
cat /mnt/hello
mkdir /fat
mount fat32 /fat
ln /fat/HELLO.TXT /fat/LINK.TXT
umount /fat
umount /mnt
```

执行每条命令后，观察左侧的后端标识变化并点击 VFS、文件系统或 HAL 节点。其中 `ln /fat/HELLO.TXT /fat/LINK.TXT` 会展示 FAT32 不支持硬链接时的拒绝链路。
