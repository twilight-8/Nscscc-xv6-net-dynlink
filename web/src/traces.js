export const layerMeta = {
  user: { label: '用户态', tone: 'green' },
  trap: { label: '陷阱边界', tone: 'amber' },
  syscall: { label: '系统调用', tone: 'blue' },
  file: { label: '文件对象', tone: 'cyan' },
  vfs: { label: 'VFS 分发', tone: 'orange' },
  fs: { label: '文件系统', tone: 'violet' },
  block: { label: '块与 HAL', tone: 'red' },
};

const node = (id, layer, title, fn, file, line, role, params = [], variables = []) => ({
  id, layer, title, fn, file, line, role, params, variables,
});

const param = (name, type, meaning, value = '') => ({ name, type, meaning, value });

const commonEntry = (program, source, line, args) => [
  node('user', 'user', `${program} 用户程序`, 'main(int argc, char *argv[])', source, line,
    `解析 shell 传入的参数并发起文件系统调用。本次命令是“${args.raw || program}”。`, [
      param('argc', 'int', '参数个数，包含程序名本身', String(args.tokens.length)),
      param('argv', 'char **', '参数字符串指针数组，位于用户地址空间', args.tokens.join(' · ')),
    ]),
  node('ecall', 'trap', '进入内核', 'ecall → uservec → usertrap()', 'src/kernel/trampoline.S', 21,
    'RISC-V 使用 ecall 从用户态进入内核；LoongArch64 使用对应 syscall 异常入口。HAL 以上的文件系统语义保持一致。', [
      param('a7 / syscall no.', 'register', '系统调用号，决定内核调用哪个 sys_* 函数'),
      param('a0-a5', 'register', '系统调用参数寄存器；地址值此时仍是用户虚拟地址'),
    ]),
  node('dispatch', 'syscall', '系统调用分派', 'syscall(void)', 'src/kernel/syscall.c', 136,
    '从陷阱帧取得系统调用号，在 syscalls[] 表中找到处理函数，并把返回值写回用户寄存器。', [
      param('num', 'int', '从 trapframe 读取的系统调用号'),
      param('p->trapframe->a0', 'uint64', '处理完成后保存返回值的位置'),
    ]),
];

const backendFor = (target, state) => {
  const absolute = resolvePath(state.cwd, target || '.');
  if (state.mounts.ext2 && (absolute === state.mounts.ext2 || absolute.startsWith(`${state.mounts.ext2}/`)))
    return { type: 'ext2', label: 'ext2', lookup: 'ext2_lookup(dp, name)', file: 'src/kernel/ext2.c', line: 592 };
  if (state.mounts.fat32 && (absolute === state.mounts.fat32 || absolute.startsWith(`${state.mounts.fat32}/`)))
    return { type: 'fat32', label: 'FAT32', lookup: 'fat32_lookup(dp, name)', file: 'src/kernel/fat32.c', line: 1001 };
  return { type: 'xv6', label: 'xv6', lookup: 'dirlookup(dp, name, poff)', file: 'src/kernel/fs.c', line: 636 };
};

export function resolvePath(cwd, target = '.') {
  const raw = target.startsWith('/') ? target : `${cwd}/${target}`;
  const parts = [];
  for (const item of raw.split('/')) {
    if (!item || item === '.') continue;
    if (item === '..') parts.pop();
    else parts.push(item);
  }
  return `/${parts.join('/')}`;
}

function pathNodes(target, state, backend, parent = false) {
  const absolute = resolvePath(state.cwd, target);
  return [
    node('path', 'vfs', parent ? '解析父目录' : '解析路径', parent ? 'nameiparent(path, name)' : 'namei(path)', 'src/kernel/fs.c', parent ? 782 : 775,
      `将路径“${target}”逐分量解析。本次是${target.startsWith('/') ? '绝对路径，从 ROOTINO 开始' : `相对路径，从 cwd=${state.cwd} 开始`}。`, [
        param('path', 'char *', '待解析路径字符串；进入内核后已复制到内核缓冲区', target),
        param('name', 'char[DIRSIZ]', parent ? '输出最后一级名字' : 'namex() 内部暂存当前路径分量'),
      ], [
        { name: 'absolute path', meaning: '规范化后的目标路径', value: absolute },
        { name: 'ip', meaning: '当前正在解析的目录 inode 指针', value: target.startsWith('/') ? 'ROOTINO' : 'myproc()->cwd' },
      ]),
    node('lookup', 'vfs', `${backend.label} 目录查找`, `vfs_lookup() → ${backend.lookup}`, backend.file, backend.line,
      `由当前目录 inode 的 ops->lookup 分派到 ${backend.label} 后端，将路径分量名称转换为下一级 inode。`, [
        param('dp', 'struct inode *', 'directory pointer，当前目录的内存 inode'),
        param('name', 'char *', '当前路径分量名称'),
      ]),
  ];
}

function readTrace(args, state, program = 'cat') {
  const target = args.tokens[1] || '.';
  const backend = backendFor(target, state);
  const backendRead = {
    xv6: { fn: 'readi()', file: 'src/kernel/fs.c', line: 556 },
    ext2: { fn: 'ext2_readi()', file: 'src/kernel/ext2.c', line: 971 },
    fat32: { fn: 'fat32_readi()', file: 'src/kernel/fat32.c', line: 850 },
  }[backend.type];
  const blockFn = backend.type === 'xv6'
    ? 'bmap() → bread()'
    : backend.type === 'fat32' ? 'FAT 链 → block_read_bytes()' : 'block_read_bytes()';
  const blockFile = backend.type === 'xv6' ? 'src/kernel/fs.c' : 'src/kernel/block.c';
  const blockLine = backend.type === 'xv6' ? 467 : 17;
  return [
    ...commonEntry(program, `src/user/${program}.c`, program === 'cat' ? 25 : 77, args),
    ...pathNodes(target, state, backend),
    node('open', 'syscall', '打开文件', 'sys_open(void)', 'src/kernel/sysfile.c', 331,
      '校验用户参数和打开模式，得到 inode，并创建 struct file 与 fd 的映射。', [
        param('path', 'char *', '用户提供的路径，argstr() 将它复制到内核数组', target),
        param('omode', 'int', '打开方式；读取通常为 O_RDONLY', 'O_RDONLY'),
      ]),
    node('fd', 'file', '文件描述符映射', 'fd → proc->ofile[fd] → struct file', 'src/kernel/file.h', 3,
      '用户只持有整数 fd；内核的 struct file 保存可读权限、共享偏移 off 和 inode 指针 ip。', [
        param('fd', 'int', '当前进程文件描述符表的下标'),
        param('f->off', 'uint', '当前读取偏移，每次成功读取后增加'),
        param('f->ip', 'struct inode *', `指向 ${backend.label} 文件的内存 inode`),
      ]),
    node('read', 'file', '统一读取入口', 'fileread(struct file *f, uint64 addr, int n)', 'src/kernel/file.c', 107,
      '检查可读权限；普通文件经 inode 操作表读取，成功后推进共享文件偏移。', [
        param('f', 'struct file *', '内核打开文件对象，不是用户 fd'),
        param('addr', 'uint64', '接收数据的用户虚拟地址'),
        param('n', 'int', '本轮最多读取的字节数'),
      ]),
    node('vfsread', 'vfs', `${backend.label} 读分发`, `vfs_readi() → ${backendRead.fn}`, 'src/kernel/vfs.c', 478,
      `通过 ip->ops->read 调用 ${backend.label} 后端。上层 read() 接口和文件偏移语义不变。`, [
        param('ip', 'struct inode *', `所属文件系统为 ${backend.label}`),
        param('user_dst', 'int', '1 表示 dst 是用户虚拟地址', '1'),
        param('dst', 'uint64', '用户缓冲区虚拟地址'),
        param('off', 'uint', '本次读取的文件字节偏移'),
        param('n', 'uint', '请求读取字节数'),
      ]),
    node('fsread', 'fs', `${backend.label} 文件读取`, backendRead.fn, backendRead.file, backendRead.line,
      `${backend.label} 后端解释自己的 inode 和块映射格式，将文件偏移转换为后端能够读取的数据位置。`),
    node('block', 'block', '块定位与读取', blockFn, blockFile, blockLine,
      `${backend.label} 将文件内部位置换算成设备块号；块缓存命中时直接使用 RAM 中的 buf->data，未命中才访问磁盘。`, [
        param('dev', 'uint', '文件系统所在块设备号', backend.type === 'xv6' ? '1' : backend.type === 'ext2' ? '2' : '3'),
        param('blockno', 'uint', '文件系统块号，不是内存地址'),
        param('bp->data', 'uchar[BSIZE]', 'RAM 中保存目标磁盘块内容的数组'),
      ]),
    node('hal', 'block', '按平台访问磁盘', 'bread() → hal_disk_rw(bp, 0)', 'src/kernel/hal.c', 43,
      '仅在 buffer cache 未命中时进入 HAL；RISC-V 走 virtio-mmio，LoongArch 走 virtio-pci。'),
    node('copyout', 'syscall', '复制到用户内存', 'copyout(pagetable, dstva, src, len)', 'src/kernel/vm.c', 343,
      '遍历当前进程页表，把用户虚拟地址转换为物理页地址，再将块缓存中的字节复制到用户缓冲区。', [
        param('pagetable', 'pagetable_t', '当前进程用户页表'),
        param('dstva', 'uint64', '目标用户虚拟地址'),
        param('src', 'char *', '源内核地址，通常位于 bp->data'),
        param('len', 'uint64', '本轮复制字节数'),
      ]),
  ];
}

function lsTrace(args, state) {
  const trace = readTrace(args, state, 'ls');
  trace[0].role = '解析可选目录参数；随后调用 open/read/fstat，把目录文件中的目录项格式化输出。';
  trace.splice(-1, 0, node('dirent', 'fs', '遍历目录项', 'read(fd, &de, sizeof(de)) → stat(path, &st)', 'src/user/ls.c', 45,
    '目录也是文件。ls 逐项读取 struct dirent，其中 name 是名字、inum 是 inode 编号，再读取元数据后输出。', [
      param('de', 'struct dirent', '当前目录项，保存 name 与 inum'),
      param('st', 'struct stat', '目标类型、inode 编号、链接数与大小'),
    ]));
  return trace;
}

function writeTrace(args, state) {
  const redirect = args.tokens.indexOf('>');
  const target = redirect >= 0 ? args.tokens[redirect + 1] : '';
  if (!target) {
    return [
      ...commonEntry('echo', 'src/user/echo.c', 6, args),
      node('write', 'syscall', '写标准输出', 'write(1, text, len)', 'src/user/echo.c', 12,
        'fd=1 通常指向 console 设备，因此经 filewrite() 分派到设备驱动，而不是文件系统数据块。', [
          param('fd', 'int', '文件描述符；1 是标准输出', '1'),
          param('buf', 'char *', '待输出字符串的用户虚拟地址', args.tokens.slice(1).join(' ')),
          param('n', 'int', '字符串字节数'),
        ]),
      node('console', 'block', '控制台设备输出', 'devsw[CONSOLE].write → consolewrite()', 'src/kernel/console.c', 72,
        'struct file 的类型是 FD_DEVICE，filewrite() 按 major 设备号调用 console 驱动。'),
    ];
  }
  const backend = backendFor(target, state);
  const backendWrite = {
    xv6: { fn: 'writei()', file: 'src/kernel/fs.c', line: 590 },
    ext2: { fn: 'ext2_writei()', file: 'src/kernel/ext2.c', line: 1035 },
    fat32: { fn: 'fat32_writei()', file: 'src/kernel/fat32.c', line: 931 },
  }[backend.type];
  const blockWrite = backend.type === 'xv6' ? {
    fn: 'log_write(bp) → bwrite(bp)', file: 'src/kernel/log.c', line: 216,
  } : {
    fn: 'block_write_bytes()', file: 'src/kernel/block.c', line: 36,
  };
  return [
    ...commonEntry('echo', 'src/user/echo.c', 6, args),
    ...pathNodes(target, state, backend, true),
    node('create', 'syscall', '打开或创建目标', 'sys_open() → create()', 'src/kernel/sysfile.c', 331,
      'shell 先按 O_CREATE|O_WRONLY 打开重定向目标；若不存在，由目标父目录所属后端创建文件。', [
        param('path', 'char *', '重定向目标路径', target),
        param('omode', 'int', '打开模式位组合', 'O_CREATE | O_WRONLY'),
      ]),
    node('vcreate', 'vfs', `${backend.label} 创建`, 'vfs_create(dp, name, T_FILE, 0, 0)', 'src/kernel/vfs.c', 452,
      `调用父目录 dp 的 create 操作，在 ${backend.label} 中建立目录项和文件元数据。`, [
        param('dp', 'struct inode *', '目标文件的父目录 inode'),
        param('name', 'char *', '新文件末级名称', target.split('/').pop()),
        param('type', 'short', '新 inode 类型', 'T_FILE'),
      ]),
    node('write', 'file', '统一写入入口', 'filewrite(struct file *f, uint64 addr, int n)', 'src/kernel/file.c', 135,
      '按日志容量拆分写入；每一段调用 VFS 写操作并推进 f->off。', [
        param('f', 'struct file *', '打开文件对象'),
        param('addr', 'uint64', '源数据所在的用户虚拟地址'),
        param('n', 'int', '待写入字节数'),
      ]),
    node('vwrite', 'vfs', `${backend.label} 写分发`, `vfs_writei() → ${backendWrite.fn}`, 'src/kernel/vfs.c', 486,
      `根据 ip->ops->write 进入 ${backend.label}，保持 write() 用户接口不变。`),
    node('fswrite', 'fs', `${backend.label} 文件写入`, backendWrite.fn, backendWrite.file, backendWrite.line,
      `${backend.label} 后端更新文件数据、大小和自己的磁盘元数据。`),
    node('blockwrite', 'block', '写回块缓存', blockWrite.fn, blockWrite.file, blockWrite.line,
      backend.type === 'xv6'
        ? '原生 xv6 修改先加入文件系统日志；提交事务时再写入归属块。'
        : `${backend.label} 通过字节块接口修改 buffer cache，并直接调用 bwrite() 写回。`),
    node('hal', 'block', '提交到块设备', 'bwrite() → hal_disk_rw(buf, 1)', 'src/kernel/hal.c', 43,
      '块层把文件系统设备号换算为统一磁盘区域，再由 HAL 隐藏 RISC-V virtio-mmio 与 LoongArch virtio-pci 差异。', [
        param('b', 'struct buf *', '待写回的 RAM 块缓存对象'),
        param('write', 'int', '1 表示从内存写入磁盘', '1'),
      ]),
  ];
}

function mountTrace(args, state) {
  const type = args.tokens[1] || 'ext2';
  const target = args.tokens[2] || '/mnt';
  const dev = type === 'fat32' ? '3' : '2';
  return [
    ...commonEntry('mount', 'src/user/mount.c', 19, args),
    node('sysmount', 'syscall', '挂载系统调用', 'sys_mount(void)', 'src/kernel/sysfile.c', 20,
      '从用户地址空间复制文件系统类型与路径，读取设备号，再调用 VFS。', [
        param('fstype', 'char[16]', '文件系统类型字符串', type),
        param('path', 'char[MAXPATH]', '挂载目标目录路径', target),
        param('dev', 'int', '块设备编号', dev),
      ]),
    ...pathNodes(target, state, backendFor(target, state)),
    node('vfsMount', 'vfs', '建立挂载关系', 'vfs_mount(char *fstype, char *path, int dev)', 'src/kernel/vfs.c', 137,
      '验证目标存在且为目录，拒绝重复挂载，从 mtable 中分配表项，并记录 mountpoint、parent 与后端 root。', [
        param('fstype', 'char *', '后端名称', type),
        param('path', 'char *', '父文件系统中的挂载点', target),
        param('dev', 'int', '后端读取的设备编号', dev),
      ]),
    node('mtable', 'vfs', '更新内存挂载表', 'struct mount', 'src/kernel/vfs.h', 45,
      `建立“${target} 的 xv6 inode → ${type} 根 inode”的映射。之后 namex() 遇到该 inode 就切换文件系统。`, [
        param('mountpoint', 'struct inode *', '父文件系统中的挂载点 inode'),
        param('parent', 'struct inode *', '挂载点的父目录，用于处理挂载根的 ..'),
        param('root', 'struct inode *', `被挂载 ${type} 的根 inode`),
        param('fs_private', 'void *', '后端超级块等私有状态'),
      ]),
    node('fsmount', 'fs', `初始化 ${type}`, `${type}_mount(struct mount *mnt)`, `src/kernel/${type}.c`, type === 'ext2' ? 1136 : 597,
      `读取并验证 ${type} 超级块，初始化后端状态，创建根 inode 并写入 mnt->root。`, [
        param('mnt', 'struct mount *', '当前挂载实例；后端将 root 和 fs_private 填入其中'),
      ]),
    node('hal', 'block', '读取文件系统镜像', 'block_read_bytes() → bread() → hal_disk_rw(buf, 0)', 'src/kernel/block.c', 17,
      `经统一块层读取设备 ${dev} 的超级块。HAL 根据架构选择不同的中断与 virtio 接口。`),
  ];
}

function umountTrace(args, state) {
  const target = args.tokens[1] || '/mnt';
  const backend = backendFor(target, state);
  const backendUnmount = backend.type === 'fat32'
    ? ['fat32_unmount(struct mount *mnt)', 'src/kernel/fat32.c', 667]
    : backend.type === 'ext2'
      ? ['ext2_unmount(struct mount *mnt)', 'src/kernel/ext2.c', 1190]
      : ['fsops->unmount(mnt)', 'src/kernel/vfs.c', 329];
  return [
    ...commonEntry('umount', 'src/user/umount.c', 7, args),
    node('sysumount', 'syscall', '卸载系统调用', 'sys_umount(void)', 'src/kernel/sysfile.c', 34,
      '从用户地址空间复制挂载点路径，并调用 VFS 解除挂载。', [
        param('path', 'char[MAXPATH]', '要解除挂载的目录路径', target),
      ]),
    node('vfsumount', 'vfs', '冻结并检查挂载实例', 'vfs_umount(char *path)', 'src/kernel/vfs.c', 269,
      '持有挂载操作锁，将表项切换为 UNMOUNTING，阻止新的路径进入；若仍有打开文件、cwd 或路径遍历引用，则恢复 MOUNTED 并拒绝卸载。', [
        param('path', 'char *', '父文件系统中的挂载点路径', target),
        param('mnt->readers', 'uint', '正在读取挂载表对象的短期读者数'),
        param('mnt->state', 'enum mount_state', '挂载生命周期状态', 'MOUNTED → UNMOUNTING'),
      ]),
    node('busy', 'vfs', '检查是否仍被使用', 'vfs_mount_busy(mnt)', 'src/kernel/vfs.c', 315,
      '扫描 inode 引用和进程 cwd；忙挂载不能解除，防止释放仍在使用的后端状态。'),
    node('fsumount', 'fs', `清理 ${backend.label} 后端`, backendUnmount[0], backendUnmount[1], backendUnmount[2],
      '后端释放每挂载实例的私有状态；随后 VFS 清空挂载表项并释放 mountpoint、parent 与 root 引用。'),
  ];
}

function mutationTrace(args, state, kind) {
  const target = kind === 'link' ? args.tokens[2] : args.tokens[1];
  const backend = backendFor(target || '.', state);
  const config = {
    mkdir: ['mkdir', 'sys_mkdir(void)', 400, 'vfs_create()', 452, '创建目录'],
    rm: ['rm', 'sys_unlink(void)', 193, 'vfs_unlink()', 460, '删除目录项'],
    link: ['ln', 'sys_link(void)', 148, 'vfs_link()', 468, '建立硬链接'],
    cd: ['sh', 'sys_chdir(void)', 440, 'vfs_lookup()', 419, '切换工作目录'],
  }[kind];
  const backendOps = {
    ext2: {
      mkdir: ['ext2_create()', 'src/kernel/ext2.c', 824],
      rm: ['ext2_unlink()', 'src/kernel/ext2.c', 884],
      link: ['ext2_link()', 'src/kernel/ext2.c', 931],
      cd: ['ext2_lookup()', 'src/kernel/ext2.c', 592],
    },
    fat32: {
      mkdir: ['fat32_create()', 'src/kernel/fat32.c', 1025],
      rm: ['fat32_unlink()', 'src/kernel/fat32.c', 1116],
      link: ['fat32_link()', 'src/kernel/fat32.c', 1155],
      cd: ['fat32_lookup()', 'src/kernel/fat32.c', 1001],
    },
    xv6: {
      mkdir: ['create() → ialloc() → dirlink()', 'src/kernel/sysfile.c', 264],
      rm: ['dirlookup() → writei() → ip->nlink--', 'src/kernel/sysfile.c', 223],
      link: ['xv6_link()', 'src/kernel/vfs.c', 27],
      cd: ['xv6_lookup() → dirlookup()', 'src/kernel/vfs.c', 21],
    },
  }[backend.type][kind];
  const vfsFn = backend.type === 'xv6' && (kind === 'mkdir' || kind === 'rm')
    ? backendOps[0] : config[3];
  const vfsFile = backend.type === 'xv6' && (kind === 'mkdir' || kind === 'rm')
    ? backendOps[1] : 'src/kernel/vfs.c';
  const vfsLine = backend.type === 'xv6' && (kind === 'mkdir' || kind === 'rm')
    ? backendOps[2] : config[4];
  return [
    ...commonEntry(config[0], `src/user/${config[0]}.c`, kind === 'cd' ? 146 : 6, args),
    ...pathNodes(target || '.', state, backend, kind !== 'cd'),
    node('sysop', 'syscall', config[5], config[1], 'src/kernel/sysfile.c', config[2],
      `处理用户参数和通用语义检查，再将操作交给路径所属的 ${backend.label} 后端。`, [
        param('path', 'char *', '目标路径', target || '.'),
      ]),
    node('vop', 'vfs', `${backend.label} 操作分发`, vfsFn, vfsFile, vfsLine,
      kind === 'link'
        ? '要求源 inode 与目标父目录的 fstype、dev 相同；FAT32 后端明确返回 -1。'
        : backend.type === 'xv6' && (kind === 'mkdir' || kind === 'rm')
          ? '原生 xv6 路径保留其已有事务和目录更新代码；扩展文件系统才经 inode 操作表分发。'
          : `通过 inode 操作表调用 ${backend.label} 后端，避免系统调用层判断具体磁盘格式。`),
    node('backend', 'fs', `${backend.label} 更新`, backendOps[0], backendOps[1], backendOps[2],
      kind === 'rm'
        ? '删除名字并减少链接数；若文件仍打开，引用计数保证数据延迟到最后一次 close 后释放。挂载点会被拒绝删除。'
        : `${backend.label} 按自身目录和元数据格式完成操作。`),
  ];
}

function genericTrace(args) {
  return [
    ...commonEntry(args.tokens[0] || 'sh', 'src/user/sh.c', 146, args),
    node('fork', 'user', 'shell 创建子进程', 'fork() → exec(program, argv)', 'src/user/sh.c', 90,
      'shell 用 fork 创建子进程，再由 exec 按程序名加载用户 ELF；父 shell 调用 wait 等待。'),
    node('exec', 'syscall', '加载用户程序', 'sys_exec() → kexec(path, argv)', 'src/kernel/exec.c', 31,
      '解析可执行文件路径，读取 ELF 段，建立新用户页表并从 main() 开始运行。'),
  ];
}

export function parseCommand(raw, state) {
  const tokens = raw.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((item) => item.replace(/^['"]|['"]$/g, '')) || [];
  return { raw: raw.trim(), tokens };
}

function commandTarget(args) {
  const command = args.tokens[0];
  if (command === 'mount') return args.tokens[2] || '.';
  if (command === 'ln') return args.tokens[2] || args.tokens[1] || '.';
  if (command === 'echo') {
    const redirect = args.tokens.indexOf('>');
    return redirect >= 0 ? args.tokens[redirect + 1] || '.' : '.';
  }
  return args.tokens[1] || '.';
}

export function traceCommand(raw, state, result = null) {
  const args = parseCommand(raw, state);
  const command = args.tokens[0] || 'sh';
  let nodes;
  if (command === 'ls') nodes = lsTrace(args, state);
  else if (command === 'cat') nodes = readTrace(args, state);
  else if (command === 'echo') nodes = writeTrace(args, state);
  else if (command === 'mount') nodes = mountTrace(args, state);
  else if (command === 'umount') nodes = umountTrace(args, state);
  else if (command === 'mkdir') nodes = mutationTrace(args, state, 'mkdir');
  else if (command === 'rm') nodes = mutationTrace(args, state, 'rm');
  else if (command === 'ln') nodes = mutationTrace(args, state, 'link');
  else if (command === 'cd') nodes = mutationTrace(args, state, 'cd');
  else nodes = genericTrace(args);

  const targetBackend = backendFor(commandTarget(args), state);
  const resultBackend = { xv6: 'xv6', ext2: 'ext2', fat32: 'FAT32' }[result?.backend];
  const backend = command === 'mount'
    ? ({ ext2: 'ext2', fat32: 'FAT32' }[args.tokens[1]] || targetBackend.label)
    : command === 'umount' ? targetBackend.label : resultBackend || targetBackend.label;

  return {
    command,
    raw: args.raw || '等待命令',
    nodes,
    backend,
    status: result ? (result.success ? 'success' : 'error') : 'inferred',
    analysis: 'rule',
    analysisNote: '确定性规则链',
  };
}

export function updateTeachingState(raw, state, result = null) {
  const args = parseCommand(raw, state);
  const next = { ...state, mounts: { ...state.mounts } };
  if (result) {
    if (!result.success) return next;
    next.cwd = result.cwd || state.cwd;
    next.mounts = { ext2: '', fat32: '' };
    for (const [path, type] of Object.entries(result.mounts || {})) {
      if (type === 'ext2' || type === 'fat32') next.mounts[type] = path;
    }
    return next;
  }
  if (args.tokens[0] === 'cd') next.cwd = resolvePath(state.cwd, args.tokens[1] || '/');
  if (args.tokens[0] === 'mount' && args.tokens[2]) {
    if (args.tokens[1] === 'ext2') next.mounts.ext2 = resolvePath(state.cwd, args.tokens[2]);
    if (args.tokens[1] === 'fat32') next.mounts.fat32 = resolvePath(state.cwd, args.tokens[2]);
  }
  if (args.tokens[0] === 'umount' && args.tokens[1]) {
    const target = resolvePath(state.cwd, args.tokens[1]);
    if (next.mounts.ext2 === target) next.mounts.ext2 = '';
    if (next.mounts.fat32 === target) next.mounts.fat32 = '';
  }
  return next;
}

export const examples = [
  { label: '查看 xv6 根目录', command: 'ls /' },
  { label: '挂载 ext2', command: 'mkdir /mnt\nmount ext2 /mnt' },
  { label: '读取 ext2 文件', command: 'cat /mnt/hello' },
  { label: '挂载 FAT32', command: 'mkdir /fat\nmount fat32 /fat' },
  { label: '跨挂载返回', command: 'ls /mnt/..' },
  { label: '写入文件', command: 'echo vfs-lab > /mnt/note' },
  { label: '解除 ext2 挂载', command: 'umount /mnt' },
  { label: 'FAT32 链接拒绝', command: 'ln /fat/HELLO.TXT /fat/LINK.TXT' },
];
