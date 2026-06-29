#include "types.h"
#include "param.h"
#include "memlayout.h"
#include "riscv.h"
#include "spinlock.h"
#include "sleeplock.h"
#include "defs.h"
#include "fs.h"
#include "buf.h"

void
hal_intr_init(void)
{
  apicinit();
  extioiinit();
}

void
hal_intr_inithart(void)
{
}

int
hal_irq_claim(void)
{
  return 0;
}

void
hal_irq_complete(int irq)
{
  (void)irq;
}

void
hal_disk_init(void)
{
  ramdiskinit();
}

void
hal_disk_rw(struct buf *b, int write)
{
  ramdiskrw(b, write);
}
