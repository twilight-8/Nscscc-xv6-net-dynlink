# Commands sent to the xv6 shell for VFS error-path stability.

mount ext2 /no_such_dir
mkdir /mnt
mkdir /fat
mount ext2 /mnt
mount fat32 /fat
ln /mnt/hello.c /fat/cross.txt
rm /mnt/no_such_file
rm /fat/no_such.txt
echo ERROR_PATH_DONE
