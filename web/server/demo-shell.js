const HELP = [
  '教学演示会话可用命令：',
  '  ls [path]                 查看目录',
  '  cat <file>                读取文件',
  '  echo <text> [> file]      输出或写文件',
  '  mkdir <path>              创建目录',
  '  mount ext2|fat32 <path>   挂载文件系统',
  '  umount <path>             卸载文件系统',
  '  cd <path> / pwd           切换或查看目录',
  '  ln <old> <new>            创建硬链接',
  '  rm <path>                 删除文件或空目录',
  '  clear                     清空终端',
].join('\r\n');

const BASE_ENTRIES = [
  ['README', 2, 2, 2425, 'HandsomeOS: xv6 VFS + HAL teaching kernel\r\n'],
  ['cat', 2, 3, 36536],
  ['echo', 2, 4, 35384],
  ['grep', 2, 6, 39968],
  ['init', 2, 7, 35832],
  ['ln', 2, 9, 35120],
  ['ls', 2, 10, 38664],
  ['mkdir', 2, 11, 35368],
  ['mount', 2, 12, 37840],
  ['umount', 2, 13, 35664],
  ['rm', 2, 14, 35360],
  ['sh', 2, 15, 58376],
  ['tests', 1, 16, 1024],
  ['usertests', 2, 17, 186280],
  ['console', 3, 22, 0],
];

function normalizePath(cwd, input = '.') {
  const raw = input.startsWith('/') ? input : `${cwd}/${input}`;
  const parts = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function parentPath(target) {
  if (target === '/') return '/';
  const index = target.lastIndexOf('/');
  return index <= 0 ? '/' : target.slice(0, index);
}

function baseName(target) {
  if (target === '/') return '/';
  return target.slice(target.lastIndexOf('/') + 1);
}

function tokenize(command) {
  return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)
    ?.map((item) => item.replace(/^["']|["']$/g, '')) || [];
}

function makeNode(type, inum, size = type === 1 ? 1024 : 0, content = '') {
  return { type, inum, nlink: 1, size, content };
}

function createRootStore() {
  const store = new Map([['/', makeNode(1, 1)]]);
  for (const [name, type, inum, size, content = ''] of BASE_ENTRIES)
    store.set(`/${name}`, makeNode(type, inum, size, content));
  return store;
}

function createBackendStore(type) {
  if (type === 'ext2') {
    return new Map([
      ['/', makeNode(1, 2)],
      ['/hello', makeNode(2, 12, 16, 'hello from ext2\r\n')],
      ['/lost+found', makeNode(1, 11)],
      ['/uop.txt', makeNode(2, 13, 20, 'ext2 vfs operations\r\n')],
    ]);
  }
  return new Map([
    ['/', makeNode(1, 2)],
    ['/HELLO.TXT', makeNode(2, 3, 18, 'hello from FAT32\r\n')],
    ['/TESTS', makeNode(1, 4)],
  ]);
}

export class DemoShell {
  constructor(send, arch = 'riscv', onResult = () => {}) {
    this.send = send;
    this.onResult = onResult;
    this.arch = arch;
    this.cwd = '/';
    this.line = '';
    this.nextInum = 30;
    this.root = createRootStore();
    this.backends = {
      ext2: createBackendStore('ext2'),
      fat32: createBackendStore('fat32'),
    };
    this.mounts = new Map();
  }

  boot() {
    const platform = this.arch === 'loongarch' ? 'LoongArch64' : 'RISC-V';
    this.send('\x1b[2J\x1b[H');
    this.send(`HandsomeOS teaching session · ${platform}\r\n`);
    this.send('xv6 kernel is booting\r\n\r\n');
    this.send('VFS: xv6 root ready · ext2 dev 2 · FAT32 dev 3\r\n');
    this.send('init: starting sh\r\n\r\n');
    this.prompt();
  }

  prompt() {
    this.send('\x1b[38;5;114m$\x1b[0m ');
  }

  input(data) {
    for (const char of data) {
      if (char === '\r' || char === '\n') {
        this.send('\r\n');
        const command = this.line.trim();
        this.line = '';
        this.execute(command);
      } else if (char === '\u007f' || char === '\b') {
        if (this.line.length) {
          this.line = this.line.slice(0, -1);
          this.send('\b \b');
        }
      } else if (char === '\u000c') {
        this.send('\x1b[2J\x1b[H');
        this.prompt();
      } else if (char >= ' ') {
        this.line += char;
        this.send(char);
      }
    }
  }

  mountFor(target) {
    return [...this.mounts.entries()]
      .filter(([mountPath]) => target === mountPath || target.startsWith(`${mountPath}/`))
      .sort(([left], [right]) => right.length - left.length)[0] || null;
  }

  location(target) {
    const mounted = this.mountFor(target);
    if (!mounted) return { store: this.root, key: target, backend: 'xv6', mountPath: '' };
    const [mountPath, type] = mounted;
    const key = target === mountPath ? '/' : target.slice(mountPath.length);
    return { store: this.backends[type], key, backend: type, mountPath };
  }

  getNode(target) {
    const { store, key } = this.location(target);
    return store.get(key);
  }

  setNode(target, value) {
    const { store, key } = this.location(target);
    store.set(key, value);
  }

  deleteNode(target) {
    const { store, key } = this.location(target);
    return store.delete(key);
  }

  children(target) {
    const { store, key } = this.location(target);
    return [...store.entries()]
      .filter(([candidate]) => candidate !== key && parentPath(candidate) === key)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([candidate, entry]) => [baseName(candidate), entry]);
  }

  formatEntry(name, entry) {
    return `${name.padEnd(14)} ${entry.type} ${entry.inum} ${entry.size}`;
  }

  listDirectory(target) {
    const entry = this.getNode(target);
    if (!entry) return { success: false, output: `ls: cannot open ${target}` };
    if (entry.type !== 1) return { success: true, output: this.formatEntry(baseName(target), entry) };

    const parent = this.getNode(parentPath(target)) || entry;
    const rows = [this.formatEntry('.', entry), this.formatEntry('..', parent)];
    for (const [name, child] of this.children(target)) rows.push(this.formatEntry(name, child));
    return { success: true, output: rows.join('\r\n') };
  }

  result(command, success, output = '', details = {}) {
    if (output) this.send(`${output}\r\n`);
    this.onResult({
      command,
      success,
      cwd: this.cwd,
      mounts: Object.fromEntries(this.mounts),
      ...details,
    });
    this.prompt();
  }

  execute(command) {
    if (!command) return this.prompt();
    const [program, ...args] = tokenize(command);
    let output = '';
    let success = true;
    let target = '';

    if (program === 'help') {
      output = HELP;
    } else if (program === 'clear') {
      this.send('\x1b[2J\x1b[H');
    } else if (program === 'pwd') {
      output = this.cwd;
    } else if (program === 'cd') {
      target = normalizePath(this.cwd, args[0] || '/');
      const entry = this.getNode(target);
      if (!entry || entry.type !== 1) {
        success = false;
        output = `cd: cannot cd ${args[0] || ''}`;
      } else this.cwd = target;
    } else if (program === 'ls') {
      target = normalizePath(this.cwd, args[0] || '.');
      ({ success, output } = this.listDirectory(target));
    } else if (program === 'mkdir') {
      if (!args[0]) {
        success = false;
        output = 'mkdir: missing operand';
      } else {
        target = normalizePath(this.cwd, args[0]);
        const parent = this.getNode(parentPath(target));
        if (this.getNode(target) || !parent || parent.type !== 1) {
          success = false;
          output = `mkdir: ${args[0]} failed`;
        } else this.setNode(target, makeNode(1, this.nextInum++));
      }
    } else if (program === 'mount') {
      const [type, rawPath] = args;
      target = normalizePath(this.cwd, rawPath || '');
      const entry = rawPath ? this.getNode(target) : null;
      const typeInUse = [...this.mounts.values()].includes(type);
      if (!['ext2', 'fat32'].includes(type) || !rawPath || !entry || entry.type !== 1 || this.mounts.has(target) || typeInUse) {
        success = false;
        output = 'mount: failed';
      } else {
        this.mounts.set(target, type);
        output = `mount: ${type} on ${target} dev ${type === 'ext2' ? 2 : 3}`;
      }
    } else if (program === 'umount') {
      target = normalizePath(this.cwd, args[0] || '');
      if (!args[0] || !this.mounts.has(target) || this.cwd === target || this.cwd.startsWith(`${target}/`)) {
        success = false;
        output = `umount: ${args[0] || ''} failed`;
      } else {
        this.mounts.delete(target);
        output = `umount: ${target}`;
      }
    } else if (program === 'cat') {
      target = normalizePath(this.cwd, args[0] || '');
      const entry = this.getNode(target);
      if (!args[0] || !entry || entry.type !== 2) {
        success = false;
        output = `cat: cannot open ${args[0] || ''}`;
      } else output = entry.content.replace(/\r?\n$/, '');
    } else if (program === 'echo') {
      const redirect = args.indexOf('>');
      if (redirect < 0) output = args.join(' ');
      else if (!args[redirect + 1]) {
        success = false;
        output = 'echo: missing redirect target';
      } else {
        target = normalizePath(this.cwd, args[redirect + 1]);
        const parent = this.getNode(parentPath(target));
        const existing = this.getNode(target);
        if (!parent || parent.type !== 1 || existing?.type === 1) {
          success = false;
          output = `echo: cannot create ${args[redirect + 1]}`;
        } else {
          const content = `${args.slice(0, redirect).join(' ')}\r\n`;
          if (existing) {
            existing.content = content;
            existing.size = Buffer.byteLength(content);
          } else this.setNode(target, makeNode(2, this.nextInum++, Buffer.byteLength(content), content));
        }
      }
    } else if (program === 'ln') {
      const [rawSource, rawTarget] = args;
      const source = normalizePath(this.cwd, rawSource || '');
      target = normalizePath(this.cwd, rawTarget || '');
      const entry = rawSource ? this.getNode(source) : null;
      const sourceBackend = this.location(source).backend;
      const targetBackend = this.location(parentPath(target)).backend;
      if (!rawSource || !rawTarget || !entry || entry.type === 1 || this.getNode(target)
          || sourceBackend !== targetBackend || sourceBackend === 'fat32') {
        success = false;
        output = rawTarget ? `link ${rawSource} ${rawTarget}: failed` : 'usage: ln old new';
      } else {
        entry.nlink += 1;
        this.setNode(target, entry);
      }
    } else if (program === 'rm') {
      target = normalizePath(this.cwd, args[0] || '');
      const entry = this.getNode(target);
      if (!args[0] || target === '/' || !entry || this.mounts.has(target) || (entry.type === 1 && this.children(target).length)) {
        success = false;
        output = `rm: ${args[0] || ''} failed`;
      } else {
        this.deleteNode(target);
        entry.nlink = Math.max(0, entry.nlink - 1);
      }
    } else if (program === 'sh') {
      // A nested shell has the same prompt, matching xv6's sparse behavior.
    } else {
      success = false;
      output = `exec ${program} failed`;
    }

    this.result(command, success, output, {
      program,
      target,
      backend: target ? this.location(target).backend : 'xv6',
    });
  }
}
