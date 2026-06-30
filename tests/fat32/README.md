# fat32

This test checks the current minimal FAT32 support through the VFS layer.

## Scope

- Mount the FAT32 image explicitly at `/fat`.
- Use FAT32 8.3 short names.
- Create a regular file.
- Overwrite the same file.
- Create and remove an empty file.
- Confirm that the path stays stable and does not panic.

## Run

From the repository root:

```sh
make fat32
make run
```

Or:

```sh
make fat32 && make run
```

The old `make test_fat32` target is kept as a compatibility alias.

## Commands

The xv6 shell commands are stored in:

```text
tests/fat32/cmds.sh
```

## Pass Criteria

Required output:

- `mount: fat32 on /fat dev 3`
- `fat32-one`
- `fat32-two`
- `FAT32_DONE`

Rejected output:

- `panic:`
- `kerneltrap`
- `mount: failed`
- `failed to delete`

## Logs

Runtime logs are written to:

```text
tests/fat32/logs/
```
