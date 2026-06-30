# VFS Demo Visualizer

这是一个宿主机侧的静态 Web Demo，用于辅助展示 xv6 VFS/HAL 项目的早期 VFS 分发思路。

当前版本做成类似文件夹窗口的界面，先模拟 xv6fs 根目录。可以在页面中创建、删除、重命名和编辑文件，并在底部展示对应的 VFS 调用路径。

## 定位

- 该页面只是 Demo 可视化工具，不是 xv6 内核功能本体。
- 当前文件操作在浏览器内模拟，并保存到 `localStorage`。
- 当前只展示 xv6fs，覆盖范围停留在 Stage A 风格的 VFS 调用路径演示；它没有同步实现内核当前已经完成的 ext2、fat32、mount table 和 HAL 状态。

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
- 当前只模拟 Stage A 风格的 VFS 分发，不代表内核当前功能完成度；内核当前已支持 ext2、fat32、mount table、RISC-V 和 LoongArch64。

## 后续扩展

如继续扩展该可视化工具，可以加入：

- ext2 `/mnt` 文件系统面板。
- fat32 `/fat32` 文件系统面板。
- 跨文件系统 copy 可视化。
- mount table 状态。
- 公开 VFS `test1/test2` 结果。
- LoongArch/HAL 构建或启动状态。
