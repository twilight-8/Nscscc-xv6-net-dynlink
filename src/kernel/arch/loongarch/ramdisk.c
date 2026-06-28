//
// ramdisk that uses the disk image loaded by qemu -initrd fs.img
//

#include "types.h"
#include "loongarch.h"
#include "defs.h"
#include "param.h"
#include "memlayout.h"
#include "spinlock.h"
#include "sleeplock.h"
#include "fs.h"
#include "buf.h"

extern uchar _binary_fs_img_start[];
extern uchar _binary_fs_img_end[];

void
ramdiskinit(void)
{
}

// If B_DIRTY is set, write buf to disk, clear B_DIRTY, set B_VALID.
// Else if B_VALID is not set, read buf from disk, set B_VALID.
void
ramdiskrw(struct buf *b, int write)
{
  uint64 blockno;
  uint64 diskaddr;
  uint64 disksz;
  char *addr;

  if(!holdingsleep(&b->lock))
    panic("ramdiskrw: buf not locked");

  blockno = b->blockno;
  if(b->dev == EXT2DEV)
    blockno += FSSIZE;
  else if(b->dev == FAT32DEV)
    blockno += FAT32START;

  diskaddr = blockno * BSIZE;
  disksz = _binary_fs_img_end - _binary_fs_img_start;
  if(diskaddr + BSIZE > disksz)
    panic("ramdiskrw: blockno too big");

  addr = (char *)_binary_fs_img_start + diskaddr;

  if(write){
    memmove(addr, b->data, BSIZE);
  } else {
    memmove(b->data, addr, BSIZE);
  }
}
