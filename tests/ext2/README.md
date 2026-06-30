# ext2

This test checks the current minimal ext2 support through the VFS layer.

## Scope

- Mount the ext2 image explicitly at `/mnt`.
- Read the preloaded `/mnt/hello.c`.
- Create a short-name regular file.
- Overwrite the same file.
- Remove the created file.
- Confirm that the path stays stable and does not panic.

## Run

From the repository root:

```sh
make ext2
make run
```

Or:

```sh
make ext2 && make run
```

The old `make test_ext2` target is kept as a compatibility alias.

## Commands

The xv6 shell commands are stored in:

```text
tests/ext2/cmds.sh
```

## Pass Criteria

Required output:

- `mount: ext2 on /mnt dev 2`
- `Hello, world`
- `ext2-first`
- `ext2-second`
- `EXT2_DONE`

Rejected output:

- `panic:`
- `kerneltrap`
- `mount: failed`
- `failed to delete`

## Logs

Runtime logs are written to:

```text
tests/ext2/logs/
```
