# semantics

This test checks VFS mount and link semantics that are not covered by the
basic smoke tests.

## Scope

- After mounting ext2 at `/mnt`, `/mnt/..` should resolve to the parent of the
  mount point, so `/mnt/../parent.txt` reaches the xv6 root file system.
- After mounting FAT32 at `/fat`, `/fat/..` should also resolve to the xv6 root
  file system.
- ext2 supports a basic same-filesystem hard link.
- FAT32 does not support Unix-style hard links and should return an error.

## Run

From the repository root:

```sh
make semantics && make run
```

LoongArch:

```sh
make loongarch_semantics && make run
```

## Commands

The xv6 shell commands are stored in:

```text
tests/semantics/cmds.sh
```

## Pass Criteria

Required output:

- `mount: ext2 on /mnt dev 2`
- `mount: fat32 on /fat dev 3`
- `VFS_PARENT_OK`
- `Hello, world`
- `link /fat/a.txt /fat/b.txt: failed`
- `SEMANTICS_DONE`

Rejected output:

- `panic:`
- `kerneltrap`
- `mount: failed`
- `link /mnt/hello.c /mnt/hlink.c: failed`

## Logs

Runtime logs are written to:

```text
tests/semantics/logs/
```
