import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.QA_URL || 'http://localhost:4182';
const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('qa-artifacts');
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: edgePath, headless: true });

async function assertLayout(page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  assert.ok(metrics.documentWidth <= metrics.viewportWidth + 1, `horizontal overflow: ${JSON.stringify(metrics)}`);
  return metrics;
}

async function enterCommand(page, command) {
  const input = page.locator('.xterm-helper-textarea');
  await input.focus();
  await page.keyboard.type(command, { delay: 8 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (expected) => document.querySelector('.trace-summary code')?.textContent === `$ ${expected}`,
    command,
  );
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await desktop.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.locator('.xterm-helper-textarea').waitFor();
await page.getByText('内核运行中').waitFor();

await enterCommand(page, 'ls /');
await page.locator('.trace-node').filter({ hasText: 'xv6 目录查找' }).click();
await page.getByRole('button', { name: '源码上下文' }).click();
await page.locator('.source-line.is-focus').waitFor();
await assertLayout(page);
await page.screenshot({ path: path.join(outputDir, 'desktop-ls-source.png'), fullPage: true });

await enterCommand(page, 'mkdir /mnt');
await enterCommand(page, 'mount ext2 /mnt');
await enterCommand(page, 'cat /mnt/hello');
await page.locator('.trace-summary').getByText(/ext2/).waitFor();
assert.match(await page.locator('.trace-pane').innerText(), /ext2 读分发/);

await enterCommand(page, 'mkdir /fat');
await enterCommand(page, 'mount fat32 /fat');
await enterCommand(page, 'ln /fat/HELLO.TXT /fat/LINK.TXT');
await page.locator('.trace-summary').getByText(/FAT32/).waitFor();
await page.waitForTimeout(700);
await page.locator('.trace-node').filter({ hasText: 'FAT32 操作分发' }).waitFor();
await assertLayout(page);
await page.screenshot({ path: path.join(outputDir, 'desktop-fat32-link.png'), fullPage: true });
assert.deepEqual(errors, []);
await desktop.close();

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const mobilePage = await mobile.newPage();
await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' });
await mobilePage.locator('.xterm-helper-textarea').waitFor();
await enterCommand(mobilePage, 'ls /');
await assertLayout(mobilePage);
await mobilePage.screenshot({ path: path.join(outputDir, 'mobile-terminal.png'), fullPage: true });
await mobilePage.getByRole('button', { name: '执行链' }).click();
await mobilePage.locator('.trace-pane.mobile-active').waitFor();
await mobilePage.waitForTimeout(700);
await assertLayout(mobilePage);
await mobilePage.screenshot({ path: path.join(outputDir, 'mobile-trace.png'), fullPage: true });
await mobile.close();

await browser.close();
console.log(`QA passed: ${baseUrl}`);
console.log(`Screenshots: ${outputDir}`);
