// 该文件用于负责定义虚拟文件层 VFS 需要的结构体和接口


#ifndef XV6_VFS_H
#define XV6_VFS_H

#include "types.h"    // 变量类型库，uint 表示 unsigned int，uint64表示 unsigned long

struct inode;
struct mount;
struct stat;

enum fs_type {        // 文件系统类型
  FS_NONE = 0,        // 文件系统未初始化
  FS_XV6 = 1,         // xv6
  FS_EXT2,            // EXT2
  FS_FAT32,           // FAT32
};

/*
文件元信息
struct stat {
  int dev;            // 设备号
  uint ino;           // inode 编号
  short type;         // 文件类型
  short nlink;        // 链接数
  uint64 size;        // 文件大小
};
*/

struct inode_ops {    // inode 操作表（针对某个文件或目录）————说明了 inode 支持哪些操作
                      // read读，对应xv6的int readi(struct inode *ip, int user_dst, uint64 dst, uint off, uint n);
                      // write写，对应xv6的int writei(struct inode *ip, int user_src, uint64 src, uint off, uint n);
                      // stat获取文件元信息，对应xv6的void stati(struct inode *ip, struct stat *st);
                      // trunc截断文件内容，对应xv6的void itrunc(struct inode *ip);
  int  (*read)(struct inode *ip, int user_dst, uint64 dst, uint off, uint n);
  int  (*write)(struct inode *ip, int user_src, uint64 src, uint off, uint n);
  void (*stat)(struct inode *ip, struct stat *st);
  void (*trunc)(struct inode *ip);
};

struct fs_ops {        // 文件系统操作表（针对某个文件系统）
                       // root给定挂载实例，返回该文件系统根目录的 inode
  struct inode *(*root)(struct mount *mnt);
};

struct mount {         // 该结构体表示一次具体的文件系统挂载
  int used;            // 是否正在使用
  enum fs_type fstype; // 哪种文件系统
  uint dev;            // 设备号
  struct inode *root;  // 被挂载文件系统的根目录的inode
  struct fs_ops *fsops;// 该挂载实例使用哪套文件系统的系统级操作
};

#endif
