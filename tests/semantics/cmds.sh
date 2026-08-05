# Commands sent to the xv6 shell for VFS mount/link semantics.

echo VFS_PARENT_OK > /parent.txt
mkdir /mnt
mkdir /fat
mount ext2 /mnt
mount fat32 /fat
cat /mnt/../parent.txt
cat /fat/../parent.txt
ln /mnt/hello.c /mnt/hlink.c
cat /mnt/hlink.c
echo fat-link > /fat/a.txt
ln /fat/a.txt /fat/b.txt
unlinkopen /mnt/uop.txt
unlinkopen /fat/uop.txt
echo SEMANTICS_DONE
