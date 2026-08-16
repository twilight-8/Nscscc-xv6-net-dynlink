import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.QA_URL || 'http://localhost:4182';
const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('qa-artifacts');

const statusResponse = await fetch(`${baseUrl}/api/ai/status`);
const status = await statusResponse.json();
if (!status.available) {
  console.log(`Live AI QA skipped: ${status.reason || 'AI service unavailable'}`);
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.xterm-helper-textarea').waitFor();
  await page.getByRole('button', { name: /启动 AI/ }).click();
  const input = page.locator('.xterm-helper-textarea');
  await input.focus();
  await page.keyboard.type('ls /', { delay: 8 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.trace-summary code')?.textContent === '$ ls /');
  await page.waitForFunction(() => {
    const ready = document.querySelector('.analysis-actions .ai-result');
    const failed = document.querySelector('.analysis-actions .ai-retry');
    return Boolean(ready || failed);
  }, null, { timeout: 65000 });
  const retryButton = page.locator('.analysis-actions .ai-retry');
  if (await retryButton.count()) {
    const note = await retryButton.getAttribute('title');
    throw new Error(note || 'AI analysis failed without an error message');
  }
  await page.getByRole('button', { name: /显示 AI 分析/ }).click();
  await page.getByText('AI 已通过源码校验').waitFor();
  assert.ok(await page.locator('.trace-node').count() >= 3);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(outputDir, 'desktop-ai-live.png'), fullPage: true });
  console.log(`Live AI QA passed with ${status.model} at ${baseUrl}`);
} catch (error) {
  await page.screenshot({ path: path.join(outputDir, 'desktop-ai-live-error.png'), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
