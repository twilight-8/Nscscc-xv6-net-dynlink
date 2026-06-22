#include "types.h"
#include "riscv.h"
#include "defs.h"
#include "fs.h"
#include "spinlock.h"
#include "sleeplock.h"
#include "file.h"
#include "vfs.h"

// The default backend is the original xv6 filesystem.
static struct inode_ops xv6_inode_ops = {
  .read = readi,
  .write = writei,
  .stat = stati,
  .trunc = itrunc,
};

void
vfsinit(void)
{
}

void
vfs_init_inode(struct inode *ip)
{
  ip->fstype = FS_XV6;
  ip->mnt = 0;
  ip->ops = &xv6_inode_ops;
  ip->fs_private = 0;
}

int
vfs_readi(struct inode *ip, int user_dst, uint64 dst, uint off, uint n)
{
  if(ip == 0 || ip->ops == 0 || ip->ops->read == 0)
    return -1;
  return ip->ops->read(ip, user_dst, dst, off, n);
}

int
vfs_writei(struct inode *ip, int user_src, uint64 src, uint off, uint n)
{
  if(ip == 0 || ip->ops == 0 || ip->ops->write == 0)
    return -1;
  return ip->ops->write(ip, user_src, src, off, n);
}

void
vfs_stati(struct inode *ip, struct stat *st)
{
  if(ip == 0 || ip->ops == 0 || ip->ops->stat == 0)
    return;
  ip->ops->stat(ip, st);
}

void
vfs_itrunc(struct inode *ip)
{
  if(ip == 0 || ip->ops == 0 || ip->ops->trunc == 0)
    return;
  ip->ops->trunc(ip);
}
