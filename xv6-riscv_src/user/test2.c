#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/fcntl.h"

int
main(int argc, char *argv[])
{
  int src, dst, n, failed;
  char buf[512];

  (void)argc;
  (void)argv;

  src = open("hello.c", O_RDONLY);
  if(src < 0){
    printf("test2: open source failed\n");
    exit(1);
  }

  dst = open("/mnt/hello.c", O_WRONLY | O_CREATE);
  if(dst < 0){
    printf("test2: open destination failed\n");
    close(src);
    exit(1);
  }

  failed = 0;
  while((n = read(src, buf, sizeof(buf))) > 0){
    if(write(dst, buf, n) != n){
      failed = 1;
      break;
    }
  }
  if(n < 0)
    failed = 1;

  close(src);
  close(dst);

  if(failed){
    printf("test2: failed\n");
    exit(1);
  }

  printf("test2: succeed\n");
  exit(0);
}
