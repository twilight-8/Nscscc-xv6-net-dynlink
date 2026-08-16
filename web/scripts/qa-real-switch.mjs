import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.QA_URL || 'http://localhost:4182';
const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('qa-artifacts');
const rounds = Math.min(Math.max(Number(process.env.QA_REAL_ROUNDS) || 3, 1), 10);

const runtimeResponse = await fetch(`${baseUrl}/api/runtime`);
const runtime = await runtimeResponse.json();
if (!runtime.realAvailable) {
  console.log(`Real QEMU QA skipped: ${runtime.reason || 'runtime unavailable'}`);
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const realButton = page.getByRole('button', { name: '真实 QEMU' });
  const demoButton = page.getByRole('button', { name: '演示' });
  await realButton.waitFor();
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.trim() === '真实 QEMU');
    return button && !button.disabled;
  });

  for (let round = 1; round <= rounds; round += 1) {
    await realButton.click();
    await page.getByText('真实 xv6 shell 已就绪').waitFor({ timeout: 90000 });
    assert.equal(await page.locator('.session-state strong').innerText(), 'REAL');

    await demoButton.click();
    await page.waitForFunction(() => {
      const output = document.querySelector('.xterm-rows')?.textContent || '';
      const mode = document.querySelector('.session-state strong')?.textContent || '';
      return mode === 'DEMO' && output.includes('HandsomeOS teaching session');
    });
    await page.waitForTimeout(1200);
    const output = await page.locator('.xterm-rows').innerText();
    assert.doesNotMatch(output, /QEMU:\s*Terminated|\[QEMU 已退出/);
    assert.match(output, /HandsomeOS teaching session/);
  }

  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(outputDir, 'desktop-real-to-demo.png'), fullPage: true });
  console.log(`Real QEMU switch QA passed: ${rounds} rounds at ${baseUrl}`);
} finally {
  await browser.close();
}
