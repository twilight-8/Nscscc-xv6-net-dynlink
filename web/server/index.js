import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { DemoShell } from './demo-shell.js';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const PORT = Number(process.env.PORT || 4182);
const WSL_DISTRO = process.env.XV6_WSL_DISTRO || 'Ubuntu-24.04';

const app = express();
app.use('/project-assets', express.static(path.join(REPO_ROOT, 'outputs')));

function toWslPath(windowsPath) {
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(windowsPath);
  if (!match) return windowsPath.replaceAll('\\', '/');
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll('\\', '/')}`;
}

const runtimeInfo = {
  realAvailable: false,
  probing: true,
  distro: WSL_DISTRO,
  source: toWslPath(path.join(REPO_ROOT, 'src')),
  reason: '正在后台探测 WSL、make 与 QEMU',
};

function probeRuntime() {
  const command = `test -d '${runtimeInfo.source}' && command -v make >/dev/null && command -v qemu-system-riscv64 >/dev/null`;
  const probe = spawn('wsl.exe', ['-d', WSL_DISTRO, 'bash', '-lc', command], {
    stdio: 'ignore',
    windowsHide: true,
  });
  let finished = false;
  const finish = (available) => {
    if (finished) return;
    finished = true;
    runtimeInfo.realAvailable = available;
    runtimeInfo.probing = false;
    runtimeInfo.reason = available ? '' : 'WSL 中未检测到完整的 make / QEMU 运行环境';
  };
  const timer = setTimeout(() => {
    finish(false);
    probe.kill();
  }, 3500);
  probe.on('error', () => { clearTimeout(timer); finish(false); });
  probe.on('exit', (code) => { clearTimeout(timer); finish(code === 0); });
}

probeRuntime();
app.get('/api/runtime', (_request, response) => response.json(runtimeInfo));

app.get('/api/source', (request, response) => {
  const relative = String(request.query.file || '').replaceAll('\\', '/');
  const line = Math.max(1, Number(request.query.line || 1));
  const candidate = path.resolve(REPO_ROOT, relative);
  const allowed = ['.c', '.h', '.S', '.pl', '.md'];

  if (!candidate.startsWith(`${REPO_ROOT}${path.sep}`) || !allowed.includes(path.extname(candidate)))
    return response.status(400).json({ error: '不允许读取该路径' });
  if (!fs.existsSync(candidate)) return response.status(404).json({ error: '源码文件不存在' });

  const lines = fs.readFileSync(candidate, 'utf8').split(/\r?\n/);
  const start = Math.max(1, line - 6);
  const end = Math.min(lines.length, line + 9);
  response.json({
    file: relative,
    focus: line,
    start,
    lines: lines.slice(start - 1, end).map((text, index) => ({ number: start + index, text })),
  });
});

if (fs.existsSync(path.join(WEB_ROOT, 'dist'))) {
  app.use(express.static(path.join(WEB_ROOT, 'dist')));
  app.use((_request, response) => response.sendFile(path.join(WEB_ROOT, 'dist', 'index.html')));
}

const server = createServer(app);
const terminalServer = new WebSocketServer({ server, path: '/terminal' });

terminalServer.on('connection', (socket) => {
  let child = null;
  let demo = null;
  let mode = 'idle';

  const emit = (type, payload = {}) => {
    // ws uses 1 for OPEN; using the explicit protocol value also works across
    // ws versions where OPEN is exposed only on the WebSocket constructor.
    if (socket.readyState === 1) socket.send(JSON.stringify({ type, ...payload }));
  };
  const stop = () => {
    if (child && !child.killed) {
      child.stdin.write('\x01x');
      setTimeout(() => child && !child.killed && child.kill(), 500);
    }
    child = null;
    demo = null;
    mode = 'idle';
  };
  const startDemo = (arch, note = '') => {
    stop();
    mode = 'demo';
    demo = new DemoShell((data) => emit('output', { data }), arch);
    emit('status', { mode, state: 'running', note });
    demo.boot();
  };
  const startReal = (arch) => {
    stop();
    if (!runtimeInfo.realAvailable) return startDemo(arch, runtimeInfo.reason);

    mode = 'real';
    const makeArgs = arch === 'loongarch' ? 'ARCH=loongarch CPUS=1 qemu' : 'ARCH=riscv CPUS=3 qemu';
    const command = `cd '${runtimeInfo.source}' && exec make ${makeArgs}`;
    child = spawn('wsl.exe', ['-d', WSL_DISTRO, 'bash', '-lc', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    emit('status', { mode, state: 'booting', note: `通过 ${WSL_DISTRO} 启动 QEMU` });
    child.stdout.on('data', (data) => emit('output', { data: data.toString() }));
    child.stderr.on('data', (data) => emit('output', { data: data.toString() }));
    child.on('error', (error) => startDemo(arch, `真实会话启动失败：${error.message}`));
    child.on('exit', (code) => {
      if (mode === 'real') {
        emit('output', { data: `\r\n[QEMU 已退出，状态码 ${code ?? 'unknown'}]\r\n` });
        emit('status', { mode: 'real', state: 'stopped', note: '可重新启动内核' });
      }
      child = null;
    });
  };

  emit('ready', { runtime: runtimeInfo });
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === 'start') {
      if (message.mode === 'real') startReal(message.arch || 'riscv');
      else startDemo(message.arch || 'riscv');
    } else if (message.type === 'input') {
      if (mode === 'real' && child?.stdin.writable) child.stdin.write(message.data);
      else if (mode === 'demo') demo.input(message.data);
    } else if (message.type === 'stop') {
      stop();
      emit('status', { mode: 'demo', state: 'stopped', note: '可重新启动内核会话' });
    }
  });
  socket.on('close', stop);
});

server.listen(PORT, () => {
  console.log(`HandsomeOS teaching server: http://localhost:${PORT}`);
});
