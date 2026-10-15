import type { EndpointDef, ParamShape } from './endpoints.ts';
import { OpenDartValidationError } from './errors.ts';
import { toDartDate } from './normalize.ts';
import type {
  CorpParams, EventParams, MultiIdxParams, MultiPeriodicParams, PeriodicFsParams, PeriodicIdxParams,
  PeriodicParams, ReceiptParams, SearchParams, TaxonomyParams, XbrlParams,
} from './types.ts';

/** Maps each param shape to its request type. */
export interface ParamsByShape {
  search: SearchParams | undefined;
  corp: CorpParams;
  receipt: ReceiptParams;
  none: undefined;
  periodic: PeriodicParams;
  periodicFs: PeriodicFsParams;
  periodicIdx: PeriodicIdxParams;
  multiPeriodic: MultiPeriodicParams;
  multiIdx: MultiIdxParams;
  xbrl: XbrlParams;
  taxonomy: TaxonomyParams;
  event: EventParams;
}

export const MAX_MULTI_CORPS = 100;
export const MIN_BSNS_YEAR = 2015;

const REPORT_CODES = new Set(['11013', '11012', '11014', '11011']);
const IDX_CODES = new Set(['M210000', 'M220000', 'M230000', 'M240000']);
const SJ_DIV_RE = /^(BS[1-4]|IS[1-4]|CIS[1-4]|DCIS[1-8]|CF[1-4]|SCE[12])$/;
const DETAIL_TY_RE = /^[A-J]\d{3}$/;

type Query = Record<string, string>;

function fail(endpoint: string, msg: string): never {
  throw new OpenDartValidationError(`${endpoint}: ${msg}`);
}

function req<T>(ep: string, obj: object | undefined, key: string): T {
  const v = (obj as Record<string, unknown> | undefined)?.[key];
  if (v === undefined || v === null || v === '') fail(ep, `missing required param "${key}"`);
  return v as T;
}

function corpCode(ep: string, v: unknown): string {
  const s = String(v);
  if (!/^\d{8}$/.test(s)) fail(ep, `corp_code must be 8 digits, got "${s}"`);
  return s;
}

function bsnsYear(ep: string, v: unknown): string {
  const s = String(v);
  if (!/^\d{4}$/.test(s)) fail(ep, `bsns_year must be YYYY, got "${s}"`);
  if (Number(s) < MIN_BSNS_YEAR) fail(ep, `bsns_year must be >= ${MIN_BSNS_YEAR} (no data before)`);
  return s;
}

function reprtCode(ep: string, v: unknown): string {
  const s = String(v);
  if (!REPORT_CODES.has(s)) fail(ep, `reprt_code must be one of 11013/11012/11014/11011, got "${s}"`);
  return s;
}

function date(ep: string, key: string, v: unknown): string {
  const s = toDartDate(v as string | Date);
  if (!/^\d{8}$/.test(s)) fail(ep, `${key} must be YYYYMMDD, got "${String(v)}"`);
  return s;
}

function dateRange(ep: string, q: Query): void {
  if (q.bgn_de && q.end_de && q.bgn_de > q.end_de) fail(ep, `bgn_de (${q.bgn_de}) is after end_de (${q.end_de})`);
}

function rceptNo(ep: string, v: unknown): string {
  const s = String(v);
  if (!/^\d{14}$/.test(s)) fail(ep, `rcept_no must be 14 digits, got "${s}"`);
  return s;
}

function periodic(ep: string, p: PeriodicParams): Query {
  return {
    corp_code: corpCode(ep, req(ep, p, 'corp_code')),
    bsns_year: bsnsYear(ep, req(ep, p, 'bsns_year')),
    reprt_code: reprtCode(ep, req(ep, p, 'reprt_code')),
  };
}

function multiCorp(ep: string, v: unknown): string {
  const codes = (Array.isArray(v) ? v : String(v).split(',')).map((c) => String(c).trim()).filter(Boolean);
  if (codes.length === 0) fail(ep, 'corp_code list is empty');
  if (codes.length > MAX_MULTI_CORPS) fail(ep, `at most ${MAX_MULTI_CORPS} corp_codes per call (got ${codes.length}); use the *Chunked helper`);
  return codes.map((c) => corpCode(ep, c)).join(',');
}

function idxCl(ep: string, v: unknown): string {
  const s = String(v);
  if (!IDX_CODES.has(s)) fail(ep, `idx_cl_code must be one of M210000/M220000/M230000/M240000, got "${s}"`);
  return s;
}

function search(ep: string, p: SearchParams | undefined): Query {
  const q: Query = {};
  if (!p) return q;
  if (p.corp_code !== undefined) q.corp_code = corpCode(ep, p.corp_code);
  if (p.bgn_de !== undefined) q.bgn_de = date(ep, 'bgn_de', p.bgn_de);
  if (p.end_de !== undefined) q.end_de = date(ep, 'end_de', p.end_de);
  dateRange(ep, q);
  if (p.last_reprt_at !== undefined) {
    if (p.last_reprt_at !== 'Y' && p.last_reprt_at !== 'N') fail(ep, 'last_reprt_at must be Y or N');
    q.last_reprt_at = p.last_reprt_at;
  }
  if (p.pblntf_ty !== undefined) {
    if (!/^[A-J]$/.test(p.pblntf_ty)) fail(ep, 'pblntf_ty must be A–J');
    q.pblntf_ty = p.pblntf_ty;
  }
  if (p.pblntf_detail_ty !== undefined) {
    if (!DETAIL_TY_RE.test(p.pblntf_detail_ty)) fail(ep, 'pblntf_detail_ty must look like A001');
    if (p.pblntf_ty && p.pblntf_detail_ty[0] !== p.pblntf_ty) fail(ep, 'pblntf_detail_ty does not belong to pblntf_ty');
    q.pblntf_detail_ty = p.pblntf_detail_ty;
  }
  if (p.corp_cls !== undefined) {
    if (!/^[YKNE]$/.test(p.corp_cls)) fail(ep, 'corp_cls must be a single value of Y/K/N/E');
    q.corp_cls = p.corp_cls;
  }
  if (p.sort !== undefined) {
    if (!['date', 'crp', 'rpt'].includes(p.sort)) fail(ep, 'sort must be date/crp/rpt');
    q.sort = p.sort;
  }
  if (p.sort_mth !== undefined) {
    if (!['desc', 'asc'].includes(p.sort_mth)) fail(ep, 'sort_mth must be desc/asc');
    q.sort_mth = p.sort_mth;
  }
  if (p.page_no !== undefined) {
    if (!Number.isInteger(p.page_no) || p.page_no < 1) fail(ep, 'page_no must be an integer >= 1');
    q.page_no = String(p.page_no);
  }
  if (p.page_count !== undefined) {
    if (!Number.isInteger(p.page_count) || p.page_count < 1 || p.page_count > 100) fail(ep, 'page_count must be 1–100');
    q.page_count = String(p.page_count);
  }
  return q;
}

/** Validates params for an endpoint and returns the query string fields (minus crtfc_key). */
export function buildQuery(name: string, def: EndpointDef, params: unknown): Query {
  const ep = name;
  const p = params as never;
  const shape: ParamShape = def.params;
  switch (shape) {
    case 'none':
      return {};
    case 'search':
      return search(ep, p);
    case 'corp':
      return { corp_code: corpCode(ep, req(ep, p, 'corp_code')) };
    case 'receipt':
      return { rcept_no: rceptNo(ep, req(ep, p, 'rcept_no')) };
    case 'periodic':
      return periodic(ep, p);
    case 'periodicFs': {
      const fs = req<string>(ep, p, 'fs_div');
      if (fs !== 'OFS' && fs !== 'CFS') fail(ep, 'fs_div must be OFS or CFS');
      return { ...periodic(ep, p), fs_div: fs };
    }
    case 'periodicIdx':
      return { ...periodic(ep, p), idx_cl_code: idxCl(ep, req(ep, p, 'idx_cl_code')) };
    case 'multiPeriodic':
    case 'multiIdx': {
      const q: Query = {
        corp_code: multiCorp(ep, req(ep, p, 'corp_code')),
        bsns_year: bsnsYear(ep, req(ep, p, 'bsns_year')),
        reprt_code: reprtCode(ep, req(ep, p, 'reprt_code')),
      };
      if (shape === 'multiIdx') q.idx_cl_code = idxCl(ep, req(ep, p, 'idx_cl_code'));
      return q;
    }
    case 'xbrl':
      return { rcept_no: rceptNo(ep, req(ep, p, 'rcept_no')), reprt_code: reprtCode(ep, req(ep, p, 'reprt_code')) };
    case 'taxonomy': {
      const sj = String(req(ep, p, 'sj_div'));
      if (!SJ_DIV_RE.test(sj)) fail(ep, `sj_div must be a taxonomy template id like BS1/IS2/DCIS5/SCE1, got "${sj}"`);
      return { sj_div: sj };
    }
    case 'event': {
      const q: Query = {
        corp_code: corpCode(ep, req(ep, p, 'corp_code')),
        bgn_de: date(ep, 'bgn_de', req(ep, p, 'bgn_de')),
        end_de: date(ep, 'end_de', req(ep, p, 'end_de')),
      };
      dateRange(ep, q);
      return q;
    }
  }
}
