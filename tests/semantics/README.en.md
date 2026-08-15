# semantics

[中文](README.md) | [English](README.en.md)

## Purpose

Verify VFS semantics not covered by the basic smoke tests: cross-backend ELF execution, mount-point `..` resolution, ext2 hard links, FAT32 hard-link rejection, and POSIX unlink-while-open semantics.

## Coverage

- Copy the `/echo` ELF from the xv6 root file system to ext2 and FAT32, then execute both copies to verify that ELF-header, program-header, and segment reads are dispatched through the VFS.
- Mount-root `..`: `/mnt/../parent.txt` and `/fat/../parent.txt` must resolve back to the xv6 root file system.
- ext2 same-filesystem hard link succeeds with identical content; FAT32 hard link is explicitly rejected.
- `unlinkopen /mnt/uop.txt` and `unlinkopen /fat/uop.txt`: a file unlinked while open stays readable/writable and is freed only at the last close (B2 regression guard, both backends).

## Key assertions

- expect: exactly two occurrences each of `EXT2_EXEC_OK` and `FAT32_EXEC_OK` (command echo plus real program output), plus `VFS_PARENT_OK`; linked-file content; `link ... /fat/... failed`; `unlinkopen: ok` (x2); `SEMANTICS_DONE`.
- reject: cross-backend `exec` failure strings, `panic:`, `kerneltrap`, `mount: failed`, `unlinkopen: FAIL`, and the ext2 link-failure string.

## Links

- P0 `exec()` VFS dispatch; B2 (deferred release on unlink); B3 mount-point protection boundary.
