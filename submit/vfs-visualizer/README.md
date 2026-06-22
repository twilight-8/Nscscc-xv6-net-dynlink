# VFS Demo Visualizer

这是一个宿主机侧的静态 Web Demo，用于可视化展示当前 xv6 VFS/HAL 项目的阶段性成果。

当前版本做成类似文件夹窗口的界面，先模拟 xv6fs 根目录。可以在页面中创建、删除、重命名和编辑文件，并在底部展示对应的 VFS 调用路径。

## 定位

- 该页面只是 Demo 可视化工具，不是 xv6 内核功能本体。
- 当前文件操作在浏览器内模拟，并保存到 `localStorage`。
- 当前只展示 xv6fs；等 ext2、fat32 和 mount table 完成后，再扩展为三文件系统面板。

## 运行方式

推荐在项目根目录执行：

```sh
cd submit/vfs-visualizer
python3 -m http.server 8080
```

然后在浏览器打开：

```text
http://localhost:8080
```

如果在 Windows PowerShell 中运行，可以使用：

```powershell
cd submit\vfs-visualizer
python -m http.server 8080
```

也可以直接双击打开 `index.html`。当前版本不依赖后端服务和外部资源。

## 当前可展示内容

- 类文件夹窗口的 xv6fs 根目录。
- 创建文件、创建文件夹、重命名、删除、编辑、保存。
- 选择文件或保存文件时展示 VFS 分发路径。
- 当前只模拟 Stage A，后续再接真实 xv6 命令输出。

## 后续扩展

计划在后续阶段加入：

- ext2 `/mnt` 文件系统面板。
- fat32 `/fat32` 文件系统面板。
- 跨文件系统 copy 可视化。
- mount table 状态。
- 公开 VFS `test1/test2` 结果。
- LoongArch/HAL 构建或启动状态。
