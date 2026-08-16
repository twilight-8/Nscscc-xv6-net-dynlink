import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeProcessOutput } from './terminal-output.js';

test('preserves UTF-8 QEMU output and bare newlines', () => {
  const output = Buffer.from('xv6 kernel is booting\nhart 1 starting\n$ ', 'utf8');
  assert.equal(decodeProcessOutput(output), 'xv6 kernel is booting\nhart 1 starting\n$ ');
});

test('decodes and removes UTF-16LE wsl host warnings', () => {
  const warning = Buffer.from(
    'wsl: 检测到 localhost 代理配置，但未镜像到 WSL。NAT 模式下的 WSL 不支持 localhost 代理。\r\n',
    'utf16le',
  );
  assert.equal(decodeProcessOutput(warning), '');
});

test('preserves normal UTF-8 stderr diagnostics', () => {
  const diagnostic = Buffer.from('make: riscv64-unknown-elf-gcc: command not found\n', 'utf8');
  assert.equal(decodeProcessOutput(diagnostic), diagnostic.toString());
});
