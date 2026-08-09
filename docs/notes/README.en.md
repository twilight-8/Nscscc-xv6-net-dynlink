# docs/notes

[中文](README.md) | [English](README.en.md)

Index of the learning notes.  Read in numbered order: from source layout, to specification reading, to design derivation; the debugging casebook collects methodology and lessons.

## Reading order

| Entry | Content |
|---|---|
| `00-contest-analysis.md` | Contest-problem analysis: task breakdown, judging criteria, strategy, risk register |
| `01-xv6-source-tour.md` | xv6 rev5 source layout: boot chain and subsystem map |
| `02-fs-chain.md` | File-system call chain: the iget/ilock/iupdate/iput invariants |
| `03-namex.md` | Path resolution: truncation semantics, mount traversal, alias lookup |
| `04-ext2-fat32-spec.md` | ext2/FAT32 spec essentials (the minimal set used by the implementation) |
| `05-vfs-design-walkthrough.md` | VFS design derivation: requirements → shape → verification |
| `06-hal-design-walkthrough.md` | HAL design derivation: interface boundary and divergence confinement |
| `07-debug-cases.md` | Debugging methodology, engineering lessons, defect index |
| `08-references.md` | Related research list (references and spec sources) |
