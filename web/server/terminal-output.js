function looksLikeUtf16Le(buffer) {
  if (buffer.length < 4 || buffer.length % 2 !== 0) return false;
  let zeroHighBytes = 0;
  for (let index = 1; index < buffer.length; index += 2) {
    if (buffer[index] === 0) zeroHighBytes += 1;
  }
  return zeroHighBytes >= Math.max(2, Math.floor(buffer.length / 8));
}

export function decodeProcessOutput(data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const text = looksLikeUtf16Le(buffer)
    ? buffer.toString('utf16le')
    : buffer.toString('utf8');

  // wsl.exe prints host integration warnings in UTF-16LE before the Linux
  // process starts. They are unrelated to xv6 and corrupt the teaching TTY.
  return text
    .split(/(?<=\n)/)
    .filter((line) => !line.replace(/^\uFEFF/, '').startsWith('wsl: '))
    .join('');
}
