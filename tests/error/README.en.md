# error

[中文](README.md) | [English](README.en.md)

## Purpose

Verify the stability of VFS error paths: invalid operations must fail cleanly without panicking or corrupting system state.

## Coverage

- Mounting on a nonexistent directory (`mount ext2 /no_such_dir`).
- After mounting ext2 and FAT32 normally, a cross-filesystem hard link attempt (`ln /mnt/hello.c /fat/cross.txt`).
- Removing nonexistent files (one on ext2, one on FAT32).

## Key assertions

- expect: the `failed` notices for each error path; `ERROR_PATH_DONE` at the end (proving the system is still running normally).
- reject: `panic:`, `kerneltrap`, `mount: failed` (legitimate mounts must not fail).

## Links

- The contest's system-stability requirement; B5 (invalid-mount rejection).
