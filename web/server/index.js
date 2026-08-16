import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createAiTrace, getAiConfig } from './ai-trace.js';
import { TerminalSession } from './terminal-session.js';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const PORT = Number(process.env.PORT || 4182);
const WSL_DISTRO = process.env.XV6_WSL_DISTRO || 'Ubuntu-24.04';
const RUNTIME_PROBE_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.XV6_PROBE_TIMEOUT_MS) || 10000, 3500),
  30000,
);

const app = express();
app.use(express.json({ limit: '96kb' }));
app.use('/project-assets', express.static(path.join(REPO_ROOT, 'outputs')));
const aiConfig = getAiConfig();

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
  }, RUNTIME_PROBE_TIMEOUT_MS);
  probe.on('error', () => { clearTimeout(timer); finish(false); });
  probe.on('exit', (code) => { clearTimeout(timer); finish(code === 0); });
}

probeRuntime();
app.get('/api/runtime', (_request, response) => response.json(runtimeInfo));

app.get('/api/ai/status', (_request, response) => response.json({
  available: aiConfig.available,
  model: aiConfig.available ? aiConfig.model : '',
  reason: aiConfig.reason,
}));

app.post('/api/ai/trace', async (request, response) => {
  const payload = request.body;
  if (!payload || typeof payload.command !== 'string' || payload.command.length > 300)
    return response.status(400).json({ error: '命令为空或超过 300 个字符' });
  if (!aiConfig.available) return response.status(503).json({ error: aiConfig.reason });
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.once('aborted', abort);
  response.once('close', abort);
  try {
    const result = await createAiTrace({ repoRoot: REPO_ROOT, config: aiConfig, payload, signal: controller.signal });
    if (!controller.signal.aborted) response.json(result);
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error(`[AI trace] ${error.message}`);
    response.status(502).json({ error: error.message || 'AI 分析失败' });
  } finally {
    request.off('aborted', abort);
    response.off('close', abort);
  }
});

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
  const session = new TerminalSession({ socket, runtimeInfo, wslDistro: WSL_DISTRO });
  session.ready();
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    session.handle(message);
  });
  socket.on('close', () => session.stop());
});

server.listen(PORT, () => {
  console.log(`HandsomeOS teaching server: http://localhost:${PORT}`);
});
