# persist

This test checks that writes to ext2 and FAT32 are written back to `fs.img`.
It runs two QEMU sessions without rebuilding the image between them.

## Scope

- First session: mount ext2 and FAT32, write one file to each file system, and
  read the files back immediately.
- The runner exits QEMU with the same control sequence as `Ctrl-A x` when
  possible, then falls back to termination if needed.
- Second session: boot again, remount ext2 and FAT32, and read the files created
  in the first session.

## Run

From the repository root:

```sh
make persist && make run
```

LoongArch:

```sh
make loongarch_persist && make run
```

## Commands

The first session commands are stored in:

```text
tests/persist/write.cmds.sh
```

The second session commands are stored in:

```text
tests/persist/read.cmds.sh
```

## Pass Criteria

Required output across the two sessions:

- `PERSIST_WRITE_DONE`
- `PERSIST_READ_DONE`
- `persist-ext2`
- `persist-fat`

Rejected output:

- `panic:`
- `kerneltrap`
- `mount: failed`
- file open failures for the persisted paths

## Logs

Runtime logs are written to:

```text
tests/persist/logs/
```
