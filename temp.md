wsl -d Ubuntu-24.04

make test_baseline && make run
make public_vfs && make run
make ext2 && make run
make fat32 && make run
make error && make run
make semantics && make run
make persist && make run

cd src
make ARCH=riscv CPUS=1 qemu
usertests -q

make loongarch_baseline && make run
make loongarch_public_vfs && make run
make loongarch_ext2 && make run
make loongarch_fat32 && make run
make loongarch_error && make run
make loongarch_semantics && make run
make loongarch_persist && make run