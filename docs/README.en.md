# docs

[中文](README.md) | [English](README.en.md)

Master index of the project documentation. Documents are organized in three layers: main-thread documents (this directory's root), learning notes (`notes/`), and contest-requirement documents (`contest/`). Packaged submission artifacts live in `submit/`.

## Main-thread documents (root of this directory)

Design (`design.md`), plan (`plan.md`) and progress (`progress.md`) form the project's main thread — what to build, how to proceed, and what was actually achieved — and are updated continuously throughout the project.

| Document | Contest-outline item |
|---|---|
| `design.md` | System architecture design: three-layer architecture, per-stage decisions and scope boundaries |
| `plan.md` | Development plan: task breakdown, schedule, and progress checkmarks |
| `progress.md` | Progress during the contest |

## Learning notes (notes/)

Covering "contest-problem analysis and related research":

| Document | Requirement |
|---|---|
| `notes/00-contest-analysis.md` | contest analysis (tasks, judging criteria, strategy) |
| `notes/01-xv6-source-tour.md` | xv6 rev5 source layout and boot chain |
| `notes/02-fs-chain.md` | file-system call chain reading |
| `notes/03-namex.md` | path resolution and directory-entry mechanics |
| `notes/04-ext2-fat32-spec.md` | ext2/FAT32 specification essentials |
| `notes/05-vfs-design-walkthrough.md` | VFS design derivation |
| `notes/06-hal-design-walkthrough.md` | HAL dual-platform derivation |
| `notes/07-debug-cases.md` | debugging casebook |
| `notes/08-references.md` | Related research |

## Contest-requirement documents (contest/)

Each document maps to a submission requirement; the mapping table is in `contest/README.md`:

| Document | Requirement |
|---|---|
| `contest/test_report.md` | System testing |
| `contest/test_effects_ppt_outline.md` | Content and visual plan for the defense testing/results section |
| `contest/problems.md` | Problems encountered and solutions |
| `contest/innovation.md` | Innovation analysis |
| `contest/comparison.md` | Comparison with similar projects |
| `contest/performance.md` | Performance measurement and analysis |
| `contest/video_script.md` | Demo video script and key frames |
| `contest/collaboration.md` | Division of labor and collaboration |
| `contest/summary.md` | Contest takeaways |
| `contest/compliance.md` | Third-party source disclosure |
| `contest/ai_usage.md` | AI tooling disclosure |
| `contest/baseline.md` | Baseline anchor and diff generation |
| `contest/lock_order.md` | Locking rules and concurrency cases |

## Others

- Teaching website documentation: `../web/README.md` (maintained with the website code, outside the three-layer system).
- Packaged submission artifacts: `../submit/`.
