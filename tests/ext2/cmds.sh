# Commands sent to the xv6 shell for the ext2 smoke test.

mkdir /mnt
mount ext2 /mnt
cat /mnt/hello.c
echo ext2-first > /mnt/a.txt
cat /mnt/a.txt
echo ext2-second > /mnt/a.txt
cat /mnt/a.txt
rm /mnt/a.txt
echo EXT2_DONE
