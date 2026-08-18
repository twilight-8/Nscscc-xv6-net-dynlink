# HandsomeOS Teaching Console

[中文](README.md) | [English](README.en.md)

This is the companion teaching website for the contest kernel. The page combines an interactive xv6 terminal, command execution chains, node parameter explanations and the current repository's source context in a single workbench.

## Features

- Use an xv6-style terminal in the browser, with switchable RISC-V and LoongArch64 perspectives.
- The demo session maintains an independent in-memory file-system state; `mkdir`, redirected file writes, `ln`, `rm`, `mount`, `umount` and `cd` genuinely affect the results of later commands in the same browser session.
- After each command completes, an execution chain is generated for commands such as `ls`, `cat`, `echo`, `mkdir`, `rm`, `ln`, `mount`, `umount` and `cd` according to the success or failure result; failed commands never corrupt the teaching state.
- The deterministic rule chain is always shown immediately; when AI is enabled, the backend additionally searches the current repository source and produces supplementary analysis in parallel, without blocking command execution or rule-chain interaction.
- Once the AI finishes, the user clicks "Show AI analysis" to view the result and can switch back to the rule chain at any time; failures or timeouts only affect that AI task, not the terminal or the rule chain.
- Nodes are categorized as user space, trap, system call, file object, VFS, concrete file system, and block layer/HAL.
- Clicking a node shows the function's purpose, the meaning of parameters/fields, and the real source context in the repository.
- After mounting ext2 or FAT32, subsequent path tracing automatically switches to the corresponding file-system backend.
- The site prefers a real QEMU inside WSL; when the environment is incomplete it automatically falls back to the teaching demo session, keeping the offline demo usable.

## Starting and Stopping the Site

Node.js 20 or later on Windows is required. Production mode is recommended.

On first start, run the following in PowerShell:

```powershell
cd ./web
npm.cmd install
npm.cmd run build
npm.cmd start
```

The server is up when you see (default port 4182):

```text
HandsomeOS teaching server: http://localhost:4182
```

Keep this PowerShell window open and visit <http://localhost:4182> in the browser. It is normal for PowerShell to stay in the running state; xv6 commands should be typed into the teaching terminal on the page, not into PowerShell.

To stop the site, go back to the PowerShell window running `npm.cmd start` and press `Ctrl+C`. Closing the browser tab does not stop the server.

If you see `EADDRINUSE`, a site process is already running on that port. You can visit the address directly, or restart on a different port (for example 4187):

```powershell
$env:PORT = "4187"
npm.cmd start
```

Then visit <http://localhost:4187>.

Development mode is only for auto-reload while editing the frontend. After confirming the default backend port `4182` is free, run:

```powershell
npm.cmd run dev
```

The development page is at <http://localhost:4180>. Normal demonstrations and the defense do not need development mode.

## AI Assistant Mode

Enabling AI takes three steps: configure the service, start the site, and click the switch on the page. Setting environment variables alone does not enable AI.

Step one: in the same PowerShell window that will run the site, configure a model service compatible with the Chat Completions format:

```powershell
cd ./web

$env:AI_API_URL = "full endpoint URL from your provider"
$env:AI_MODEL = "model name from your provider"
$env:AI_API_KEY = "API key"
$env:AI_TIMEOUT_MS = "30000"
$env:AI_THINKING = "disabled"
$env:PORT = "4187"

npm.cmd start
```

Step two: open the port in the browser, e.g. <http://localhost:4187>.

Step three: click "Enable AI" at the top right of the execution-chain area, then run commands in the terminal. The rule chain appears immediately; once the AI finishes, click "Show AI analysis".

To disable AI, click "Disable AI" at the same position; while analysis is running the button shows "Stop AI", which cancels the current request and disables further background analysis. Disabling AI does not stop the site or the xv6 terminal.

`AI_API_URL` must be a complete Chat Completions endpoint, and `AI_MODEL` is the provider's model identifier. The API key is kept only in the backend process that started the site and is never sent to the browser. Cloud services usually require `AI_API_KEY`; local compatible services may leave it unset. For DeepSeek-compatible endpoints that support a thinking toggle, set `AI_THINKING=disabled` for defense demonstrations to shorten response time; do not set it for services that do not support the field. After changing any AI environment variable, stop the site with `Ctrl+C` and run `npm.cmd start` again in the same PowerShell window.

The "Enable AI" switch on the page toggles background analysis. While it is on, the rule chain is still generated and shown immediately when a command completes; the "Show AI analysis" button appears only after the AI result passes source verification. Entering a new command, restarting the session, switching architectures, or switching between real and demo modes cancels the old AI request, so stale results never overwrite newer commands.

The site does not blindly trust the source locations given by the model. The server first collects the rule chain, user programs, system-call entries and related VFS/HAL source snippets; after the model responds, it checks item by item whether each file is in the evidence set and each symbol really exists, and recomputes line numbers against the current source. If fewer than three nodes pass verification, the request times out, or the service is unavailable, the rule chain keeps working and the page offers an AI retry entry.

With the site running, you can reuse the local Microsoft Edge to run desktop/mobile automated checks:

```powershell
npm.cmd run qa
```

Continuous-switching regression between real QEMU and the demo session:

```powershell
npm.cmd run qa:real
```

This check switches 3 rounds by default; use `QA_REAL_ROUNDS` to adjust between 1 and 10 rounds. If the real environment is unavailable, the script explains why and skips, never reporting demo results as real QEMU results.

With a model service configured, you can run a single real AI end-to-end check:

```powershell
npm.cmd run qa:ai
```

This check sends one real `ls /` teaching-analysis request and verifies the result button, the source-verified execution chain and the browser rendering; it skips explicitly when the model is unavailable. It neither reads nor prints the API key.

Demo terminal state regression tests:

```powershell
npm.cmd test
```

If the site is not on the default port, set `QA_URL` first; screenshots are written to `web/qa-artifacts/`.

## Real QEMU Session

The backend probes the `Ubuntu-24.04` WSL distribution for the project source, `make` and `qemu-system-riscv64`. The default source mapping is the repository's `src/` directory.

Configuration can be overridden via environment variables:

```powershell
$env:XV6_WSL_DISTRO = "Ubuntu-24.04"
$env:XV6_PROBE_TIMEOUT_MS = "10000"
npm.cmd start
```

After a successful probe, select "Real QEMU" in the terminal toolbar. The frontend automatically refreshes its status during the WSL cold-start probe; `XV6_PROBE_TIMEOUT_MS` can be adjusted to the machine's startup speed, within 3500 to 30000 milliseconds. If the probe fails, the page explains why and automatically falls back to the demo session. The demo mode is a stateful xv6/VFS semantic model, suitable for stably demonstrating command effects and source execution chains, but it does not impersonate real kernel execution; authoritative functional conclusions remain with the repository test logs and the real QEMU regression.

## Demo Walkthrough

Run the following line by line in the page terminal:

```sh
ls /
mkdir /mnt
mount ext2 /mnt
cat /mnt/hello
mkdir /fat
mount fat32 /fat
ln /fat/HELLO.TXT /fat/LINK.TXT
umount /fat
umount /mnt
```

After each command, watch the backend indicator on the left change and click the VFS, file-system or HAL nodes. Among them, `ln /fat/HELLO.TXT /fat/LINK.TXT` shows the rejection chain when FAT32 does not support hard links.
