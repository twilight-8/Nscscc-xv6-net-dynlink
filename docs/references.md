# References

> 本文件记录该项目的参考资料

## Base

- MIT xv6-riscv rev5  
  https://github.com/mit-pdos/xv6-riscv/releases/tag/xv6-riscv-rev5

## xv6

- xv6-riscv book  
  https://github.com/mit-pdos/xv6-riscv-book

## Architecture

- RISC-V specifications  
  https://riscv.org/technical/specifications/

- LoongArch Reference Manual  
  https://loongson.github.io/LoongArch-Documentation/LoongArch-Vol1-EN.html

## Tests

- xv6-extend-vfs tests  
  https://github.com/yanjun-wen/xv6-extend-vfs/tree/main/tests

## File Systems

- The Second Extended File System documentation  
  https://www.nongnu.org/ext2-doc/ext2.html

- Microsoft FAT specification  
  https://download.microsoft.com/download/1/6/1/161ba512-40e2-4cc9-843a-923143f3456c/fatgen103.doc

## Previous Projects

- xv6-loongarch-exp  
  https://github.com/SKT-CPUOS/xv6-loongarch-exp.git

LoongArch64 启动、trap、页表和中断相关代码参考该项目，并按当前 xv6-riscv rev5 与本项目 VFS/HAL 结构做了裁剪和适配。

- 2025 年操作系统全国赛内核赛道参考项目  
  https://gitlab.eduxiji.net/educg-group-36002-2710490/T202510558995330-264.git

- 2025 年操作系统全国赛内核赛道参考项目  
  https://gitlab.eduxiji.net/educg-group-36002-2710490/T202510486995232-2402.git

上述参考项目用于对照 LoongArch64 架构启动、TLB refill、virtio-pci 和 HAL 组织方式；本项目只保留教学所需的轻量实现。
