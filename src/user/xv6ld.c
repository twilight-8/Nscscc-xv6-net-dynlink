// Minimal ELF64 interpreter for xv6's native syscall ABI.
#include "kernel/types.h"
#include "kernel/elf.h"
#include "user/user.h"

enum {
  DT_NULL, DT_NEEDED, DT_PLTRELSZ,
  DT_HASH = 4, DT_STRTAB, DT_SYMTAB, DT_RELA, DT_RELASZ, DT_RELAENT,
  DT_STRSZ, DT_SYMENT, DT_INIT, DT_FINI, DT_REL = 17, DT_RELSZ,
  DT_PLTREL = 20, DT_TEXTREL = 22, DT_JMPREL, DT_INIT_ARRAY = 25,
  DT_RELR = 36,
};

struct dyn { uint64 tag, val; };
struct rela { uint64 offset, info, addend; };
struct sym {
  uint name;
  uchar info, other;
  ushort shndx;
  uint64 value, size;
};

struct object {
  uint64 base, need, syms, relsz, pltsz;
  const char *str;
  const struct sym *sym;
  const struct rela *rel, *plt;
};

static void __attribute__((noreturn))
bad(void)
{
  const char msg[] = "xv6-ld: unsupported or missing dynamic dependency\n";
  write(2, msg, sizeof(msg)-1);
  exit(127);
}

static void
decode(struct object *o, uint64 base, const struct proghdr *ph, uint64 n)
{
  const struct dyn *d = 0;
  uint64 nd = 0, pltrel = 0;
  o->base = base;
  for(uint64 i = 0; i < n; i++){
    if(ph[i].type == ELF_PROG_DYNAMIC){
      d = (const void *)(base + ph[i].vaddr);
      nd = ph[i].memsz / sizeof(*d);
    }
  }
  if(!d)
    bad();
  for(; nd && d->tag != DT_NULL; nd--, d++){
    uint64 v = d->val;
    const void *ptr = (const void *)(base + v);
    switch(d->tag){
    case DT_NEEDED:
      if(o->need || !v) bad();
      o->need = v;
      break;
    case DT_STRTAB: o->str = ptr; break;
    case DT_SYMTAB: o->sym = ptr; break;
    case DT_HASH: o->syms = ((const uint *)ptr)[1]; break;
    case DT_RELA: o->rel = ptr; break;
    case DT_RELASZ: o->relsz = v; break;
    case DT_JMPREL: o->plt = ptr; break;
    case DT_PLTRELSZ: o->pltsz = v; break;
    case DT_PLTREL: pltrel = v; break;
    case DT_RELAENT: if(v != sizeof(struct rela)) bad(); break;
    case DT_SYMENT: if(v != sizeof(struct sym)) bad(); break;
    case DT_REL: case DT_TEXTREL: case DT_RELR:
    case DT_INIT: case DT_FINI: case DT_INIT_ARRAY:
      bad();
    }
  }
  if(!nd || !o->str || !o->sym || !o->syms ||
     (o->relsz && (!o->rel || o->relsz % sizeof(struct rela))) ||
     (o->pltsz && (!o->plt || o->pltsz % sizeof(struct rela) || pltrel != DT_RELA)))
    bad();
}

static int
equal(const char *a, const char *b)
{
  while(*a && *a == *b)
    a++, b++;
  return *a == *b;
}

static uint64
lookup(const struct object *o, const char *name)
{
  for(uint64 i = 1; i < o->syms; i++){
    const struct sym *s = &o->sym[i];
    if(s->shndx && (s->info >> 4) && equal(name, o->str + s->name))
      return o->base + s->value;
  }
  return 0;
}

static void
relocate(const struct object *o, const struct object *other, const struct rela *r, uint64 bytes)
{
  // R_RISCV_* and R_LARCH_* share these ELF64 relocation numbers.
  for(uint64 i = 0; i < bytes / sizeof(*r); i++){
    uint type = r[i].info;
    uint idx = r[i].info >> 32;
    uint64 *slot = (void *)(o->base + r[i].offset);
    if(type == 0)
      continue;
    if(type == 3){ // RELATIVE
      *slot = o->base + r[i].addend;
      continue;
    }
    if((type != 2 && type != 5) || idx >= o->syms) // 64 or JUMP_SLOT
      bad();
    const struct sym *s = &o->sym[idx];
    uint64 value = s->shndx ? o->base + s->value : lookup(other, o->str + s->name);
    if(!value && (s->info >> 4) != 2) // undefined non-weak symbol
      bad();
    *slot = value + (type == 2 ? r[i].addend : 0);
  }
}

int __attribute__((noreturn))
main(int argc, char **argv)
{
  uint64 *aux = (uint64 *)(argv + argc + 2);
  uint64 phdr = 0, n = 0, entry = 0;
  for(; aux[0]; aux += 2){
    if(aux[0] == 3) phdr = aux[1];
    if(aux[0] == 5) n = aux[1];
    if(aux[0] == 9) entry = aux[1];
  }
  if(!phdr || !n || !entry)
    bad();
  // exec maps the main PIE with load bias zero.
  struct object prog = {0}, lib = {0};
  decode(&prog, 0, (void *)phdr, n);
  if(!prog.need)
    bad();
  char path[128] = "/";
  const char *name = prog.str + prog.need;
  int i = 0;
  for(; name[i]; i++){
    if(i == sizeof(path)-2 || name[i] == '/')
      bad();
    path[i+1] = name[i];
  }
  path[i+1] = 0;
  uint64 base = (uint64)dlmap(path);
  if(base == (uint64)-1)
    bad();
  const struct elfhdr *e = (void *)base;
  if(e->magic != ELF_MAGIC || e->phentsize != sizeof(struct proghdr))
    bad();
  decode(&lib, base, (void *)(base + e->phoff), e->phnum);
  if(lib.need)
    bad();
  relocate(&lib, &prog, lib.rel, lib.relsz);
  relocate(&lib, &prog, lib.plt, lib.pltsz);
  relocate(&prog, &lib, prog.rel, prog.relsz);
  relocate(&prog, &lib, prog.plt, prog.pltsz);
  exit(((int (*)(int, char **))entry)(argc, argv));
}
