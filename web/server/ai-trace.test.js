import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectEvidence,
  createAiTrace,
  findSymbolLine,
  getAiConfig,
  validateModelTrace,
} from './ai-trace.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseTrace = {
  command: 'cat',
  raw: 'cat /mnt/hello',
  backend: 'ext2',
  status: 'success',
  nodes: [
    { layer: 'user', title: 'cat 用户程序', fn: 'main()', file: 'src/user/cat.c', line: 25 },
    { layer: 'trap', title: '进入内核', fn: 'uservec', file: 'src/kernel/trampoline.S', line: 22 },
    { layer: 'syscall', title: '系统调用分派', fn: 'syscall()', file: 'src/kernel/syscall.c', line: 136 },
    { layer: 'vfs', title: 'VFS 读取', fn: 'vfs_readi()', file: 'src/kernel/vfs.c', line: 478 },
  ],
};
const payload = {
  command: 'cat /mnt/hello',
  arch: 'riscv',
  terminalMode: 'demo',
  state: { cwd: '/', mounts: { ext2: '/mnt', fat32: '' } },
  result: { success: true, backend: 'ext2' },
  baseTrace,
};

const validNodes = [
  { layer: 'user', title: '解析参数', symbol: 'main', fn: 'main(int argc, char **argv)', file: 'src/user/cat.c', role: '解析文件路径并调用 open、read 和 write。' },
  { layer: 'trap', title: '保存用户现场', symbol: 'uservec', fn: 'uservec', file: 'src/kernel/trampoline.S', role: '保存用户寄存器并切换到内核页表。' },
  { layer: 'syscall', title: '分派系统调用', symbol: 'syscall', fn: 'syscall(void)', file: 'src/kernel/syscall.c', role: '根据系统调用号调用对应的 sys_* 处理函数。' },
  { layer: 'vfs', title: '分派读取后端', symbol: 'vfs_readi', fn: 'vfs_readi(...)', file: 'src/kernel/vfs.c', role: '根据 inode 操作表把读取请求交给对应文件系统。' },
];

test('AI configuration requires an endpoint and model but supports local services without a key', () => {
  assert.equal(getAiConfig({}).available, false);
  const config = getAiConfig({
    AI_API_URL: 'http://localhost:11434/v1/chat/completions',
    AI_MODEL: 'local-model',
    AI_THINKING: 'disabled',
  });
  assert.equal(config.available, true);
  assert.equal(config.apiKey, '');
  assert.equal(config.thinking, 'disabled');
});

test('source evidence and symbol locations come from the current repository', () => {
  const evidence = collectEvidence(REPO_ROOT, payload);
  assert.ok(evidence.some((item) => item.file === 'src/user/cat.c'));
  assert.ok(evidence.some((item) => item.file === 'src/kernel/vfs.c'));
  assert.equal(findSymbolLine(REPO_ROOT, 'src/kernel/vfs.c', 'vfs_readi'), 478);
  assert.equal(findSymbolLine(REPO_ROOT, 'src/kernel/vfs.c', 'invented_function'), 0);
});

test('model nodes are anchored to real symbols and fabricated files are rejected', () => {
  const evidence = collectEvidence(REPO_ROOT, payload);
  const output = validateModelTrace(REPO_ROOT, {
    nodes: [...validNodes, {
      layer: 'vfs', title: '伪造节点', symbol: 'magic_lookup', file: 'src/kernel/not-real.c', role: '不应通过。',
    }],
  }, evidence);
  assert.equal(output.nodes.length, 4);
  assert.equal(output.nodes[0].line, 25);
  assert.equal(output.warnings.length, 1);
});

test('AI trace request returns a validated trace without trusting model line numbers', async () => {
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.model, 'test-model');
    assert.deepEqual(request.thinking, { type: 'disabled' });
    assert.match(request.messages[1].content, /cat \/mnt\/hello/);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ nodes: validNodes }) } }] }),
    };
  };
  const result = await createAiTrace({
    repoRoot: REPO_ROOT,
    config: { available: true, endpoint: 'https://example.invalid/chat/completions', model: 'test-model', apiKey: 'secret', thinking: 'disabled', timeoutMs: 3000 },
    payload,
    fetchImpl,
  });
  assert.equal(result.trace.analysis, 'ai');
  assert.equal(result.trace.nodes.length, 4);
  assert.equal(result.trace.nodes[3].line, 478);
  assert.ok(result.meta.evidenceCount >= 4);
});

test('AI request stops when the browser cancels an obsolete command', async () => {
  const controller = new AbortController();
  const fetchImpl = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
  const pending = createAiTrace({
    repoRoot: REPO_ROOT,
    config: { available: true, endpoint: 'https://example.invalid/chat/completions', model: 'test-model', apiKey: '', thinking: '', timeoutMs: 3000 },
    payload,
    fetchImpl,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, /AI 分析已取消/);
});
