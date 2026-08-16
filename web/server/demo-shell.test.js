import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoShell } from './demo-shell.js';

function createSession() {
  const output = [];
  const results = [];
  const shell = new DemoShell((chunk) => output.push(chunk), 'riscv', (result) => results.push(result));
  const run = (command) => {
    const offset = output.length;
    shell.execute(command);
    return { output: output.slice(offset).join(''), result: results.at(-1) };
  };
  return { run };
}

test('mkdir changes the following ls result', () => {
  const { run } = createSession();
  assert.equal(run('mkdir aaa').result.success, true);
  assert.match(run('ls').output, /^aaa\s+1 30 1024/m);
});

test('redirected echo creates readable file content', () => {
  const { run } = createSession();
  assert.equal(run('echo hello > note').result.success, true);
  assert.match(run('cat note').output, /^hello\r?$/m);
});

test('rm removes an empty directory from its parent', () => {
  const { run } = createSession();
  run('mkdir aaa');
  assert.equal(run('rm aaa').result.success, true);
  assert.doesNotMatch(run('ls').output, /^aaa\s/m);
});

test('mount switches stores and umount reveals the underlying directory', () => {
  const { run } = createSession();
  run('mkdir /mnt');
  const mounted = run('mount ext2 /mnt');
  assert.equal(mounted.result.success, true);
  assert.equal(mounted.result.mounts['/mnt'], 'ext2');
  assert.match(run('ls /mnt').output, /^hello\s/m);

  const unmounted = run('umount /mnt');
  assert.equal(unmounted.result.success, true);
  assert.deepEqual(unmounted.result.mounts, {});
  assert.doesNotMatch(run('ls /mnt').output, /^hello\s/m);
});

test('failed operations report failure without changing state', () => {
  const { run } = createSession();
  assert.equal(run('mkdir missing/child').result.success, false);
  assert.doesNotMatch(run('ls').output, /^missing\s/m);
});
