import { inflateRawSync } from 'node:zlib';

/**
 * Minimal ZIP reader (stored + deflate) — enough for OpenDART's corpCode.xml,
 * document.xml and fnlttXbrl.xml payloads without a runtime dependency.
 * Reads the central directory, so data-descriptor entries are handled.
 */
export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export function isZip(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

export function unzip(input: Uint8Array): ZipEntry[] {
  const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  // EOCD is in the last 22 + 65535 (max comment) bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP: end of central directory not found');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) throw new Error('Invalid ZIP: bad central directory entry');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const rawName = buf.subarray(p + 46, p + 46 + nameLen);
    // Bit 11 = UTF-8 names; otherwise names are typically EUC-KR/CP949 from Korean tools.
    const name = flags & 0x800 ? rawName.toString('utf8') : new TextDecoder('euc-kr').decode(rawName);
    p += 46 + nameLen + extraLen + commentLen;

    if (buf.readUInt32LE(localOff) !== LOC_SIG) throw new Error(`Invalid ZIP: bad local header for ${name}`);
    const dataStart = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    const raw = buf.subarray(dataStart, dataStart + compSize);

    if (name.endsWith('/')) continue; // directory
    let data: Uint8Array;
    if (method === 0) data = new Uint8Array(raw);
    else if (method === 8) data = new Uint8Array(inflateRawSync(raw));
    else throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
    entries.push({ name, data });
  }
  return entries;
}
