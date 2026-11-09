#include "kernel/types.h"
#include "user/user.h"

extern int shared_add(int);
extern int shared_value;

int
main(int argc, char **argv)
{
  if(argc != 2 || argv[1][0] != '7' || shared_add(7) != 42 || shared_value != 35)
    return 1;
  const char msg[] = "DLTEST_PASS\n";
  return write(1, msg, sizeof(msg)-1) != sizeof(msg)-1;
}
