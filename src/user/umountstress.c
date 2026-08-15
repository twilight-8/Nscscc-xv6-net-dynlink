// SPDX-License-Identifier: BSD-2-Clause
#include "kernel/types.h"
#include "kernel/stat.h"
#include "kernel/fcntl.h"
#include "user/user.h"

#define LOOPS 80

static void
lookup_worker(void)
{
  char buf[32];
  int fd, i;

  for(i = 0; i < LOOPS; i++){
    fd = open("/mnt/hello.c", O_RDONLY);
    if(fd >= 0){
      if(read(fd, buf, sizeof(buf)) <= 0){
        close(fd);
        exit(1);
      }
      close(fd);
    }
  }
  exit(0);
}

static void
topology_worker(void)
{
  int i;

  for(i = 0; i < LOOPS; i++){
    if(umount("/mnt") == 0 && mount("ext2", "/mnt", 2) < 0)
      exit(1);
  }
  exit(0);
}

int
main(void)
{
  char buf[32];
  int fd, i, status;

  // An open inode must keep the mount busy.
  fd = open("/mnt/hello.c", O_RDONLY);
  if(fd < 0 || umount("/mnt") == 0){
    printf("umountstress: FAIL open busy\n");
    exit(1);
  }
  close(fd);

  for(i = 0; i < 2; i++){
    if(fork() == 0)
      lookup_worker();
    if(fork() == 0)
      topology_worker();
  }

  for(i = 0; i < 4; i++){
    if(wait(&status) < 0 || status != 0){
      printf("umountstress: FAIL child\n");
      exit(1);
    }
  }

  fd = open("/mnt/hello.c", O_RDONLY);
  if(fd < 0){
    if(mount("ext2", "/mnt", 2) < 0)
      goto fail;
    fd = open("/mnt/hello.c", O_RDONLY);
  }
  if(fd < 0 || read(fd, buf, sizeof(buf)) <= 0)
    goto fail;
  close(fd);

  printf("UMOUNT_STRESS_OK\n");
  exit(0);

fail:
  if(fd >= 0)
    close(fd);
  printf("umountstress: FAIL final state\n");
  exit(1);
}
