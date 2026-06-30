# Commands sent to the xv6 shell for the public VFS test.
# The ext2 image is preloaded with /hello.c by src/Makefile.

mkdir /mnt
mount ext2 /mnt
ls /mnt
test1
test2
echo PUBLIC_VFS_DONE
