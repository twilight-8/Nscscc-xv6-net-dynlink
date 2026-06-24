#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/fcntl.h"

#define LEN 1024

static int
copy_file(const char *src, const char *dst)
{
  int inf, outf, n;
  char buf[LEN];

  if((inf = open(src, O_RDONLY)) < 0){
    fprintf(2, "test1: open %s failed\n", src);
    return 1;
  }

  if((outf = open(dst, O_WRONLY | O_CREATE | O_TRUNC)) < 0){
    fprintf(2, "test1: open %s failed\n", dst);
    close(inf);
    return 1;
  }

  while((n = read(inf, buf, sizeof(buf))) > 0){
    if(write(outf, buf, n) != n){
      fprintf(2, "test1: write failed\n");
      close(inf);
      close(outf);
      return 1;
    }
  }

  close(inf);
  close(outf);
  if(n < 0)
    return 1;

  printf("copy %s -> %s: ok\n", src, dst);
  return 0;
}

int
main(int argc, char *argv[])
{
  int failed = 0;

  (void)argc;
  (void)argv;

  failed |= copy_file("/mnt/hello.c", "/hello.c");
  failed |= copy_file("/mnt/hello.c", "/tests/hello.c");
  failed |= copy_file("/hello.c", "/mnt/hello.c");
  failed |= copy_file("/tests/hello.c", "/mnt/hello.c");

  if(failed)
    printf("test1: failed\n");
  else
    printf("test1: succeed\n");
  exit(failed);
}
