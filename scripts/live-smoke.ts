/**
 * Live smoke test: calls every endpoint once against the real OpenDART API.
 * Hard limits: <=10 req/s and <=2,000 requests total (enforced by the client).
 * Usage: pnpm smoke   (reads OPENDART_API_KEY from .env)
 */
import { ENDPOINT_NAMES, ENDPOINTS, OpenDartClient, OpenDartError } from '../src/index.ts';

const apiKey = process.env.OPENDART_API_KEY;
if (!apiKey) throw new Error('OPENDART_API_KEY missing (put it in .env)');

const client = new OpenDartClient({ apiKey, requestsPerSecond: 10, maxRequests: 2000 });

const CORP = '00126380'; // 삼성전자
const YEAR = 2024;
const periodic = { corp_code: CORP, bsns_year: YEAR, reprt_code: '11011' as const };
const event = { corp_code: CORP, bgn_de: '20230101', end_de: '20241231' };

function paramsFor(name: (typeof ENDPOINT_NAMES)[number], rcept: string): Record<string, unknown> {
  switch (ENDPOINTS[name].params) {
    case 'none': return {};
    case 'search': return { corp_code: CORP, bgn_de: '20240101', end_de: '20240331', page_count: 5 };
    case 'corp': return { corp_code: CORP };
    case 'receipt': return { rcept_no: rcept };
    case 'periodic': return periodic;
    case 'periodicFs': return { ...periodic, fs_div: 'CFS' };
    case 'periodicIdx': return { ...periodic, idx_cl_code: 'M210000' };
    case 'multiPeriodic': return { ...periodic, corp_code: [CORP, '00164779'] };
    case 'multiIdx': return { ...periodic, corp_code: [CORP, '00164779'], idx_cl_code: 'M210000' };
    case 'xbrl': return { rcept_no: rcept, reprt_code: '11011' };
    case 'taxonomy': return { sj_div: 'BS1' };
    case 'event': return event;
  }
}

const first = await client.search({ corp_code: CORP, pblntf_ty: 'A', bgn_de: '20250101', end_de: '20250331' });
const rcept = first.list.find((f) => f.report_nm.includes('사업보고서'))?.rcept_no ?? first.list[0]!.rcept_no;

const results: { name: string; ok: boolean; info: string }[] = [];
for (const name of ENDPOINT_NAMES) {
  try {
    const out = await (client.api[name] as (p: unknown) => Promise<unknown>)(paramsFor(name, rcept));
    const info = out instanceof Uint8Array ? `${out.byteLength} bytes`
      : Array.isArray(out) ? `${out.length} rows` : 'object';
    results.push({ name, ok: true, info });
  } catch (e) {
    const info = e instanceof OpenDartError ? `${e.status} ${e.message}` : String(e);
    results.push({ name, ok: false, info });
  }
}

for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(36)} ${r.info}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} ok · ${client.requestCount} requests used`);
process.exitCode = failed ? 1 : 0;
