#ifndef XV6_VFS_H
#define XV6_VFS_H

#include "types.h"

struct inode;
struct mount;
struct stat;

enum fs_type {
  FS_NONE = 0,
  FS_XV6 = 1,
  FS_EXT2,
  FS_FAT32,
};

#define NMOUNT 8

// Per-inode operations. Each filesystem backend provides its own table.
struct inode_ops {
  int  (*read)(struct inode *ip, int user_dst, uint64 dst, uint off, uint n);
  int  (*write)(struct inode *ip, int user_src, uint64 src, uint off, uint n);
  void (*stat)(struct inode *ip, struct stat *st);
  void (*trunc)(struct inode *ip);
  struct inode *(*lookup)(struct inode *dp, char *name);
  struct inode *(*create)(struct inode *dp, char *name, short type, short major, short minor);
};

// Per-filesystem operations. Each backend validates and initializes a mount.
struct fs_ops {
  int (*mount)(struct mount *mnt);
};

struct mount {
  int used;
  enum fs_type fstype;
  uint dev;
  struct inode *mountpoint;
  struct inode *root;
  struct fs_ops *fsops;
  void *fs_private;
};

#endif
