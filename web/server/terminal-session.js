import { spawn } from 'node:child_process';
import { DemoShell } from './demo-shell.js';
import { decodeProcessOutput } from './terminal-output.js';

export class TerminalSession {
  constructor({ socket, runtimeInfo, wslDistro, spawnProcess = spawn, killDelay = 500 }) {
    this.socket = socket;
    this.runtimeInfo = runtimeInfo;
    this.wslDistro = wslDistro;
    this.spawnProcess = spawnProcess;
    this.killDelay = killDelay;
    this.child = null;
    this.demo = null;
    this.mode = 'idle';
    this.generation = 0;
  }

  emit(type, payload = {}) {
    if (this.socket.readyState === 1) this.socket.send(JSON.stringify({ type, ...payload }));
  }

  ready() {
    this.emit('ready', { runtime: this.runtimeInfo });
  }

  stop() {
    this.generation += 1;
    const previousChild = this.child;
    this.child = null;
    this.demo = null;
    this.mode = 'idle';
    if (!previousChild || previousChild.killed) return;

    try {
      if (previousChild.stdin?.writable) {
        previousChild.stdin.once?.('error', () => {});
        previousChild.stdin.write('\x01x');
      }
    } catch {
      // The process may exit between the writable check and write.
    }
    const timer = setTimeout(() => {
      if (!previousChild.killed) previousChild.kill();
    }, this.killDelay);
    timer.unref?.();
    previousChild.once('exit', () => clearTimeout(timer));
  }

  startDemo(arch, note = '') {
    this.stop();
    const currentGeneration = this.generation;
    this.mode = 'demo';
    const demo = new DemoShell(
      (data) => {
        if (this.generation === currentGeneration && this.mode === 'demo')
          this.emit('output', { data });
      },
      arch,
      (result) => {
        if (this.generation === currentGeneration && this.mode === 'demo')
          this.emit('command-result', { result });
      },
    );
    this.demo = demo;
    this.emit('status', { mode: 'demo', state: 'running', note });
    demo.boot();
  }

  startReal(arch) {
    this.stop();
    if (!this.runtimeInfo.realAvailable)
      return this.startDemo(arch, this.runtimeInfo.reason);

    const currentGeneration = this.generation;
    this.mode = 'real';
    const makeArgs = arch === 'loongarch' ? 'ARCH=loongarch CPUS=1 qemu' : 'ARCH=riscv CPUS=3 qemu';
    const command = `cd '${this.runtimeInfo.source}' && exec make ${makeArgs}`;
    const child = this.spawnProcess('wsl.exe', ['-d', this.wslDistro, 'bash', '-lc', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;
    this.emit('status', { mode: 'real', state: 'booting', note: `通过 ${this.wslDistro} 启动 QEMU` });

    let bootOutput = '';
    let shellReady = false;
    const isCurrent = () => this.generation === currentGeneration && this.mode === 'real' && this.child === child;
    const forwardOutput = (data) => {
      if (!isCurrent()) return;
      const output = decodeProcessOutput(data);
      if (!output) return;
      this.emit('output', { data: output });
      if (!shellReady) {
        bootOutput = `${bootOutput}${output}`.slice(-512);
        if (bootOutput.includes('init: starting sh')) {
          shellReady = true;
          this.emit('status', { mode: 'real', state: 'running', note: '真实 xv6 shell 已就绪' });
        }
      }
    };
    child.stdout.on('data', forwardOutput);
    child.stderr.on('data', forwardOutput);
    child.on('error', (error) => {
      if (isCurrent()) this.startDemo(arch, `真实会话启动失败：${error.message}`);
    });
    child.on('exit', (code) => {
      if (!isCurrent()) return;
      this.child = null;
      this.emit('output', { data: `\r\n[QEMU 已退出，状态码 ${code ?? 'unknown'}]\r\n` });
      this.emit('status', { mode: 'real', state: 'stopped', note: '可重新启动内核' });
    });
  }

  start({ arch = 'riscv', mode = 'demo' } = {}) {
    if (mode === 'real') this.startReal(arch);
    else this.startDemo(arch);
  }

  input(data) {
    if (this.mode === 'real' && this.child?.stdin?.writable) this.child.stdin.write(data);
    else if (this.mode === 'demo' && this.demo) this.demo.input(data);
  }

  handle(message) {
    if (message.type === 'start') this.start(message);
    else if (message.type === 'input') this.input(message.data);
    else if (message.type === 'stop') {
      this.stop();
      this.emit('status', { mode: 'demo', state: 'stopped', note: '可重新启动内核会话' });
    }
  }
}
