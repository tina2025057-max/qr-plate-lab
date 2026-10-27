// Small, dependency-free ZIP writer for the two printable STL parts.
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function checksum(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export function createZip(files) {
  if (!files.length || files.length > 65535) throw new Error('ZIP 檔案數量無效。');
  const entries = files.map(({ name, contents }) => {
    if (!/^[a-z0-9._-]+$/i.test(name)) throw new Error('ZIP 檔名無效。');
    const fileName = encoder.encode(name);
    const data = typeof contents === 'string' ? encoder.encode(contents) : contents;
    if (!(data instanceof Uint8Array) || data.length > 0xffffffff) throw new Error('ZIP 內容無效。');
    return { fileName, data, crc: checksum(data), offset: 0 };
  });
  const localSize = entries.reduce((sum, entry) => sum + 30 + entry.fileName.length + entry.data.length, 0);
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.fileName.length, 0);
  if (localSize + centralSize + 22 > 0xffffffff) throw new Error('ZIP 檔案過大。');
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let position = 0;
  const write16 = (value) => { view.setUint16(position, value, true); position += 2; };
  const write32 = (value) => { view.setUint32(position, value, true); position += 4; };
  const writeBytes = (bytes) => { output.set(bytes, position); position += bytes.length; };

  for (const entry of entries) {
    entry.offset = position;
    write32(0x04034b50); write16(20); write16(0x0800); write16(0);
    write16(0); write16(0); write32(entry.crc);
    write32(entry.data.length); write32(entry.data.length);
    write16(entry.fileName.length); write16(0);
    writeBytes(entry.fileName); writeBytes(entry.data);
  }
  for (const entry of entries) {
    write32(0x02014b50); write16(20); write16(20); write16(0x0800); write16(0);
    write16(0); write16(0); write32(entry.crc);
    write32(entry.data.length); write32(entry.data.length);
    write16(entry.fileName.length); write16(0); write16(0);
    write16(0); write16(0); write32(0); write32(entry.offset);
    writeBytes(entry.fileName);
  }
  write32(0x06054b50); write16(0); write16(0);
  write16(entries.length); write16(entries.length);
  write32(centralSize); write32(localSize); write16(0);
  return output;
}
