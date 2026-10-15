import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ENDPOINT_NAMES, ENDPOINTS, OpenDartClient, OpenDartError, OpenDartValidationError, RequestBudgetExceededError,
} from '../src/index.ts';
import { fakeFetch, json, KEY, makeZip, noSleep } from './helpers/fake.ts';

const client = (fetch: typeof globalThis.fetch, extra: Partial<ConstructorParameters<typeof OpenDartClient>[0]> = {}) =>
  new OpenDartClient({ apiKey: KEY, fetch, sleep: noSleep, requestsPerSecond: 1e6, ...extra });

const periodic = { corp_code: '00126380', bsns_year: 2024, reprt_code: '11011' } as const;

describe('OpenDartClient', () => {
  it('rejects malformed keys', () => {
    assert.throws(() => new OpenDartClient({ apiKey: 'short' }), TypeError);
  });

  it('exposes every registry endpoint as a method', () => {
    const c = client(fakeFetch({}).fetch);
    assert.equal(ENDPOINT_NAMES.length, 85);
    for (const n of ENDPOINT_NAMES) assert.equal(typeof c.api[n], 'function', n);
  });

  it('builds the URL with key, extension and params', async () => {
    const f = fakeFetch({ 'hyslrSttus.json': () => json({ status: '000', message: '정상', list: [{ nm: '이재용' }] }) });
    const rows = await client(f.fetch).api.hyslrSttus(periodic);
    assert.deepEqual(rows, [{ nm: '이재용' }]);
    const u = f.calls[0]!.url;
    assert.equal(u.origin + u.pathname, 'https://opendart.fss.or.kr/api/hyslrSttus.json');
    assert.equal(u.searchParams.get('crtfc_key'), KEY);
    assert.equal(u.searchParams.get('bsns_year'), '2024');
    assert.equal(u.searchParams.get('reprt_code'), '11011');
  });

  it('maps 013 to an empty list by default, and throws when disabled', async () => {
    const f = fakeFetch({ 'dfOcr.json': () => json({ status: '013', message: '조회된 데이타가 없습니다.' }) });
    const ev = { corp_code: '00126380', bgn_de: '20240101', end_de: '20241231' };
    assert.deepEqual(await client(f.fetch).api.dfOcr(ev), []);
    await assert.rejects(client(f.fetch, { noDataAsEmpty: false }).api.dfOcr(ev), (e: OpenDartError) => e.isNoData);
  });

  it('throws OpenDartError with flags for auth errors', async () => {
    const f = fakeFetch({ 'company.json': () => json({ status: '012', message: '접근할 수 없는 IP입니다.' }) });
    await assert.rejects(client(f.fetch).company('00126380'), (e: unknown) =>
      e instanceof OpenDartError && e.isAuthError && e.status === '012');
  });

  it('unwraps company as an object', async () => {
    const f = fakeFetch({ 'company.json': () => json({ status: '000', message: '정상', corp_name: '삼성전자(주)', stock_code: '005930' }) });
    const c = await client(f.fetch).company('00126380');
    assert.equal(c.corp_name, '삼성전자(주)');
    assert.equal((c as Record<string, unknown>).status, undefined);
  });

  it('unwraps grouped responses (DS006, V2 comp)', async () => {
    const f = fakeFetch({
      'estkRs.json': () => json({ status: '000', message: '정상', group: [{ title: '일반사항', list: [{ sbd: 'x' }] }, { title: '인수인정보', list: { actsen: 'y' } }] }),
    });
    const groups = await client(f.fetch).api.estkRs({ corp_code: '00126380', bgn_de: new Date('2024-01-01T00:00:00+09:00'), end_de: '2024-12-31' });
    assert.equal(groups.length, 2);
    assert.equal(groups[0]!.title, '일반사항');
    assert.deepEqual(groups[1]!.list, [{ actsen: 'y' }]);
    assert.equal(f.calls[0]!.url.searchParams.get('bgn_de'), '20240101');
    assert.equal(f.calls[0]!.url.searchParams.get('end_de'), '20241231');
    assert.equal(ENDPOINTS.hmvAuditIndvdlBySttusV2.response, 'group');
  });

  it('paginates searchAll until total_page', async () => {
    const f = fakeFetch({
      'list.json': (u) => {
        const p = Number(u.searchParams.get('page_no'));
        return json({ status: '000', message: '정상', page_no: p, page_count: 100, total_count: 3, total_page: 3, list: [{ rcept_no: String(p) }] });
      },
    });
    const all = [];
    for await (const r of client(f.fetch).searchAll({ corp_code: '00126380' })) all.push(r.rcept_no);
    assert.deepEqual(all, ['1', '2', '3']);
    assert.equal(f.calls[0]!.url.searchParams.get('page_count'), '100');
  });

  it('parses corpCode.xml ZIP', async () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><corp_eng_name>SAMSUNG ELECTRONICS CO,.LTD</corp_eng_name><stock_code>005930</stock_code><modify_date>20250101</modify_date></list><list><corp_code>00000001</corp_code><corp_name>A&amp;B</corp_name><corp_eng_name></corp_eng_name><stock_code> </stock_code><modify_date>20200101</modify_date></list></result>';
    const zip = makeZip({ 'CORPCODE.xml': xml });
    const f = fakeFetch({ 'corpCode.xml': () => new Response(zip as Uint8Array<ArrayBuffer>) });
    const codes = await client(f.fetch).corpCodes();
    assert.equal(codes.length, 2);
    assert.deepEqual(codes[0], { corp_code: '00126380', corp_name: '삼성전자', corp_eng_name: 'SAMSUNG ELECTRONICS CO,.LTD', stock_code: '005930', modify_date: '20250101' });
    assert.equal(codes[1]!.corp_name, 'A&B');
    assert.equal(codes[1]!.stock_code, '');
  });

  it('surfaces XML error bodies from file endpoints', async () => {
    const f = fakeFetch({ 'document.xml': () => new Response('<?xml version="1.0"?><result><status>014</status><message>파일이 존재하지 않습니다.</message></result>') });
    await assert.rejects(client(f.fetch).document('20240101000001'), (e: unknown) => e instanceof OpenDartError && e.status === '014');
  });

  it('retries 800 and HTTP 5xx, then succeeds', async () => {
    const f = fakeFetch({
      'alotMatter.json': (_u, n) => n === 1 ? new Response('oops', { status: 502 }) : n === 2 ? json({ status: '800', message: '점검' }) : json({ status: '000', message: '정상', list: [] }),
    });
    const c = client(f.fetch);
    assert.deepEqual(await c.api.alotMatter(periodic), []);
    assert.equal(f.calls.length, 3);
    assert.equal(c.requestCount, 3);
  });

  it('enforces the request budget', async () => {
    const f = fakeFetch({ 'mrhlSttus.json': () => json({ status: '000', message: '정상', list: [] }) });
    const c = client(f.fetch, { maxRequests: 2 });
    await c.api.mrhlSttus(periodic);
    await c.api.mrhlSttus(periodic);
    await assert.rejects(c.api.mrhlSttus(periodic), RequestBudgetExceededError);
    assert.equal(f.calls.length, 2);
  });

  it('chunks multi-company calls at 100', async () => {
    const f = fakeFetch({ 'fnlttMultiAcnt.json': (u) => json({ status: '000', message: '정상', list: u.searchParams.get('corp_code')!.split(',').map((c) => ({ corp_code: c })) }) });
    const codes = Array.from({ length: 250 }, (_, i) => String(i).padStart(8, '0'));
    const c = client(f.fetch);
    await assert.rejects(c.api.fnlttMultiAcnt({ ...periodic, corp_code: codes }), OpenDartValidationError);
    const rows = await c.fnlttMultiAcntChunked({ ...periodic, corp_code: codes });
    assert.equal(rows.length, 250);
    assert.equal(f.calls.length, 3);
  });

  it('validates before sending', async () => {
    const f = fakeFetch({});
    const c = client(f.fetch);
    await assert.rejects(c.api.hyslrSttus({ ...periodic, corp_code: '126380' }), OpenDartValidationError);
    await assert.rejects(c.api.hyslrSttus({ ...periodic, bsns_year: 2014 }), OpenDartValidationError);
    await assert.rejects(c.api.hyslrSttus({ ...periodic, reprt_code: '99999' as never }), OpenDartValidationError);
    await assert.rejects(c.api.fnlttSinglAcntAll({ ...periodic, fs_div: 'XFS' as never }), OpenDartValidationError);
    await assert.rejects(c.api.xbrlTaxonomy({ sj_div: 'BS9' as never }), OpenDartValidationError);
    await assert.rejects(c.api.dfOcr({ corp_code: '00126380', bgn_de: '20241231', end_de: '20240101' }), OpenDartValidationError);
    await assert.rejects(c.search({ page_count: 101 }), OpenDartValidationError);
    await assert.rejects(c.search({ pblntf_ty: 'A', pblntf_detail_ty: 'B001' }), OpenDartValidationError);
    await assert.rejects(c.document('123'), OpenDartValidationError);
    assert.equal(f.calls.length, 0);
  });
});
