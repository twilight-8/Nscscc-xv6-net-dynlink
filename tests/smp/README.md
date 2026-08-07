# SMP concurrency stress test
#
# Runs with --cpus 3.  Two background `bigfile` writers run
# concurrently with a foreground one on ext2 and on FAT32 at the same
# time, every file is verified afterwards, and `stressfs` runs inside
# each mount point.  Exercises backend allocators under true
# concurrency (C1 regression).
