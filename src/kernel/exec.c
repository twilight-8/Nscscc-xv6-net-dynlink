#include "types.h"
#include "param.h"
#include "memlayout.h"
#include "riscv.h"
#include "spinlock.h"
#include "proc.h"
#include "defs.h"
#include "elf.h"
#include "fs.h"
#include "sleeplock.h"
#include "file.h"
#include "stat.h"

static int loadseg(pde_t *, uint64, struct inode *, uint, uint);

static uint64
flags2perm(uint flags)
{
  uint64 perm = (flags & ELF_PROG_FLAG_WRITE) ? PTE_W : 0;
#ifdef ARCH_LOONGARCH
  if(!(flags & ELF_PROG_FLAG_EXEC))
    perm |= PTE_NX;
#else
  if(flags & ELF_PROG_FLAG_EXEC)
    perm |= PTE_X;
#endif
  return perm;
}

// Keep images contiguous for xv6 fork/sbrk. Each ELF may span at most
// 16 MiB, including gaps, and may not overlap the trapframe or another image.
struct image {
  uint64 entry, phdr, phnum;
  char interp[MAXPATH];
};

static int
loadelf(struct inode *ip, pagetable_t pt, uint64 base, uint64 *sz,
        int shared, struct image *im)
{
  struct elfhdr e;
  struct proghdr ph;
  int executable = 0;
  uint64 headers;

  if(ip->type != T_FILE ||
     vfs_readi(ip, 0, (uint64)&e, 0, sizeof(e)) != sizeof(e))
    return -1;
#ifdef ARCH_LOONGARCH
  const int machine = 258;
#else
  const int machine = 243;
#endif
  if(e.magic != ELF_MAGIC || e.elf[0] != 2 || e.elf[1] != 1 ||
     e.machine != machine || (shared ? e.type != ELF_DYN :
                              (e.type != ELF_EXEC && e.type != ELF_DYN)) ||
     e.phentsize != sizeof(ph) || e.phnum == 0 || e.phnum > 128 ||
     e.phoff > ip->size || (uint64)e.phnum * sizeof(ph) > ip->size - e.phoff ||
     e.entry >= (16UL << 20) || base >= TRAPFRAME)
    return -1;
  headers = e.phoff + e.phnum * sizeof(ph);
  memset(im, 0, sizeof(*im));
  im->entry = base + e.entry;
  im->phnum = e.phnum;

  for(int i = 0; i < e.phnum; i++){
    if(vfs_readi(ip, 0, (uint64)&ph, e.phoff + i*sizeof(ph), sizeof(ph)) != sizeof(ph))
      return -1;
    if(ph.type != ELF_PROG_LOAD && ph.type != ELF_PROG_INTERP)
      continue;
    if(ph.off > ip->size || ph.filesz > ip->size - ph.off)
      return -1;
    if(ph.type == ELF_PROG_INTERP){
      if(shared || im->interp[0] || ph.filesz < 2 || ph.filesz > sizeof(im->interp) ||
         vfs_readi(ip, 0, (uint64)im->interp, ph.off, ph.filesz) != ph.filesz ||
         im->interp[0] != '/' || im->interp[ph.filesz - 1] != 0)
        return -1;
      continue;
    }
    if(ph.memsz == 0 && ph.filesz == 0)
      continue;
    if(ph.filesz > ph.memsz || ph.vaddr >= (16UL << 20) ||
       ph.memsz > (16UL << 20) - ph.vaddr ||
       (e.type == ELF_DYN && (ph.vaddr % PGSIZE != ph.off % PGSIZE ||
                             (ph.flags & 3) == 3)) || base + ph.vaddr + ph.memsz >= TRAPFRAME)
      return -1;
    uint64 va = base + ph.vaddr;
    uint64 start = PGROUNDDOWN(va);
    if(start < PGROUNDUP(*sz))
      return -1;
    if(start > *sz){
      if(uvmalloc(pt, *sz, start, flags2perm(0)) == 0)
        return -1;
      *sz = start;
    }
    uint64 end = va + ph.memsz;
    if(uvmalloc(pt, *sz, end, flags2perm(ph.flags)) == 0)
      return -1;
    *sz = end;
    if(loadseg(pt, va, ip, ph.off, ph.filesz) < 0)
      return -1;
    if(ph.off <= e.phoff && headers <= ph.off + ph.filesz)
      im->phdr = va + e.phoff - ph.off;
    if((ph.flags & ELF_PROG_FLAG_EXEC) && im->entry >= va && im->entry < end)
      executable = 1;
  }
  if(*sz <= base || (!shared && !executable) ||
     (im->interp[0] && !im->phdr))
    return -1;
  if(!executable)
    im->entry = 0;
  return 0;
}

static int
mapimage(char *path, pagetable_t pt, uint64 base, uint64 *sz, struct image *im)
{
  int rc = -1;
  begin_op();
  struct inode *ip = namei(path);
  if(ip){
    ilock(ip);
    rc = loadelf(ip, pt, base, sz, 1, im);
    iunlockput(ip);
  }
  end_op();
  return rc;
}

// Map a position-independent shared object above the existing heap. xv6
// owns these pages until exec/exit, just like the rest of the process image.
uint64
sys_dlmap(void)
{
  char path[MAXPATH];
  struct image im;
  struct proc *p = myproc();
  uint64 old = p->sz, sz = old, base = PGROUNDUP(old);
  if(argstr(0, path, sizeof(path)) < 0)
    return -1;
  if(mapimage(path, p->pagetable, base, &sz, &im) < 0){
    uvmdealloc(p->pagetable, sz, old);
    return -1;
  }
  p->sz = sz;
  return base;
}

//
// the implementation of the exec() system call
//
int
kexec(char *path, char **argv)
{
  char *s, *last;
  uint64 argc, sz = 0, sp, ustack[MAXARG], stackbase;
  struct image prog, interp;
  struct inode *ip;
  pagetable_t pagetable = 0, oldpagetable;
  struct proc *p = myproc();

  begin_op();

  // Open the executable file.
  ip = namei(path);
  if(ip == 0 && path[0] != '/'){
    // Bare command names (no '/') fall back to the root directory,
    // so programs installed in "/" work from any working directory.
    int i, slash;
    char rootpath[MAXPATH];

    slash = 0;
    for(i = 0; path[i]; i++)
      if(path[i] == '/')
        slash = 1;
    if(!slash && strlen(path) + 2 <= sizeof(rootpath)){
      rootpath[0] = '/';
      safestrcpy(rootpath + 1, path, sizeof(rootpath) - 1);
      ip = namei(rootpath);
    }
  }
  if(ip == 0){
    end_op();
    return -1;
  }
  ilock(ip);

  if((pagetable = proc_pagetable(p)) == 0 ||
     loadelf(ip, pagetable, 0, &sz, 0, &prog) < 0)
    goto bad;
  iunlockput(ip);
  end_op();
  ip = 0;

  uint64 entry = prog.entry, base = 0;
  if(prog.interp[0]){
    base = PGROUNDUP(sz);
    if(mapimage(prog.interp, pagetable, base, &sz, &interp) < 0 ||
       interp.entry == 0)
      goto bad;
    entry = interp.entry;
  }

  p = myproc();
  uint64 oldsz = p->sz;

  // Allocate some pages at the next page boundary.
  // Make the first inaccessible as a stack guard.
  // Use the rest as the user stack.
  sz = PGROUNDUP(sz);
  uint64 sz1;
  if(sz + (USERSTACK+1)*PGSIZE >= TRAPFRAME)
    goto bad;
  if((sz1 = uvmalloc(pagetable, sz, sz + (USERSTACK+1)*PGSIZE, flags2perm(ELF_PROG_FLAG_WRITE))) == 0)
    goto bad;
  sz = sz1;
  uvmclear(pagetable, sz-(USERSTACK+1)*PGSIZE);
  sp = sz;
  stackbase = sp - USERSTACK*PGSIZE;

  // Copy argument strings into new stack, remember their
  // addresses in ustack[].
  for(argc = 0; argv[argc]; argc++) {
    if(argc >= MAXARG)
      goto bad;
    sp -= strlen(argv[argc]) + 1;
    sp -= sp % 16; // riscv sp must be 16-byte aligned
    if(sp < stackbase)
      goto bad;
    if(copyout(pagetable, sp, argv[argc], strlen(argv[argc]) + 1) < 0)
      goto bad;
    ustack[argc] = sp;
  }
  ustack[argc] = 0;

  uint64 argp;
  if(prog.interp[0]){
    // ELF interpreter stack: argc, argv, empty envp, auxiliary vector.
    uint64 aux[] = {0, 3, prog.phdr, 4, sizeof(struct proghdr),
                    5, prog.phnum, 6, PGSIZE, 7, base, 9, prog.entry, 0, 0};
    uint64 bytes = sizeof(aux) + (argc + 2)*sizeof(uint64);
    sp = (sp - bytes) & ~15UL;
    argp = sp + sizeof(uint64);
    if(sp < stackbase ||
       copyout(pagetable, sp, (char *)&argc, sizeof(argc)) < 0 ||
       copyout(pagetable, argp, (char *)ustack, (argc+1)*sizeof(uint64)) < 0 ||
       copyout(pagetable, argp+(argc+1)*sizeof(uint64), (char *)aux, sizeof(aux)) < 0)
      goto bad;
  } else {
    sp = (sp - (argc+1)*sizeof(uint64)) & ~15UL;
    argp = sp;
    if(sp < stackbase ||
       copyout(pagetable, sp, (char *)ustack, (argc+1)*sizeof(uint64)) < 0)
      goto bad;
  }
  p->trapframe->a1 = argp;

  // Save program name for debugging.
  for(last=s=path; *s; s++)
    if(*s == '/')
      last = s+1;
  safestrcpy(p->name, last, sizeof(p->name));
    
  // Commit to the user image.
  oldpagetable = p->pagetable;
  p->pagetable = pagetable;
  p->sz = sz;
#ifdef ARCH_LOONGARCH
  p->trapframe->era = entry;
#else
  p->trapframe->epc = entry;
#endif
  p->trapframe->sp = sp; // initial stack pointer
  proc_freepagetable(oldpagetable, oldsz);

  return argc; // this ends up in a0, the first argument to main(argc, argv)

 bad:
  if(pagetable)
    proc_freepagetable(pagetable, sz);
  if(ip){
    iunlockput(ip);
    end_op();
  }
  return -1;
}

// Load an ELF program segment into pagetable at virtual address va.
// and the pages from va to va+sz must already be mapped.
// Returns 0 on success, -1 on failure.
static int
loadseg(pagetable_t pagetable, uint64 va, struct inode *ip, uint offset, uint sz)
{
  uint i, n;
  uint64 pa;

  for(i = 0; i < sz; i += n){
    uint64 addr = va + i;
    pa = walkaddr(pagetable, PGROUNDDOWN(addr));
    if(pa == 0)
      return -1;
    n = PGSIZE - addr % PGSIZE;
    if(n > sz - i)
      n = sz - i;
#ifdef ARCH_LOONGARCH
    pa |= DMWIN_MASK;
#endif
    if(vfs_readi(ip, 0, pa + addr % PGSIZE, offset+i, n) != n)
      return -1;
  }
  
  return 0;
}
