const ROOT_LISTING = [
  '.              1 1 1024',
  '..             1 1 1024',
  'README         2 2 2425',
  'cat            2 3 36536',
  'echo           2 4 35384',
  'grep           2 6 39968',
  'init           2 7 35832',
  'ln             2 9 35120',
  'ls             2 10 38664',
  'mkdir          2 11 35368',
  'mount          2 12 37840',
  'rm             2 13 35360',
  'sh             2 14 58376',
  'tests          1 15 1024',
  'usertests      2 16 186280',
  'console        3 22 0',
].join('\r\n');

const HELP = [
  '教学演示会话可用命令：',
  '  ls [path]                 查看目录',
  '  cat <file>                读取文件',
  '  echo <text> [> file]      输出或写文件',
  '  mkdir <path>              创建目录',
  '  mount ext2|fat32 <path>   挂载文件系统',
  '  cd <path> / pwd           切换或查看目录',
  '  ln <old> <new>            创建硬链接',
  '  rm <path>                 删除目录项',
  '  clear                     清空终端',
].join('\r\n');

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

export class DemoShell {
  constructor(send, arch = 'riscv') {
    this.send = send;
    this.arch = arch;
    this.cwd = '/';
    this.line = '';
    this.mounts = new Map();
    this.files = new Map([
      ['/README', 'HandsomeOS: xv6 VFS + HAL teaching kernel\r\n'],
      ['/hello.c', '#include <stdio.h>\r\nint main(void) { return 0; }\r\n'],
    ]);
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

  execute(command) {
    if (!command) return this.prompt();
    const [program, ...args] = command.split(/\s+/);
    let output = '';

    if (program === 'help') {
      output = HELP;
    } else if (program === 'clear') {
      this.send('\x1b[2J\x1b[H');
      return this.prompt();
    } else if (program === 'pwd') {
      output = this.cwd;
    } else if (program === 'cd') {
      this.cwd = normalizePath(this.cwd, args[0] || '/');
    } else if (program === 'ls') {
      const path = normalizePath(this.cwd, args[0] || '.');
      if (path.startsWith('/mnt') && this.mounts.get('/mnt') === 'ext2')
        output = '.  ..  hello  lost+found  uop.txt';
      else if (path.startsWith('/fat') && this.mounts.get('/fat') === 'fat32')
        output = '.  ..  HELLO.TXT  TESTS';
      else output = ROOT_LISTING;
    } else if (program === 'mkdir') {
      if (!args[0]) output = 'mkdir: missing operand';
    } else if (program === 'mount') {
      const [type, rawPath] = args;
      const path = normalizePath(this.cwd, rawPath || '');
      if (!['ext2', 'fat32'].includes(type) || !rawPath) output = 'mount: failed';
      else {
        this.mounts.set(path, type);
        const dev = type === 'ext2' ? 2 : 3;
        output = `mount: ${type} on ${path} dev ${dev}`;
      }
    } else if (program === 'cat') {
      const path = normalizePath(this.cwd, args[0] || '');
      if (path.startsWith('/mnt') && this.mounts.get('/mnt') === 'ext2')
        output = 'hello from ext2';
      else if (path.startsWith('/fat') && this.mounts.get('/fat') === 'fat32')
        output = 'hello from FAT32';
      else output = this.files.get(path)?.replace(/\r\n$/, '') || `cat: cannot open ${args[0] || ''}`;
    } else if (program === 'echo') {
      const redirect = args.indexOf('>');
      if (redirect >= 0 && args[redirect + 1]) {
        const path = normalizePath(this.cwd, args[redirect + 1]);
        this.files.set(path, `${args.slice(0, redirect).join(' ')}\r\n`);
      } else output = args.join(' ');
    } else if (program === 'ln') {
      const target = normalizePath(this.cwd, args[1] || '');
      if (target.startsWith('/fat')) output = `link ${args[0] || ''} ${args[1] || ''}: failed`;
      else if (!args[1]) output = 'usage: ln old new';
    } else if (program === 'rm') {
      const path = normalizePath(this.cwd, args[0] || '');
      if (this.mounts.has(path)) output = `rm: ${args[0]} failed`;
      else this.files.delete(path);
    } else if (program === 'sh') {
      // A nested shell has the same prompt, matching xv6's deliberately sparse behavior.
    } else {
      output = `exec ${program} failed`;
    }

    if (output) this.send(`${output}\r\n`);
    this.prompt();
  }
}
