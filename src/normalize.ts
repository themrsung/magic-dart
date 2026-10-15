/**
 * Value normalisers for OpenDART's string-typed fields (docs §2.4, §10.7).
 */

const BLANK = new Set(['', '-', '－', 'N/A', 'null']);

/**
 * Parses amounts/counts/ratios: "1,234", "-1,234", "(1,234)", "0.256", "12.5%".
 * Returns null for blanks ("-", "") and anything non-numeric.
 */
export function parseNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  let s = value.trim();
  if (BLANK.has(s)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[,\s%]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

/**
 * Like parseNumber, but returns a bigint for integer amounts beyond 2^53
 * (KRW totals for large groups can exceed Number precision).
 */
export function parseAmount(value: string | null | undefined): bigint | null {
  if (value == null) return null;
  let s = value.trim();
  if (BLANK.has(s)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[,\s]/g, '');
  if (!/^[-+]?\d+$/.test(s)) return null;
  const n = BigInt(s);
  return negative ? -n : n;
}

/**
 * Normalises `YYYYMMDD`, `YYYY-MM-DD`, `YYYY.MM.DD`, `YYYY년 MM월 DD일` to ISO `YYYY-MM-DD`.
 * Returns null if unparseable.
 */
export function parseDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = value.trim();
  if (BLANK.has(s)) return null;
  const m = /^(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})일?$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  const iso = `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** Formats a Date (in KST, which is what OpenDART keys on) or passes through a YYYYMMDD string. */
export function toDartDate(value: string | Date): string {
  if (typeof value === 'string') return value.replace(/[-.]/g, '');
  const kst = new Date(value.getTime() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

/** DART viewer URL for a receipt number (docs §1). */
export function viewerUrl(rcept_no: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(rcept_no)}`;
}

/** `rm` flag characters on 공시검색 rows (docs §3.1). */
export const RM_FLAGS = {
  유: 'KOSPI (유가증권시장본부)',
  코: 'KOSDAQ (코스닥시장본부)',
  채: '채권상장법인',
  넥: 'KONEX',
  공: '공정위',
  연: '연결 포함',
  정: '후속 정정 있음',
  철: '철회(간주)',
} as const;

export function parseRmFlags(rm: string | undefined): Array<keyof typeof RM_FLAGS> {
  if (!rm) return [];
  return [...rm].filter((c): c is keyof typeof RM_FLAGS => c in RM_FLAGS);
}
