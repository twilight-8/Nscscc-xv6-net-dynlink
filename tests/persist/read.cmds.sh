# Second QEMU session: remount and read files written in the first session.

mount ext2 /mnt
mount fat32 /fat
cat /mnt/persist.txt
cat /fat/p.txt
echo PERSIST_READ_DONE
