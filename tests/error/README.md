# error

This test checks that invalid VFS operations fail cleanly instead of crashing the kernel.

## Scope

- Reject mounting on a missing path.
- Mount ext2 and FAT32 explicitly.
- Reject a cross-filesystem hard link.
- Reject removal of missing files.
- Confirm that none of these error paths causes `panic` or `kerneltrap`.

## Run

From the repository root:

```sh
make error
make run
```

Or:

```sh
make error && make run
```

The old `make test_error_path` target is kept as a compatibility alias.

## Commands

The xv6 shell commands are stored in:

```text
tests/error/cmds.sh
```

## Pass Criteria

Required output:

- `mount: failed`
- `mount: ext2 on /mnt dev 2`
- `mount: fat32 on /fat dev 3`
- `link /mnt/hello.c /fat/cross.txt: failed`
- `rm: /mnt/no_such_file failed to delete`
- `rm: /fat/no_such.txt failed to delete`
- `ERROR_PATH_DONE`

Rejected output:

- `panic:`
- `kerneltrap`

## Logs

Runtime logs are written to:

```text
tests/error/logs/
```
