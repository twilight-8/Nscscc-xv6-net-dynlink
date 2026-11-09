// Exercise the raw Ethernet ABI using QEMU's default user-network addresses.
#include "kernel/types.h"
#include "user/user.h"

static const uchar mac[6] = {0x52, 0x54, 0, 0x12, 0x34, 0x56};
static const uchar local[4] = {10, 0, 2, 15};
static const uchar peer[4] = {10, 0, 2, 2};
static uchar gateway[6], rx[1514];

enum { ETH = 14, IP = 20, UDP = 8, PORT = 32123, CLIENT = 32124 };

static void
put16(uchar *p, uint v)
{
  p[0] = v >> 8;
  p[1] = v;
}

static uint
get16(const uchar *p)
{
  return (p[0] << 8) | p[1];
}

static uint
checksum(const uchar *p, int len)
{
  uint sum = 0;
  for(int i = 0; i < len; i += 2)
    sum += get16(p+i);
  while(sum >> 16)
    sum = (sum & 0xffff) + (sum >> 16);
  return (~sum) & 0xffff;
}

static void
send(uchar *frame, int len)
{
  for(int i = 0; i < 20; i++){
    int n = nettx(frame, len);
    if(n == len)
      return;
    if(n < 0)
      break;
    pause(1);
  }
  fprintf(2, "UDPCHECK_FAIL transmit\n");
  exit(1);
}

static void
arp(const uchar *target_mac, const uchar *target_ip, int reply)
{
  uchar frame[60] = {0};
  if(reply)
    memmove(frame, target_mac, 6);
  else
    memset(frame, 0xff, 6);
  memmove(frame+6, mac, 6);
  put16(frame+12, 0x806);
  uchar *a = frame+ETH;
  put16(a, 1);
  put16(a+2, 0x800);
  a[4] = 6;
  a[5] = 4;
  put16(a+6, reply ? 2 : 1);
  memmove(a+8, mac, 6);
  memmove(a+14, local, 4);
  if(reply)
    memmove(a+18, target_mac, 6);
  memmove(a+24, target_ip, 4);
  send(frame, sizeof(frame));
}

// Process ARP while waiting for UDP so the gateway can learn our MAC.
static int
receive(void)
{
  int n = netrx(rx, sizeof(rx));
  if(n < 0){
    fprintf(2, "UDPCHECK_FAIL receive\n");
    exit(1);
  }
  if(n >= ETH+28 && get16(rx+12) == 0x806){
    const uchar *a = rx+ETH;
    if(get16(a) == 1 && get16(a+2) == 0x800 && a[4] == 6 && a[5] == 4 &&
       memcmp(a+24, local, 4) == 0){
      if(get16(a+6) == 1)
        arp(a+8, a+14, 1);
      if(get16(a+6) == 2 && memcmp(a+14, peer, 4) == 0)
        memmove(gateway, a+8, 6);
    }
  }
  return n;
}

static void
send_udp(int seq)
{
  uchar frame[60] = {0}, *ip = frame+ETH, *udp = ip+IP;
  memmove(frame, gateway, 6);
  memmove(frame+6, mac, 6);
  put16(frame+12, 0x800);
  ip[0] = 0x45;
  put16(ip+2, IP+UDP+4);
  put16(ip+4, seq);
  ip[8] = 64;
  ip[9] = 17;
  memmove(ip+12, local, 4);
  memmove(ip+16, peer, 4);
  put16(ip+10, checksum(ip, IP));
  put16(udp, CLIENT);
  put16(udp+2, PORT);
  put16(udp+4, UDP+4);
  put16(udp+8, 0x5856);
  put16(udp+10, seq);
  send(frame, sizeof(frame));
}

static int
echoed(int n, int seq)
{
  const uchar *ip = rx+ETH, *udp = ip+IP;
  return n >= ETH+IP+UDP+4 && get16(rx+12) == 0x800 &&
    ip[0] == 0x45 && ip[9] == 17 && get16(ip+2) == IP+UDP+4 &&
    !(get16(ip+6) & 0x3fff) && checksum(ip, IP) == 0 &&
    memcmp(ip+12, peer, 4) == 0 && memcmp(ip+16, local, 4) == 0 &&
    get16(udp) == PORT && get16(udp+2) == CLIENT && get16(udp+4) == UDP+4 &&
    get16(udp+8) == 0x5856 && get16(udp+10) == seq;
}

int
main(void)
{
  arp(0, peer, 0);
  for(int i = 0; !gateway[0] && i < 30; i++){
    receive();
    if(!gateway[0])
      pause(1);
  }
  if(!gateway[0]){
    fprintf(2, "UDPCHECK_FAIL no ARP reply\n");
    exit(1);
  }
  // Exceed the number of ring slots to exercise descriptor reuse.
  for(int seq = 1; seq <= 24; seq++){
    send_udp(seq);
    int i;
    for(i = 0; i < 30; i++){
      if(echoed(receive(), seq))
        break;
      pause(1);
    }
    if(i == 30){
      fprintf(2, "UDPCHECK_FAIL missing echo %d\n", seq);
      exit(1);
    }
  }
  printf("UDPCHECK_PASS 24 echoes\n");
  exit(0);
}
