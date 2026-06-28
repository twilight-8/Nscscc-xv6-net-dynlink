#include "types.h"
#include "riscv.h"
#include "defs.h"
#include "param.h"
#include "stat.h"
#include "fs.h"
#include "spinlock.h"
#include "sleeplock.h"
#include "file.h"
#include "vfs.h"

static struct {
  struct spinlock lock;
  struct mount mount[NMOUNT];
} mtable;

// The default backend is the original xv6 filesystem.
static struct inode*
xv6_lookup(struct inode *dp, char *name)
{
  return dirlookup(dp, name, 0);
}

static int
xv6_link(struct inode *ip, struct inode *dp, char *name)
{
  ilock(ip);
  if(ip->type == T_DIR){
    iunlock(ip);
    return -1;
  }

  ip->nlink++;
  iupdate(ip);
  iunlock(ip);

  ilock(dp);
  if(dp->dev != ip->dev || dirlink(dp, name, ip->inum) < 0){
    iunlock(dp);
    ilock(ip);
    ip->nlink--;
    iupdate(ip);
    iunlock(ip);
    return -1;
  }
  iunlock(dp);

  return 0;
}

static struct inode_ops xv6_inode_ops = {
  .read = readi,
  .write = writei,
  .stat = stati,
  .trunc = itrunc,
  .lookup = xv6_lookup,
  .create = 0,
  .link = xv6_link,
};

static int
xv6_mount(struct mount *mnt)
{
  if(mnt == 0)
    return -1;
  mnt->root = 0;
  mnt->fs_private = 0;
  return 0;
}

static struct fs_ops xv6_fs_ops = {
  .mount = xv6_mount,
};

static enum fs_type
vfs_parse_fstype(char *fstype)
{
  if(strncmp(fstype, "xv6", 4) == 0)
    return FS_XV6;
  if(strncmp(fstype, "ext2", 5) == 0)
    return FS_EXT2;
  if(strncmp(fstype, "fat32", 6) == 0)
    return FS_FAT32;
  return FS_NONE;
}

static struct fs_ops*
vfs_fsops(enum fs_type fstype)
{
  switch(fstype){
  case FS_XV6:
    return &xv6_fs_ops;
  case FS_EXT2:
    return ext2_get_fs_ops();
  case FS_FAT32:
    return fat32_get_fs_ops();
  default:
    return 0;
  }
}

void
vfsinit(void)
{
  struct mount *root;

  initlock(&mtable.lock, "mtable");

  root = &mtable.mount[0];
  root->used = 1;
  root->fstype = FS_XV6;
  root->dev = ROOTDEV;
  root->mountpoint = 0;
  root->root = 0;
  root->fsops = &xv6_fs_ops;
  root->fs_private = 0;
  if(root->fsops->mount(root) < 0)
    panic("vfsinit: xv6 mount");
}

void
vfs_init_inode(struct inode *ip)
{
  ip->fstype = FS_XV6;
  ip->mnt = &mtable.mount[0];
  ip->ops = &xv6_inode_ops;
}

int
vfs_mount(char *fstype, char *path, int dev)
{
  enum fs_type type;
  struct fs_ops *ops;
  struct inode *mp, *parent;
  struct mount *mnt;
  char name[DIRSIZ];
  int free, i;

  if(fstype == 0 || path == 0 || dev <= 0)
    return -1;

  type = vfs_parse_fstype(fstype);
  ops = vfs_fsops(type);
  if(type == FS_NONE || ops == 0)
    return -1;

  if(path[0] == '/' && path[1] == '\0')
    return -1;

  begin_op();

  if((parent = nameiparent(path, name)) == 0){
    end_op();
    return -1;
  }

  if((mp = namei(path)) == 0){
    iput(parent);
    end_op();
    return -1;
  }

  ilock(mp);
  if(mp->type != T_DIR){
    iunlockput(mp);
    iput(parent);
    end_op();
    return -1;
  }
  iunlock(mp);

  free = -1;
  acquire(&mtable.lock);
  for(i = 1; i < NMOUNT; i++){
    if(mtable.mount[i].used &&
       mtable.mount[i].mountpoint != 0 &&
       mtable.mount[i].mountpoint->dev == mp->dev &&
       mtable.mount[i].mountpoint->inum == mp->inum){
      release(&mtable.lock);
      iput(mp);
      iput(parent);
      end_op();
      return -1;
    }
    if(!mtable.mount[i].used && free < 0)
      free = i;
  }

  if(free < 0){
    release(&mtable.lock);
    iput(mp);
    iput(parent);
    end_op();
    return -1;
  }

  mnt = &mtable.mount[free];
  memset(mnt, 0, sizeof(*mnt));
  mnt->used = 1;
  mnt->fstype = type;
  mnt->dev = dev;
  mnt->mountpoint = mp;
  mnt->parent = parent;
  mnt->root = 0;
  mnt->fsops = ops;
  mnt->fs_private = 0;
  release(&mtable.lock);

  if(ops->mount(mnt) < 0){
    acquire(&mtable.lock);
    memset(mnt, 0, sizeof(*mnt));
    release(&mtable.lock);
    iput(mp);
    iput(parent);
    end_op();
    return -1;
  }

  end_op();
  return 0;
}

struct mount*
vfs_mountpoint(struct inode *ip)
{
  struct mount *mnt;
  int i;

  if(ip == 0)
    return 0;

  acquire(&mtable.lock);
  for(i = 1; i < NMOUNT; i++){
    mnt = &mtable.mount[i];
    if(mnt->used &&
       mnt->mountpoint != 0 &&
       mnt->mountpoint->dev == ip->dev &&
       mnt->mountpoint->inum == ip->inum){
      release(&mtable.lock);
      return mnt;
    }
  }
  release(&mtable.lock);

  return 0;
}

struct inode*
vfs_lookup(struct inode *dp, char *name)
{
  struct mount *mnt;
  struct inode *parent;
  int i;

  if(dp == 0 || dp->ops == 0 || dp->ops->lookup == 0)
    return 0;

  if(namecmp(name, "..") == 0){
    acquire(&mtable.lock);
    for(i = 1; i < NMOUNT; i++){
      mnt = &mtable.mount[i];
      if(mnt->used && mnt->root != 0 && mnt->parent != 0 &&
         mnt->root->dev == dp->dev && mnt->root->inum == dp->inum){
        parent = mnt->parent;
        release(&mtable.lock);
        return idup(parent);
      }
    }
    release(&mtable.lock);
  }

  return dp->ops->lookup(dp, name);
}

struct inode*
vfs_create(struct inode *dp, char *name, short type, short major, short minor)
{
  if(dp == 0 || dp->ops == 0 || dp->ops->create == 0)
    return 0;
  return dp->ops->create(dp, name, type, major, minor);
}

int
vfs_unlink(struct inode *dp, char *name)
{
  if(dp == 0 || dp->ops == 0 || dp->ops->unlink == 0)
    return -1;
  return dp->ops->unlink(dp, name);
}

int
vfs_link(struct inode *ip, struct inode *dp, char *name)
{
  if(ip == 0 || dp == 0 || ip->ops == 0 || ip->ops->link == 0)
    return -1;
  if(ip->fstype != dp->fstype || ip->dev != dp->dev)
    return -1;
  return ip->ops->link(ip, dp, name);
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
