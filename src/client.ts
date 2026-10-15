import { ENDPOINT_NAMES, ENDPOINTS, type EndpointDef, type EndpointName, type ResponseShape } from './endpoints.ts';
import { OpenDartError, OpenDartHttpError } from './errors.ts';
import { buildQuery, MAX_MULTI_CORPS, type ParamsByShape } from './params.ts';
import { RateLimiter } from './rate-limiter.ts';
import type {
  CompanyProfile, CorpCodeEntry, DartGroup, DartRow, Envelope, ExecutiveStockRow, Filing, FinancialIndexRow,
  FullStatementRow, MajorAccountRow, MajorStockRow, MultiIdxParams, MultiPeriodicParams, SearchPage, SearchParams,
} from './types.ts';
import { isZip, unzip, type ZipEntry } from './zip.ts';

export const DEFAULT_BASE_URL = 'https://opendart.fss.or.kr/api';

export interface OpenDartClientOptions {
  /** crtfc_key (40 chars). */
  apiKey: string;
  baseUrl?: string;
  /** Requests started per second. Default 10. Ignored if `rateLimiter` is given. */
  requestsPerSecond?: number;
  /** Hard cap on total HTTP requests (retries included). Default unlimited. */
  maxRequests?: number;
  /** Share one limiter across clients/keys. */
  rateLimiter?: RateLimiter;
  /** Retries for network errors, HTTP 5xx/429 and status 800/900. Default 2. */
  retries?: number;
  /** Base backoff in ms (doubles each retry). Default 500. */
  retryDelayMs?: number;
  /** Per-request timeout. Default 30s (corpCode.xml is several MB). */
  timeoutMs?: number;
  /** Return []/empty page on status 013 instead of throwing. Default true. */
  noDataAsEmpty?: boolean;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
}

// ── Typed per-endpoint surface ─────────────────────────────────────────
/** Row types for endpoints with a documented schema; everything else is DartRow. */
interface RowTypes {
  fnlttSinglAcnt: MajorAccountRow;
  fnlttMultiAcnt: MajorAccountRow;
  fnlttSinglAcntAll: FullStatementRow;
  fnlttSinglIndx: FinancialIndexRow;
  fnlttCmpnyIndx: FinancialIndexRow;
  majorstock: MajorStockRow;
  elestock: ExecutiveStockRow;
}
type RowOf<K extends EndpointName> = K extends keyof RowTypes ? RowTypes[K] : DartRow;

type ResultOf<K extends EndpointName, R extends ResponseShape = (typeof ENDPOINTS)[K]['response']> =
  R extends 'list' ? RowOf<K>[]
  : R extends 'group' ? DartGroup[]
  : R extends 'paged' ? SearchPage
  : R extends 'object' ? CompanyProfile
  : R extends 'zip' ? Uint8Array
  : never;

type ParamsOf<K extends EndpointName> = ParamsByShape[(typeof ENDPOINTS)[K]['params']];

export type EndpointMethod<K extends EndpointName> =
  undefined extends ParamsOf<K>
    ? (params?: ParamsOf<K>) => Promise<ResultOf<K>>
    : (params: ParamsOf<K>) => Promise<ResultOf<K>>;

/** One method per OpenDART API, named after its endpoint path. */
export type OpenDartApi = { readonly [K in EndpointName]: EndpointMethod<K> };

// ── Client ─────────────────────────────────────────────────────────────
export class OpenDartClient {
  /** Every API as a typed method: `client.api.hyslrSttus({ corp_code, bsns_year, reprt_code })`. */
  readonly api: OpenDartApi;
  readonly limiter: RateLimiter;

  readonly #key: string;
  readonly #baseUrl: string;
  readonly #retries: number;
  readonly #retryDelayMs: number;
  readonly #timeoutMs: number;
  readonly #noDataAsEmpty: boolean;
  readonly #fetch: typeof globalThis.fetch;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(opts: OpenDartClientOptions) {
    if (!opts?.apiKey || !/^[0-9a-zA-Z]{40}$/.test(opts.apiKey)) {
      throw new TypeError('OpenDartClient: apiKey must be a 40-character crtfc_key');
    }
    this.#key = opts.apiKey;
    this.#baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#retries = opts.retries ?? 2;
    this.#retryDelayMs = opts.retryDelayMs ?? 500;
    this.#timeoutMs = opts.timeoutMs ?? 30_000;
    this.#noDataAsEmpty = opts.noDataAsEmpty ?? true;
    this.#fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.#sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.limiter = opts.rateLimiter ?? new RateLimiter({
      requestsPerSecond: opts.requestsPerSecond, maxRequests: opts.maxRequests, sleep: opts.sleep,
    });
    this.api = Object.freeze(Object.fromEntries(
      ENDPOINT_NAMES.map((name) => [name, (params?: unknown) => this.call(name, params as never)]),
    )) as OpenDartApi;
  }

  /** Number of HTTP requests sent so far (retries included). */
  get requestCount(): number { return this.limiter.issued; }

  /** Calls any endpoint by name and unwraps the response per its shape. */
  async call<K extends EndpointName>(name: K, params: ParamsOf<K>): Promise<ResultOf<K>> {
    const def: EndpointDef = ENDPOINTS[name];
    if (!def) throw new TypeError(`Unknown OpenDART endpoint "${String(name)}"`);
    const query = buildQuery(name, def, params);

    if (def.response === 'zip') return (await this.#fetchFile(def, query)) as ResultOf<K>;

    let env: Envelope;
    try {
      env = await this.#fetchJson(def, query);
    } catch (err) {
      if (err instanceof OpenDartError && err.isNoData && this.#noDataAsEmpty && def.response !== 'object') {
        return emptyFor(def.response, query) as ResultOf<K>;
      }
      throw err;
    }
    return unwrap(def.response, env) as ResultOf<K>;
  }

  /** Raw JSON envelope for any endpoint (no unwrapping, 013 still throws). */
  async raw(name: EndpointName, params?: unknown): Promise<Envelope> {
    const def: EndpointDef = ENDPOINTS[name];
    if (def.response === 'zip') throw new TypeError(`${name} returns a ZIP; use call()`);
    return this.#fetchJson(def, buildQuery(name, def, params));
  }

  // ── DS001 conveniences ────────────────────────────────────────────────
  search(params?: SearchParams): Promise<SearchPage> {
    return this.call('list', params);
  }

  /** Iterates every filing matching the search, fetching 100 per page. */
  async *searchAll(params: Omit<SearchParams, 'page_no' | 'page_count'> = {}): AsyncGenerator<Filing> {
    for (let page = 1; ; page++) {
      const res = await this.search({ ...params, page_no: page, page_count: 100 });
      yield* res.list;
      if (res.list.length === 0 || page >= res.total_page) return;
    }
  }

  company(corp_code: string): Promise<CompanyProfile> {
    return this.call('company', { corp_code });
  }

  /** Downloads and parses the full 고유번호 list (one request, multi-MB ZIP). */
  async corpCodes(): Promise<CorpCodeEntry[]> {
    const entries = unzip(await this.call('corpCode', undefined));
    const xml = entries.find((e) => e.name.toLowerCase().endsWith('.xml'));
    if (!xml) throw new OpenDartHttpError('corpCode.xml ZIP contained no XML file');
    return parseCorpCodeXml(new TextDecoder('utf-8').decode(xml.data));
  }

  /** Original filing documents (공시서류원본파일) as unzipped entries. */
  async document(rcept_no: string): Promise<ZipEntry[]> {
    return unzip(await this.call('document', { rcept_no }));
  }

  /** XBRL instance files for a periodic report. */
  async xbrl(rcept_no: string, reprt_code: MultiPeriodicParams['reprt_code']): Promise<ZipEntry[]> {
    return unzip(await this.call('fnlttXbrl', { rcept_no, reprt_code }));
  }

  // ── Multi-company helpers (chunk past the 100-corp cap, error 021) ──
  async fnlttMultiAcntChunked(params: MultiPeriodicParams): Promise<MajorAccountRow[]> {
    return this.#chunked('fnlttMultiAcnt', params);
  }

  async fnlttCmpnyIndxChunked(params: MultiIdxParams): Promise<FinancialIndexRow[]> {
    return this.#chunked('fnlttCmpnyIndx', params);
  }

  async #chunked<K extends 'fnlttMultiAcnt' | 'fnlttCmpnyIndx'>(name: K, params: ParamsOf<K>): Promise<RowOf<K>[]> {
    const codes = Array.isArray(params.corp_code) ? [...params.corp_code] : String(params.corp_code).split(',');
    const out: RowOf<K>[] = [];
    for (let i = 0; i < codes.length; i += MAX_MULTI_CORPS) {
      const rows = await this.call(name, { ...params, corp_code: codes.slice(i, i + MAX_MULTI_CORPS) } as ParamsOf<K>);
      out.push(...(rows as RowOf<K>[]));
    }
    return out;
  }

  // ── Transport ─────────────────────────────────────────────────────────
  #url(def: EndpointDef, query: Record<string, string>): URL {
    const url = new URL(`${this.#baseUrl}/${def.path}.${def.ext}`);
    url.searchParams.set('crtfc_key', this.#key);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return url;
  }

  async #send(def: EndpointDef, query: Record<string, string>): Promise<Response> {
    const url = this.#url(def, query);
    for (let attempt = 0; ; attempt++) {
      await this.limiter.acquire();
      let res: Response;
      try {
        res = await this.#fetch(url, { signal: AbortSignal.timeout(this.#timeoutMs) });
      } catch (cause) {
        if (attempt < this.#retries) { await this.#backoff(attempt); continue; }
        throw new OpenDartHttpError(`${def.path}: network error`, undefined, { cause });
      }
      if (res.status >= 500 || res.status === 429) {
        if (attempt < this.#retries) { await res.body?.cancel(); await this.#backoff(attempt); continue; }
      }
      if (!res.ok) throw new OpenDartHttpError(`${def.path}: HTTP ${res.status}`, res.status);
      return res;
    }
  }

  async #fetchJson(def: EndpointDef, query: Record<string, string>): Promise<Envelope> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.#send(def, query);
      const text = await res.text();
      let env: Envelope;
      try {
        env = JSON.parse(text) as Envelope;
      } catch (cause) {
        // Errors are sometimes XML even on .json endpoints.
        const xmlErr = parseXmlStatus(text);
        if (xmlErr) env = { status: xmlErr.status, message: xmlErr.message };
        else throw new OpenDartHttpError(`${def.path}: unparseable response body`, res.status, { cause });
      }
      if (env.status === '000') return env;
      const err = new OpenDartError(String(env.status), String(env.message ?? ''), def.path);
      if (err.isRetryable && attempt < this.#retries) { await this.#backoff(attempt); continue; }
      throw err;
    }
  }

  async #fetchFile(def: EndpointDef, query: Record<string, string>): Promise<Uint8Array> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.#send(def, query);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (isZip(buf)) return buf;
      const text = new TextDecoder('utf-8').decode(buf);
      const st = parseXmlStatus(text) ?? tryJsonStatus(text);
      if (!st) throw new OpenDartHttpError(`${def.path}: expected ZIP, got ${buf.length} bytes of something else`, res.status);
      const err = new OpenDartError(st.status, st.message, def.path);
      if (err.isRetryable && attempt < this.#retries) { await this.#backoff(attempt); continue; }
      throw err;
    }
  }

  #backoff(attempt: number): Promise<void> {
    return this.#sleep(this.#retryDelayMs * 2 ** attempt);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────
function unwrap(shape: ResponseShape, env: Envelope): unknown {
  switch (shape) {
    case 'list':
      return Array.isArray(env.list) ? env.list : [];
    case 'group':
      return normaliseGroups(env);
    case 'paged':
      return {
        page_no: Number(env.page_no ?? 1),
        page_count: Number(env.page_count ?? 0),
        total_count: Number(env.total_count ?? 0),
        total_page: Number(env.total_page ?? 0),
        list: (Array.isArray(env.list) ? env.list : []) as Filing[],
      } satisfies SearchPage;
    case 'object': {
      const { status: _s, message: _m, ...rest } = env;
      return rest;
    }
    case 'zip':
      throw new Error('unreachable');
  }
}

/** DS006 / V2 compensation: `group: [{ title, list: [...] }]`. Tolerates a single-object group or missing lists. */
function normaliseGroups(env: Envelope): DartGroup[] {
  const raw = env.group;
  const groups = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  return groups.map((g) => {
    const obj = (g ?? {}) as Record<string, unknown>;
    const list = Array.isArray(obj.list) ? obj.list : obj.list && typeof obj.list === 'object' ? [obj.list] : [];
    return { ...obj, list } as DartGroup;
  });
}

function emptyFor(shape: ResponseShape, query: Record<string, string>): unknown {
  if (shape === 'paged') {
    return { page_no: Number(query.page_no ?? 1), page_count: Number(query.page_count ?? 10), total_count: 0, total_page: 0, list: [] };
  }
  return [];
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .trim();
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>|<${name}\\s*/>`).exec(block);
  return m?.[1] !== undefined ? decodeXml(m[1]) : '';
}

export function parseXmlStatus(text: string): { status: string; message: string } | null {
  if (!/<status>/.test(text)) return null;
  return { status: tag(text, 'status'), message: tag(text, 'message') };
}

function tryJsonStatus(text: string): { status: string; message: string } | null {
  try {
    const j = JSON.parse(text) as { status?: unknown; message?: unknown };
    return j && typeof j.status === 'string' ? { status: j.status, message: String(j.message ?? '') } : null;
  } catch {
    return null;
  }
}

export function parseCorpCodeXml(xml: string): CorpCodeEntry[] {
  const out: CorpCodeEntry[] = [];
  for (const m of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const b = m[1]!;
    out.push({
      corp_code: tag(b, 'corp_code'),
      corp_name: tag(b, 'corp_name'),
      corp_eng_name: tag(b, 'corp_eng_name'),
      stock_code: tag(b, 'stock_code'),
      modify_date: tag(b, 'modify_date'),
    });
  }
  return out;
}
