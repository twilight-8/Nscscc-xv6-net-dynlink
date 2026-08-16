import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { TerminalSession } from './terminal-session.js';

class FakeStdin extends EventEmitter {
  constructor() {
    super();
    this.writable = true;
    this.writes = [];
  }

  write(data) {
    this.writes.push(data);
    return true;
  }
}

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.stdin = new FakeStdin();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.killed = false;
  }

  kill() {
    this.killed = true;
    this.emit('exit', null);
  }
}

function createHarness() {
  const messages = [];
  const children = [];
  const socket = {
    readyState: 1,
    send(raw) { messages.push(JSON.parse(raw)); },
  };
  const session = new TerminalSession({
    socket,
    runtimeInfo: { realAvailable: true, source: '/workspace/src', reason: '' },
    wslDistro: 'Ubuntu-24.04',
    killDelay: 5,
    spawnProcess() {
      const child = new FakeChild();
      children.push(child);
      return child;
    },
  });
  return { session, messages, children };
}

test('switching from real QEMU to demo discards stale process output and exit status', async () => {
  const { session, messages, children } = createHarness();
  session.start({ arch: 'riscv', mode: 'real' });
  const qemu = children[0];
  qemu.stdout.emit('data', Buffer.from('xv6 kernel is booting\ninit: starting sh\n$ '));
  assert.equal(messages.at(-1).type, 'status');
  assert.equal(messages.at(-1).mode, 'real');

  const boundary = messages.length;
  session.start({ arch: 'riscv', mode: 'demo' });
  qemu.stderr.emit('data', Buffer.from('QEMU: Terminated\n'));
  qemu.emit('exit', 0);

  const afterSwitch = messages.slice(boundary);
  assert.ok(afterSwitch.some((message) => message.type === 'status' && message.mode === 'demo'));
  assert.ok(afterSwitch.some((message) => message.type === 'output' && message.data.includes('HandsomeOS teaching session')));
  assert.ok(!afterSwitch.some((message) => message.type === 'output' && message.data.includes('QEMU: Terminated')));
  assert.ok(!afterSwitch.some((message) => message.type === 'status' && message.mode === 'real'));
  assert.deepEqual(qemu.stdin.writes, ['\x01x']);
});

test('switching sessions kills an unresponsive captured child without touching the new demo', async () => {
  const { session, messages, children } = createHarness();
  session.start({ arch: 'riscv', mode: 'real' });
  const qemu = children[0];
  session.start({ arch: 'riscv', mode: 'demo' });
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.equal(qemu.killed, true);
  assert.equal(session.mode, 'demo');
  assert.equal(messages.at(-1).type, 'output');
  assert.match(messages.at(-1).data, /\$\x1b\[0m /);
});
