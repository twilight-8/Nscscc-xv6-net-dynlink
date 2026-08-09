# semantics

[中文](README.md) | [English](README.en.md)

## Purpose

Verify mount and link semantics not covered by the basic smoke tests:mount-point `..` resolution, ext2 hard links, FAT32 hard-link rejection, and POSIX unlink-while-open semantics.

## Coverage

- Mount-root `..`: `/mnt/../parent.txt` and `/fat/../parent.txt` must resolve back to the xv6 root file system.
- ext2 same-filesystem hard link succeeds with identical content; FAT32 hard link is explicitly rejected.
- `unlinkopen /mnt/uop.txt` and `unlinkopen /fat/uop.txt`: a file unlinked while open stays readable/writable and is freed only at the last close (B2 regression guard, both backends).

## Key assertions

- expect: `VFS_PARENT_OK`; linked-file content; `link ... /fat/... failed`; `unlinkopen: ok` (×2); `SEMANTICS_DONE`.
- reject: `panic:`, `kerneltrap`, `mount: failed`, `unlinkopen: FAIL`, and the ext2 link-failure string.

## Links

- B2 (deferred release on unlink); B3 mount-point protection boundary.
