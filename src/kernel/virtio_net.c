// QEMU virtio-net with split queues and polling. Buffers remain pinned
// for the lifetime of the device. Only Ethernet frames cross the user ABI.
#include "types.h"
#include "param.h"
#include "memlayout.h"
#include "riscv.h"
#include "spinlock.h"
#include "proc.h"
#include "defs.h"
#include "virtio.h"

#define HEADER 12 // virtio 1.x header, with num_buffers
#define FRAME 1514
#define RX 0
#define TX 1

#ifdef ARCH_LOONGARCH
#include "virtio_pci.h"
static struct virtio_pci_device net;
#define DMA(p) ((uint64)(p) & ~DMWIN_MASK)
#else
#define REG(off) (*(volatile uint32 *)(VIRTIO_NET + (off)))
#define DMA(p) ((uint64)(p))
#endif

struct queue {
  struct virtq_desc desc[NUM] __attribute__((aligned(16)));
  struct virtq_avail avail __attribute__((aligned(2)));
  volatile struct virtq_used used __attribute__((aligned(4)));
  char buffer[NUM][FRAME + HEADER];
  uint16 consumed;
};
static struct queue queues[2];
static struct spinlock lock;
static int ready;
static uchar tx_busy[NUM];

static void
status(int value)
{
#ifdef ARCH_LOONGARCH
  net.common->device_status = value;
#else
  REG(VIRTIO_MMIO_STATUS) = value;
#endif
}

static int
features(void)
{
#ifdef ARCH_LOONGARCH
  net.common->device_feature_select = 1;
  uint32 offered = net.common->device_feature;
#else
  REG(VIRTIO_MMIO_DEVICE_FEATURES + 4) = 1;
  uint32 offered = REG(VIRTIO_MMIO_DEVICE_FEATURES);
#endif
  if(!(offered & 1))
    return -1;
#ifdef ARCH_LOONGARCH
  net.common->driver_feature_select = 0;
  net.common->driver_feature = 0;
  net.common->driver_feature_select = 1;
  net.common->driver_feature = 1;
#else
  REG(VIRTIO_MMIO_DRIVER_FEATURES + 4) = 0;
  REG(VIRTIO_MMIO_DRIVER_FEATURES) = 0;
  REG(VIRTIO_MMIO_DRIVER_FEATURES + 4) = 1;
  REG(VIRTIO_MMIO_DRIVER_FEATURES) = 1;
#endif
  status(11);
#ifdef ARCH_LOONGARCH
  return (net.common->device_status & 8) ? 0 : -1;
#else
  return (REG(VIRTIO_MMIO_STATUS) & 8) ? 0 : -1;
#endif
}

static int
setupqueue(int which)
{
  struct queue *q = &queues[which];
  q->avail.flags = 1; // VIRTQ_AVAIL_F_NO_INTERRUPT
  for(int i = 0; i < NUM; i++){
    q->desc[i].addr = DMA(q->buffer[i]);
    if(which == RX){
      q->desc[i].len = sizeof(q->buffer[i]);
      q->desc[i].flags = VRING_DESC_F_WRITE;
      q->avail.ring[i] = i;
    }
  }
  q->avail.idx = which == RX ? NUM : 0;
#ifdef ARCH_LOONGARCH
  net.common->queue_select = which;
  if(net.common->queue_size < NUM)
    return -1;
  net.common->queue_size = NUM;
  net.common->queue_desc = DMA(q->desc);
  net.common->queue_driver = DMA(&q->avail);
  net.common->queue_device = DMA(&q->used);
  net.common->queue_msix_vector = 0xffff;
  net.common->queue_enable = 1;
#else
  REG(VIRTIO_MMIO_QUEUE_SEL) = which;
  if(REG(VIRTIO_MMIO_QUEUE_NUM_MAX) < NUM)
    return -1;
  REG(VIRTIO_MMIO_QUEUE_NUM) = NUM;
  // RISC-V's kernel and DMA addresses are identity mapped.
  REG(VIRTIO_MMIO_QUEUE_DESC_LOW) = DMA(q->desc);
  REG(VIRTIO_MMIO_QUEUE_DESC_HIGH) = DMA(q->desc) >> 32;
  REG(VIRTIO_MMIO_DRIVER_DESC_LOW) = DMA(&q->avail);
  REG(VIRTIO_MMIO_DRIVER_DESC_HIGH) = DMA(&q->avail) >> 32;
  REG(VIRTIO_MMIO_DEVICE_DESC_LOW) = DMA(&q->used);
  REG(VIRTIO_MMIO_DEVICE_DESC_HIGH) = DMA(&q->used) >> 32;
  REG(VIRTIO_MMIO_QUEUE_READY) = 1;
#endif
  return 0;
}

static void
notify(int which)
{
  __sync_synchronize();
#ifdef ARCH_LOONGARCH
  net.common->queue_select = which;
  uint64 offset = (uint64)net.common->queue_notify_off * net.notify_multiplier;
  *(volatile uint16 *)((uint64)net.notify + offset) = which;
#else
  REG(VIRTIO_MMIO_QUEUE_NOTIFY) = which;
#endif
}

void
virtio_net_init(void)
{
#ifdef ARCH_LOONGARCH
  if(virtio_pci_probe(0x1041, &net, 1) < 0)
    return;
#else
  if(REG(VIRTIO_MMIO_MAGIC_VALUE) != 0x74726976 ||
     REG(VIRTIO_MMIO_VERSION) != 2 || REG(VIRTIO_MMIO_DEVICE_ID) != 1)
    return;
#endif
  initlock(&lock, "virtio-net");
  status(0);
  status(1);
  status(3);
  if(features() < 0 || setupqueue(RX) < 0 || setupqueue(TX) < 0){
    status(128);
    return;
  }
  __sync_synchronize();
  status(15);
  notify(RX);
  ready = 1;
}

static void
publish(struct queue *q, int id, int which)
{
  q->avail.ring[q->avail.idx % NUM] = id;
  __sync_synchronize();
  q->avail.idx++;
  notify(which);
}

uint64
sys_nettx(void)
{
  uint64 addr;
  int len;
  argaddr(0, &addr);
  argint(1, &len);
  if(!ready || len < 14 || len > FRAME)
    return -1;
  struct queue *q = &queues[TX];
  acquire(&lock);
  uint16 used = q->used.idx;
  __sync_synchronize();
  while(q->consumed != used){
    uint id = q->used.ring[q->consumed++ % NUM].id;
    if(id < NUM)
      tx_busy[id] = 0;
  }
  int id;
  for(id = 0; id < NUM && tx_busy[id]; id++)
    ;
  if(id == NUM){
    release(&lock);
    return 0;
  }
  memset(q->buffer[id], 0, HEADER);
  if(copyin(myproc()->pagetable, q->buffer[id] + HEADER, addr, len) < 0){
    release(&lock);
    return -1;
  }
  q->desc[id].len = HEADER + len;
  tx_busy[id] = 1;
  publish(q, id, TX);
  release(&lock);
  return len;
}

uint64
sys_netrx(void)
{
  uint64 addr;
  int capacity;
  argaddr(0, &addr);
  argint(1, &capacity);
  if(!ready || capacity < 14 || capacity > FRAME)
    return -1;
  struct queue *q = &queues[RX];
  acquire(&lock);
  if(q->used.idx == q->consumed){
    release(&lock);
    return 0;
  }
  __sync_synchronize();
  uint id = q->used.ring[q->consumed % NUM].id;
  uint size = q->used.ring[q->consumed % NUM].len;
  q->consumed++;
  int rc = -1;
  if(id < NUM){
    if(size >= HEADER + 14 && size <= HEADER + capacity &&
       copyout(myproc()->pagetable, addr, q->buffer[id] + HEADER, size - HEADER) == 0)
      rc = size - HEADER;
    publish(q, id, RX);
  }
  release(&lock);
  return rc;
}
