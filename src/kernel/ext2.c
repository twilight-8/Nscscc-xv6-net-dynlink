#include "types.h"
#include "riscv.h"
#include "defs.h"
#include "param.h"
#include "stat.h"
#include "spinlock.h"
#include "sleeplock.h"
#include "fs.h"
#include "file.h"
#include "vfs.h"

#define EXT2_SUPER_OFFSET 1024
#define EXT2_SUPER_MAGIC  0xEF53
#define EXT2_ROOT_INO     2
#define EXT2_N_BLOCKS     15
#define EXT2_NAME_MAX     255

#define EXT2_S_IFREG      0x8000
#define EXT2_S_IFDIR      0x4000

#define EXT2_FT_REG_FILE  1

struct ext2_super {
  uint s_inodes_count;
  uint s_blocks_count;
  uint s_r_blocks_count;
  uint s_free_blocks_count;
  uint s_free_inodes_count;
  uint s_first_data_block;
  uint s_log_block_size;
  int  s_log_frag_size;
  uint s_blocks_per_group;
  uint s_frags_per_group;
  uint s_inodes_per_group;
  uint s_mtime;
  uint s_wtime;
  ushort s_mnt_count;
  ushort s_max_mnt_count;
  ushort s_magic;
  ushort s_state;
  ushort s_errors;
  ushort s_minor_rev_level;
  uint s_lastcheck;
  uint s_checkinterval;
  uint s_creator_os;
  uint s_rev_level;
  ushort s_def_resuid;
  ushort s_def_resgid;
  uint s_first_ino;
  ushort s_inode_size;
  ushort s_block_group_nr;
} __attribute__((packed));

struct ext2_group_desc {
  uint bg_block_bitmap;
  uint bg_inode_bitmap;
  uint bg_inode_table;
  ushort bg_free_blocks_count;
  ushort bg_free_inodes_count;
} __attribute__((packed));

struct ext2_dinode {
  ushort i_mode;
  ushort i_uid;
  uint i_size;
  uint i_atime;
  uint i_ctime;
  uint i_mtime;
  uint i_dtime;
  ushort i_gid;
  ushort i_links_count;
  uint i_blocks;
  uint i_flags;
  uint i_osd1;
  uint i_block[EXT2_N_BLOCKS];
  uint i_generation;
  uint i_file_acl;
  uint i_dir_acl;
  uint i_faddr;
  uchar i_osd2[12];
} __attribute__((packed));

struct ext2_dirent {
  uint inode;
  ushort rec_len;
  uchar name_len;
  uchar file_type;
  char name[EXT2_NAME_MAX];
} __attribute__((packed));

struct ext2_fs {
  int used;
  uint dev;
  uint block_size;
  uint inode_size;
  struct ext2_super sb;
  struct ext2_group_desc gd;
};

static struct ext2_fs ext2fs;

static struct inode_ops ext2_inode_ops;
static struct fs_ops ext2_fs_ops;

static uint
ext2_min(uint a, uint b)
{
  return a < b ? a : b;
}

static uint
ext2_block_offset(struct ext2_fs *fs, uint blockno)
{
  return blockno * fs->block_size;
}

static uint
ext2_align4(uint n)
{
  return (n + 3) & ~3;
}

static int
ext2_namelen(char *name)
{
  int len;

  for(len = 0; len < DIRSIZ && name[len]; len++)
    ;
  return len;
}

static int
ext2_nameeq(char *a, char *b, int blen)
{
  int alen = ext2_namelen(a);

  if(alen != blen)
    return 0;
  return memcmp(a, b, alen) == 0;
}

static int
ext2_read_dinode(struct ext2_fs *fs, uint inum, struct ext2_dinode *di)
{
  uint index, off;

  if(inum == 0 || inum > fs->sb.s_inodes_count)
    return -1;

  index = inum - 1;
  off = ext2_block_offset(fs, fs->gd.bg_inode_table) + index * fs->inode_size;
  return block_read_bytes(fs->dev, off, (uchar*)di, sizeof(*di));
}

static int
ext2_write_dinode(struct ext2_fs *fs, uint inum, struct ext2_dinode *di)
{
  uint index, off;

  if(inum == 0 || inum > fs->sb.s_inodes_count)
    return -1;

  index = inum - 1;
  off = ext2_block_offset(fs, fs->gd.bg_inode_table) + index * fs->inode_size;
  return block_write_bytes(fs->dev, off, (uchar*)di, sizeof(*di));
}

static short
ext2_mode_to_type(ushort mode)
{
  if((mode & EXT2_S_IFDIR) == EXT2_S_IFDIR)
    return T_DIR;
  return T_FILE;
}

static ushort
ext2_type_to_mode(short type)
{
  if(type == T_DIR)
    return EXT2_S_IFDIR | 0755;
  return EXT2_S_IFREG | 0644;
}

static void
ext2_fill_inode(struct inode *ip, struct mount *mnt, struct ext2_dinode *di)
{
  int i;

  ip->fstype = FS_EXT2;
  ip->mnt = mnt;
  ip->ops = &ext2_inode_ops;
  ip->type = ext2_mode_to_type(di->i_mode);
  ip->major = 0;
  ip->minor = 0;
  ip->nlink = di->i_links_count;
  ip->size = di->i_size;
  for(i = 0; i < NDIRECT; i++)
    ip->addrs[i] = di->i_block[i];
  ip->addrs[NDIRECT] = di->i_block[12];
  ip->valid = 1;
}

static struct inode*
ext2_iget(struct mount *mnt, uint inum)
{
  struct ext2_fs *fs = (struct ext2_fs*)mnt->fs_private;
  struct ext2_dinode di;
  struct inode *ip;

  if(ext2_read_dinode(fs, inum, &di) < 0)
    return 0;
  if(di.i_mode == 0)
    return 0;

  ip = iget(mnt->dev, inum);
  ext2_fill_inode(ip, mnt, &di);
  return ip;
}

static int
ext2_sync_inode(struct inode *ip)
{
  struct ext2_fs *fs = (struct ext2_fs*)ip->mnt->fs_private;
  struct ext2_dinode di;
  uint blocks;
  int i;

  if(ext2_read_dinode(fs, ip->inum, &di) < 0)
    return -1;

  di.i_mode = ext2_type_to_mode(ip->type);
  di.i_size = ip->size;
  di.i_links_count = ip->nlink;
  blocks = 0;
  for(i = 0; i < NDIRECT; i++){
    di.i_block[i] = ip->addrs[i];
    if(ip->addrs[i])
      blocks++;
  }
  di.i_block[12] = ip->addrs[NDIRECT];
  if(ip->addrs[NDIRECT])
    blocks++;
  di.i_block[13] = 0;
  di.i_block[14] = 0;
  di.i_blocks = blocks * (fs->block_size / 512);

  if(ext2_write_dinode(fs, ip->inum, &di) < 0)
    return -1;
  return 0;
}

static int
ext2_write_super(struct ext2_fs *fs)
{
  return block_write_bytes(fs->dev, EXT2_SUPER_OFFSET, (uchar*)&fs->sb,
                           sizeof(fs->sb));
}

static int
ext2_write_group(struct ext2_fs *fs)
{
  uint gd_block = fs->sb.s_first_data_block + 1;

  return block_write_bytes(fs->dev, ext2_block_offset(fs, gd_block),
                           (uchar*)&fs->gd, sizeof(fs->gd));
}

static int
ext2_test_bit(uchar *buf, uint bit)
{
  return (buf[bit / 8] & (1 << (bit % 8))) != 0;
}

static void
ext2_set_bit(uchar *buf, uint bit)
{
  buf[bit / 8] |= 1 << (bit % 8);
}

static void
ext2_clear_bit(uchar *buf, uint bit)
{
  buf[bit / 8] &= ~(1 << (bit % 8));
}

static uint
ext2_alloc_block(struct ext2_fs *fs)
{
  uchar bitmap[BSIZE];
  uint i, blockno, start;

  if(block_read_bytes(fs->dev, ext2_block_offset(fs, fs->gd.bg_block_bitmap),
                      bitmap, BSIZE) < 0)
    return 0;

  start = fs->sb.s_first_data_block;
  for(i = 0; i < fs->sb.s_blocks_per_group; i++){
    if(!ext2_test_bit(bitmap, i)){
      ext2_set_bit(bitmap, i);
      blockno = start + i;
      if(block_write_bytes(fs->dev,
                           ext2_block_offset(fs, fs->gd.bg_block_bitmap),
                           bitmap, BSIZE) < 0)
        return 0;
      if(fs->sb.s_free_blocks_count)
        fs->sb.s_free_blocks_count--;
      if(fs->gd.bg_free_blocks_count)
        fs->gd.bg_free_blocks_count--;
      ext2_write_super(fs);
      ext2_write_group(fs);
      memset(bitmap, 0, BSIZE);
      block_write_bytes(fs->dev, ext2_block_offset(fs, blockno),
                        bitmap, BSIZE);
      return blockno;
    }
  }

  return 0;
}

static void
ext2_free_block(struct ext2_fs *fs, uint blockno)
{
  uchar bitmap[BSIZE];
  uint bit;

  if(blockno == 0)
    return;
  if(block_read_bytes(fs->dev, ext2_block_offset(fs, fs->gd.bg_block_bitmap),
                      bitmap, BSIZE) < 0)
    return;
  bit = blockno - fs->sb.s_first_data_block;
  if(ext2_test_bit(bitmap, bit)){
    ext2_clear_bit(bitmap, bit);
    block_write_bytes(fs->dev, ext2_block_offset(fs, fs->gd.bg_block_bitmap),
                      bitmap, BSIZE);
    fs->sb.s_free_blocks_count++;
    fs->gd.bg_free_blocks_count++;
    ext2_write_super(fs);
    ext2_write_group(fs);
  }
}

static uint
ext2_alloc_inode(struct ext2_fs *fs)
{
  uchar bitmap[BSIZE];
  uint i, inum, first;

  if(block_read_bytes(fs->dev, ext2_block_offset(fs, fs->gd.bg_inode_bitmap),
                      bitmap, BSIZE) < 0)
    return 0;

  first = fs->sb.s_first_ino;
  if(first == 0)
    first = 11;

  for(i = first - 1; i < fs->sb.s_inodes_per_group; i++){
    if(!ext2_test_bit(bitmap, i)){
      ext2_set_bit(bitmap, i);
      inum = i + 1;
      if(block_write_bytes(fs->dev,
                           ext2_block_offset(fs, fs->gd.bg_inode_bitmap),
                           bitmap, BSIZE) < 0)
        return 0;
      if(fs->sb.s_free_inodes_count)
        fs->sb.s_free_inodes_count--;
      if(fs->gd.bg_free_inodes_count)
        fs->gd.bg_free_inodes_count--;
      ext2_write_super(fs);
      ext2_write_group(fs);
      return inum;
    }
  }

  return 0;
}

static uint
ext2_bmap(struct inode *ip, uint bn, int alloc)
{
  struct ext2_fs *fs = (struct ext2_fs*)ip->mnt->fs_private;
  uchar buf[BSIZE];
  uint *indirect;
  uint blockno;

  if(bn < NDIRECT){
    if(ip->addrs[bn] == 0 && alloc)
      ip->addrs[bn] = ext2_alloc_block(fs);
    return ip->addrs[bn];
  }

  bn -= NDIRECT;
  if(bn >= fs->block_size / sizeof(uint))
    return 0;

  if(ip->addrs[NDIRECT] == 0){
    if(!alloc)
      return 0;
    ip->addrs[NDIRECT] = ext2_alloc_block(fs);
    if(ip->addrs[NDIRECT] == 0)
      return 0;
  }

  if(block_read_bytes(fs->dev, ext2_block_offset(fs, ip->addrs[NDIRECT]),
                      buf, fs->block_size) < 0)
    return 0;

  indirect = (uint*)buf;
  blockno = indirect[bn];
  if(blockno == 0 && alloc){
    blockno = ext2_alloc_block(fs);
    if(blockno == 0)
      return 0;
    indirect[bn] = blockno;
    block_write_bytes(fs->dev, ext2_block_offset(fs, ip->addrs[NDIRECT]),
                      buf, fs->block_size);
  }

  return blockno;
}

static struct inode*
ext2_lookup(struct inode *dp, char *name)
{
  struct ext2_fs *fs = (struct ext2_fs*)dp->mnt->fs_private;
  uchar buf[BSIZE];
  struct ext2_dirent *de;
  uint off, bno, pos;

  if(dp->type != T_DIR)
    return 0;

  for(off = 0; off < dp->size; off += fs->block_size){
    bno = ext2_bmap(dp, off / fs->block_size, 0);
    if(bno == 0)
      continue;
    if(block_read_bytes(fs->dev, ext2_block_offset(fs, bno),
                        buf, fs->block_size) < 0)
      return 0;
    for(pos = 0; pos < fs->block_size; ){
      de = (struct ext2_dirent*)(buf + pos);
      if(de->rec_len < 8 || pos + de->rec_len > fs->block_size)
        break;
      if(de->inode != 0 && de->name_len <= DIRSIZ &&
         ext2_nameeq(name, de->name, de->name_len))
        return ext2_iget(dp->mnt, de->inode);
      pos += de->rec_len;
    }
  }

  return 0;
}

static int
ext2_dir_add(struct inode *dp, char *name, uint inum)
{
  struct ext2_fs *fs = (struct ext2_fs*)dp->mnt->fs_private;
  uchar buf[BSIZE];
  struct ext2_dirent *de, *newde;
  uint off, bno, pos, namelen, need, actual;

  namelen = ext2_namelen(name);
  if(namelen == 0 || namelen > EXT2_NAME_MAX)
    return -1;
  need = ext2_align4(8 + namelen);

  for(off = 0; off < dp->size; off += fs->block_size){
    bno = ext2_bmap(dp, off / fs->block_size, 0);
    if(bno == 0)
      continue;
    if(block_read_bytes(fs->dev, ext2_block_offset(fs, bno),
                        buf, fs->block_size) < 0)
      return -1;
    for(pos = 0; pos < fs->block_size; ){
      de = (struct ext2_dirent*)(buf + pos);
      if(de->rec_len < 8 || pos + de->rec_len > fs->block_size)
        break;
      actual = ext2_align4(8 + de->name_len);
      if(de->rec_len >= actual + need){
        newde = (struct ext2_dirent*)(buf + pos + actual);
        newde->inode = inum;
        newde->rec_len = de->rec_len - actual;
        newde->name_len = namelen;
        newde->file_type = EXT2_FT_REG_FILE;
        memmove(newde->name, name, namelen);
        de->rec_len = actual;
        return block_write_bytes(fs->dev, ext2_block_offset(fs, bno),
                                 buf, fs->block_size) == fs->block_size ? 0 : -1;
      }
      pos += de->rec_len;
    }
  }

  bno = ext2_bmap(dp, dp->size / fs->block_size, 1);
  if(bno == 0)
    return -1;
  memset(buf, 0, sizeof(buf));
  de = (struct ext2_dirent*)buf;
  de->inode = inum;
  de->rec_len = fs->block_size;
  de->name_len = namelen;
  de->file_type = EXT2_FT_REG_FILE;
  memmove(de->name, name, namelen);
  if(block_write_bytes(fs->dev, ext2_block_offset(fs, bno),
                       buf, fs->block_size) != fs->block_size)
    return -1;
  dp->size += fs->block_size;
  ext2_sync_inode(dp);
  return 0;
}

static struct inode*
ext2_create(struct inode *dp, char *name, short type, short major, short minor)
{
  struct ext2_fs *fs = (struct ext2_fs*)dp->mnt->fs_private;
  struct ext2_dinode di;
  uint inum;

  (void)major;
  (void)minor;

  if(type != T_FILE)
    return 0;

  inum = ext2_alloc_inode(fs);
  if(inum == 0)
    return 0;

  memset(&di, 0, sizeof(di));
  di.i_mode = ext2_type_to_mode(T_FILE);
  di.i_links_count = 1;
  if(ext2_write_dinode(fs, inum, &di) < 0)
    return 0;

  if(ext2_dir_add(dp, name, inum) < 0)
    return 0;

  return ext2_iget(dp->mnt, inum);
}

static int
ext2_readi(struct inode *ip, int user_dst, uint64 dst, uint off, uint n)
{
  struct ext2_fs *fs = (struct ext2_fs*)ip->mnt->fs_private;
  struct dirent xde;
  uchar buf[BSIZE];
  struct ext2_dirent *de;
  uint tot, m, bno, want, seen, pos;

  if(ip->type == T_DIR){
    if(n < sizeof(xde) || off % sizeof(xde) != 0)
      return 0;
    want = off / sizeof(xde);
    seen = 0;
    for(off = 0; off < ip->size; off += fs->block_size){
      bno = ext2_bmap(ip, off / fs->block_size, 0);
      if(bno == 0)
        continue;
      if(block_read_bytes(fs->dev, ext2_block_offset(fs, bno),
                          buf, fs->block_size) < 0)
        return -1;
      for(pos = 0; pos < fs->block_size; ){
        de = (struct ext2_dirent*)(buf + pos);
        if(de->rec_len < 8 || pos + de->rec_len > fs->block_size)
          break;
        if(de->inode != 0 && de->name_len <= DIRSIZ){
          if(seen++ == want){
            memset(&xde, 0, sizeof(xde));
            xde.inum = de->inode;
            memmove(xde.name, de->name, de->name_len);
            if(either_copyout(user_dst, dst, (char*)&xde, sizeof(xde)) < 0)
              return -1;
            return sizeof(xde);
          }
        }
        pos += de->rec_len;
      }
    }
    return 0;
  }

  if(off > ip->size || off + n < off)
    return 0;
  if(off + n > ip->size)
    n = ip->size - off;

  for(tot = 0; tot < n; tot += m, off += m, dst += m){
    bno = ext2_bmap(ip, off / fs->block_size, 0);
    m = ext2_min(n - tot, fs->block_size - off % fs->block_size);
    if(bno == 0){
      memset(buf, 0, fs->block_size);
    } else if(block_read_bytes(fs->dev, ext2_block_offset(fs, bno),
                               buf, fs->block_size) < 0){
      return -1;
    }
    if(either_copyout(user_dst, dst, buf + off % fs->block_size, m) < 0)
      return -1;
  }

  return tot;
}

static int
ext2_writei(struct inode *ip, int user_src, uint64 src, uint off, uint n)
{
  struct ext2_fs *fs = (struct ext2_fs*)ip->mnt->fs_private;
  uchar buf[BSIZE];
  uint tot, m, bno;

  if(off + n < off)
    return -1;

  for(tot = 0; tot < n; tot += m, off += m, src += m){
    bno = ext2_bmap(ip, off / fs->block_size, 1);
    if(bno == 0)
      break;
    if(block_read_bytes(fs->dev, ext2_block_offset(fs, bno),
                        buf, fs->block_size) < 0)
      return -1;
    m = ext2_min(n - tot, fs->block_size - off % fs->block_size);
    if(either_copyin(buf + off % fs->block_size, user_src, src, m) < 0)
      return -1;
    if(block_write_bytes(fs->dev, ext2_block_offset(fs, bno),
                         buf, fs->block_size) < 0)
      return -1;
  }

  if(off > ip->size)
    ip->size = off;
  ext2_sync_inode(ip);

  return tot;
}

static void
ext2_stati(struct inode *ip, struct stat *st)
{
  st->dev = ip->dev;
  st->ino = ip->inum;
  st->type = ip->type;
  st->nlink = ip->nlink;
  st->size = ip->size;
}

static void
ext2_itrunc(struct inode *ip)
{
  struct ext2_fs *fs = (struct ext2_fs*)ip->mnt->fs_private;
  uchar buf[BSIZE];
  uint *indirect;
  int i;

  for(i = 0; i < NDIRECT; i++){
    if(ip->addrs[i]){
      ext2_free_block(fs, ip->addrs[i]);
      ip->addrs[i] = 0;
    }
  }

  if(ip->addrs[NDIRECT]){
    if(block_read_bytes(fs->dev, ext2_block_offset(fs, ip->addrs[NDIRECT]),
                        buf, fs->block_size) == fs->block_size){
      indirect = (uint*)buf;
      for(i = 0; i < fs->block_size / sizeof(uint); i++)
        if(indirect[i])
          ext2_free_block(fs, indirect[i]);
    }
    ext2_free_block(fs, ip->addrs[NDIRECT]);
    ip->addrs[NDIRECT] = 0;
  }

  ip->size = 0;
  ext2_sync_inode(ip);
}

static int
ext2_mount(struct mount *mnt)
{
  struct ext2_super sb;
  struct ext2_group_desc gd;
  uint block_size, inode_size, gd_block;

  if(ext2fs.used)
    return -1;

  if(block_read_bytes(mnt->dev, EXT2_SUPER_OFFSET, (uchar*)&sb,
                      sizeof(sb)) < 0)
    return -1;
  if(sb.s_magic != EXT2_SUPER_MAGIC)
    return -1;

  block_size = 1024 << sb.s_log_block_size;
  if(block_size != BSIZE)
    return -1;

  inode_size = sb.s_inode_size;
  if(inode_size == 0)
    inode_size = 128;
  if(inode_size < sizeof(struct ext2_dinode))
    return -1;

  gd_block = sb.s_first_data_block + 1;
  if(block_read_bytes(mnt->dev, gd_block * block_size, (uchar*)&gd,
                      sizeof(gd)) < 0)
    return -1;

  memset(&ext2fs, 0, sizeof(ext2fs));
  ext2fs.used = 1;
  ext2fs.dev = mnt->dev;
  ext2fs.block_size = block_size;
  ext2fs.inode_size = inode_size;
  ext2fs.sb = sb;
  ext2fs.gd = gd;

  mnt->fs_private = &ext2fs;
  mnt->root = ext2_iget(mnt, EXT2_ROOT_INO);
  if(mnt->root == 0){
    memset(&ext2fs, 0, sizeof(ext2fs));
    mnt->fs_private = 0;
    return -1;
  }

  return 0;
}

static struct inode_ops ext2_inode_ops = {
  .read = ext2_readi,
  .write = ext2_writei,
  .stat = ext2_stati,
  .trunc = ext2_itrunc,
  .lookup = ext2_lookup,
  .create = ext2_create,
};

static struct fs_ops ext2_fs_ops = {
  .mount = ext2_mount,
};

struct fs_ops*
ext2_get_fs_ops(void)
{
  return &ext2_fs_ops;
}
