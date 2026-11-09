dltest 7
mkdir /ext
mount ext2 /ext
cat /dltest > /ext/dltest
/ext/dltest 7
mkdir /fat
mount fat32 /fat
cat /dltest > /fat/dltest
/fat/dltest 7
ln /libdltest.so /dllsaved
rm /libdltest.so
dltest 7
ln /dllsaved /libdltest.so
rm /dllsaved
dltest 7
