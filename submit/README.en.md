# submit

[中文](README.md) | [English](README.en.md)

This directory holds the final contest submission materials. The authoritative versions of the documents are maintained in `docs/` and `tests/`; this directory is the delivery snapshot.

## Contents

| File | Description |
|---|---|
| `xv6-vfs-hal-final.diff` | Standard diff against the xv6-riscv rev5 baseline (source files only; verified to apply cleanly onto the baseline) |
| `xv6-vfs-hal-final.diff.stat` | Statistics summary of the standard diff (62 files, +6405/−113) |
| `xv6-vfs-hal-final.nonblank.diff` | Audit/reporting view with whitespace-only added/deleted lines excluded (+5602/−106, 5708 total; not replayable as a patch) |
| `xv6-vfs-hal-final.nonblank.diff.stat` | Per-file statistics for nonblank textual changes |
| `diff.md` | How the diff is generated, size statistics, and the HAL/VFS/common breakdown |
| `test_report.md` | Test report (authoritative version `docs/contest/test_report.md`; raw logs in `tests/evidence/`) |
| `commit_history.md` | Key progress during the contest, recorded by stage |
| `final_slides.pdf` / `final_slides.pptx` | Historical progress deck dated 2026-06-30 |
| `演示视频.mp4` | Demo video (script and storyboard in `docs/contest/video_script.md`) |

## Final Verification

- All 11 test points pass on both architectures: `run_all: PASS (22/22)`; the most recently archived complete usertests output `ALL TESTS PASSED` on both RISC-V and LoongArch.
- Under CPUS=3, the error suite issues background/foreground ext2 and FAT32 mount requests and rejects two root aliases, same-type/different-directory, and cross-type/same-path requests; each architecture reports exactly 7/7 failures and 1/1 success for each backend. `mtable.oplock` serializes complete `mount/umount` operations, while the four-state table handles publication, rollback, unlink visibility and unmount isolation.
- ELF binaries copied to ext2 and FAT32 execute directly and print `EXT2_EXEC_OK` and `FAT32_EXEC_OK`. The post-fix dual-architecture regression passes; cold-inode first load and `MOUNTING` publication are justified by lock-order/memory-order review, and the current tests do not claim to hit either window deterministically.
- `umount` reports busy for open files, a cwd inside the mount, in-flight path references and child mounts. A successful unmount reveals the underlying xv6 directory and permits ext2/FAT32 remount; semantics and CPUS=3 `umountstress` pass on both architectures.
- `mount_lifecycle` exactly verifies rollback, mount-point protection, nested busy, and underlay recovery; `remount_io` validates 8 MiB across both backends; `mount_storm` completes 2,048 worker iterations under CPUS=3. All three pass on both architectures.
- Forced/lazy unmount and full mount-topology management are out of scope: mounting `/a/b` first and `/a` afterward can still hide the earlier mount. This reverse-ancestor overmount remains a P1 limitation.

## See also

- Project overview: `README.md` at the repository root
- Design and process documents: `../docs/` (design, plan, progress, study notes, contest documents)
- Testing system and evidence: `../tests/`
