<div align="center">

<p><img src="docs/assets/buaa-logo.png" alt="Beihang University" height="70" /></p>


<p>Design and Implementation of a Virtual File System and Hardware Abstraction Layer for xv6</p>

<p><strong>2026 National Undergraduate Computer System Ability Competition · HandsoMeOS Team</strong></p>

<p>
  <a href="docs/design.md"><img src="https://img.shields.io/badge/Filesystems-xv6%20%7C%20ext2%20%7C%20FAT32-0053A5" alt="fs" /></a>
  <a href="docs/design.md"><img src="https://img.shields.io/badge/Platforms-RISC--V%20%7C%20LoongArch-E8912D" alt="platform" /></a>
  <a href="https://gitlab.eduxiji.net/T2026100069911110/project3136859-388873"><img src="https://img.shields.io/badge/License-BSD--2--Clause-7C5CFC" alt="license" /></a>
</p>

</div>

---

[中文](README.md) | [English](README.en.md)

## Overview

This project is an entry to the 2026 National Undergraduate Computer System Ability Competition (OS Design, Functional Challenge Track), problem `proj34: Design and Implementation of a Virtual File System and Hardware Abstraction Layer for xv6`.

Based on MIT xv6-riscv rev5, the project adds a virtual file system (VFS) and a hardware abstraction layer (HAL) while preserving xv6's character as a small teaching OS: the system supports the xv6, ext2 and FAT32 file systems simultaneously, and runs on both RISC-V and LoongArch64. Both platforms pass the xv6-riscv rev5 built-in test suite and the VFS tests designated by the problem statement; all changes relative to the original baseline are delivered as a diff file.

## Highlights

- **Thin VFS dispatch layer**: operation tables unify three file systems; a sleep lock serializes `mount`, while a three-state mount table handles publication and rollback with minimal intrusion into the native xv6 file-system path.
- **Three file systems on a single disk**: one virtio disk carries the xv6, ext2 and FAT32 images side by side, mountable on demand after boot.
- **Symmetric thin HAL for two platforms**: both platforms share the same kernel code; platform differences are confined to a separate porting layer, with interrupt-routing knowledge centralized at a single point.
- **Mechanism-level stability fallback**: since the external interrupt chain cannot be guaranteed lossless, a virtio watchdog provides a mechanism-level fallback; SMP stress tests pass.
- **Defect-driven testing**: 8 test points across 2 architectures, 16 regression items all passing. Functional regression is reproducible with one `make verify-all`; key raw logs are archived, while fsck and performance evidence use the separate commands documented for them.

## Quick Start

The repository root provides a `Dockerfile`. The image ships with the RISC-V / LoongArch64 cross toolchains, QEMU and all test dependencies preinstalled, and with both kernels and `fs.img` prebuilt:

```sh
docker build -t xv6-vfs-hal .
docker run --rm -it xv6-vfs-hal          # enter the container, workdir /xv6
```

Inside the container, or in a local environment (dependencies listed in `tests/README.md`):

```sh
make verify-all        # env check + 16 dual-arch regression items + full usertests on both arches
make test_baseline && make run    # run usertests -q via the official entry point
```

Boot the system manually:

```sh
cd src
make qemu                           # RISC-V
make ARCH=loongarch CPUS=1 qemu     # LoongArch64
```

In the shell, mount ext2 and run the VFS tests following the official reference procedure:

```sh
mkdir /mnt
mount ext2 /mnt        # the dev argument of mount may be omitted; a default device is chosen per fs type
cd tests
cat cmds.sh | sh
```

Note: if pulling the `ubuntu:24.04` base image times out, configure `registry-mirrors` in `/etc/docker/daemon.json` and restart Docker.

## Contest Outline Mapping

| Outline item | Location |
|---|---|
| Objectives | "Overview" above |
| Problem analysis and related research | [notes](docs/notes) |
| System architecture design | [design.md](docs/design.md)|
| Development plan | [plan.md](docs/plan.md) |
| Key progress during the contest  [progress.md](docs/progress.md) |
| System testing | [test_report.md](docs/contest/test_report.md) |
| Major problems and solutions | [problems.md](docs/contest/problems.md) |
| Division of labor and collaboration | [collaboration.md](docs/contest/collaboration.md) |
| Repository layout and file description | "Repository Layout" below |
| Contest takeaways | [summary.md](docs/contest/summary.md) |

## Problem Analysis and Related Research

The problem requires extending xv6-riscv rev5 with three file systems and two hardware platforms at once, under the constraint of "as little added code as possible with stable operation". The team therefore dissected the tasks, judging criteria and baseline source before writing any code. The research and close-reading process is captured in nine study notes: problem analysis, xv6 rev5 source layout and boot chain, the file-system call chain, path resolution mechanics, ext2/FAT32 specification essentials, VFS and HAL design derivations, a debugging casebook, and a reference list. See `docs/notes/`; the VFS and HAL derivations in particular record the full path from source-level facts to design decisions.

## System Architecture Design

The system is organized in three layers: a thin VFS dispatch layer on top, which maintains the mount table and dispatches file operations to the concrete backend according to the mount point; three file-system implementations in the middle — the native xv6 file system kept intact, with ext2 and FAT32 added as new backends behind the same interface; and a lightweight HAL at the bottom, which confines platform-specific code (boot, interrupts, block devices) to a separate arch porting layer so that both platforms share all file-system code. Key trade-offs, core data structures, concurrency locking rules and the image layout are documented in `docs/design.md`; locking rules are detailed in `docs/contest/lock_order.md`.

## Development Plan

Development follows the principle of "baseline first, stage-by-stage progress, every stage verifiable": establish baseline anchoring and the test environment first, then implement VFS, ext2, FAT32, the HAL and the LoongArch port in sequence, and finally harden stability, land compliance and organize the deliverables. Task breakdown, schedule and completion status for the final round are recorded day by day in `docs/plan.md`.

## Key Progress

The project went through seventeen stages from baseline to delivery (Stage 0 through Stage P), each recorded as "objectives, changes, verification": the thin VFS dispatch layer, the mount table and block-device interface, ext2 and FAT32 support, LoongArch64 boot and the virtio-pci block device, integration with the official VFS tests, ext2 double-indirect large files, FAT32 long file names, concurrency stability fixes, compliance and performance measurement, and more. Every stage is cross-checkable against the commit history and the test logs in `tests/evidence/`. See `docs/progress.md`.

## System Testing

The testing system has three layers: the xv6 built-in suite (`usertests`, with quick and full runs on both architectures; each full run contains 69 named tests, 63 quick + 6 slow, and ends with `ALL TESTS PASSED`), the VFS tests designated by the problem statement (test1/test2 pass following the official reference procedure, with an image layout identical to the official one), and eight team-authored test points (official-suite regression, public VFS procedure replication, ext2 and FAT32 feature coverage, fault and semantics, persistence, and SMP concurrency stress). All 8 test points × 2 architectures = 16 items pass; the ext2 image passes e2fsck with zero errors; key raw logs are archived in `tests/evidence/`. See `docs/contest/test_report.md` and `tests/README.md`; performance data and its evidence boundary are documented in `docs/contest/performance.md`.

## Major Problems and Solutions

All key problems encountered during development are recorded as "symptom, localization, root cause, fix, verification" — nine items spanning evaluation-procedure integration, file-system semantics, concurrency stability and test engineering. Representative cases: a lost disk-completion interrupt on LoongArch hung the system and was ultimately covered by a virtio watchdog at the mechanism level; FAT32 large-file writes took minutes due to O(n²) chain walking and were brought to normal levels via cluster-chain caching; incorrect semantics when unlinking an open file were fixed through inode-cache consistency and deferred release. The full list is in `docs/contest/problems.md`; debugging details are also in `docs/notes/07-debug-cases.md`.

## Division of Labor and Collaboration

The three-member team divides responsibility by subsystem with cross review: Gu Wenda (captain) owns overall technical direction and the dual-platform HAL port; Miao Hanxu owns the VFS and the ext2/FAT32 file systems; Li Mengxi owns the final-round testing system, stability optimization and documentation. Collaboration runs on iterative commits to the hosting platform, with cross review and full regression after each stage. See `docs/contest/collaboration.md`.

## Takeaways

Through this project the team gained end-to-end engineering practice in file-system implementation, concurrency correctness and cross-platform porting, and developed a reusable working method: baseline anchoring with diff restraint, defect-driven test construction, and staged progress recording. See `docs/contest/summary.md`.

## Repository Layout

```text
.
├── README.md                  # Project description
├── LICENSE                    # BSD-2-Clause
├── Makefile                   # Test orchestration: 8 test points × 2 architectures = 16 runs
├── Dockerfile                 # Containerized build and test environment
├── src/                       # Project source
│   ├── kernel/                # Kernel
│   ├── mkfs/                  # Image tools
│   ├── user/                  # User programs (incl. official test1/test2 and team test programs)
│   └── tests/                 # Data files installed into the image's /tests 
├── xv6-riscv-src/             # Pristine xv6-riscv rev5 baseline copy
├── tests/                     # Host-side test orchestration
├── docs/                      # Project documentation 
│   ├── contest/               # Event Information
│   ├── notes/                 # Study Notes
└── submit/                    # Contest submission materials (final diff, reports, slides, demo video)
```

See the README in each directory for details: `docs/README.md`, `tests/README.md`, `submit/README.md`.

## Submission Materials (`submit/`)

- `xv6-vfs-hal-final.diff`: the complete diff between the final version and the xv6-riscv rev5 baseline (generation procedure in `docs/contest/baseline.md`).
- `xv6-vfs-hal-final.diff.stat`: statistics summary of the diff.
- `final_slides.pdf` / `final_slides.pptx`: presentation slides.
- `演示视频.mp4`: demo video (script and storyboard in `docs/contest/video_script.md`).
- `test_report.md`, `diff.md`, `commit_history.md`: test report, diff notes and commit-history snapshot.

## License and Compliance

The original xv6 code remains under the MIT License (see `src/LICENSE`). Team-authored code is under the BSD-2-Clause License (full text in the repository-root `LICENSE`), with new source files marked by a single-line SPDX comment. Third-party sources (the xv6-loongarch-exp porting reference and the official test files) are documented file by file in `docs/contest/compliance.md`. Technical documents, slides and the demo video are under CC-BY-SA 4.0.

## AI Usage Disclosure

AI tools were used for auxiliary work such as requirement analysis and code review on the premise of originality; every AI suggestion was understood, modified, verified and tested by team members before adoption. Details in `docs/contest/ai_usage.md`.
