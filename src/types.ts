/**
 * Request/response types. Response field values are always strings on the wire
 * (amounts like "1,234", "-" for blank) — see `normalize.ts` for parsers.
 * Records keep an index signature because OpenDART adds/retires fields inline
 * over time (docs §10.8).
 */

// ── Shared enums (docs §2.3, §3) ──────────────────────────────────────
export const REPORT_CODES = {
  Q1: '11013',
  HALF: '11012',
  Q3: '11014',
  ANNUAL: '11011',
} as const;
export type ReportCode = (typeof REPORT_CODES)[keyof typeof REPORT_CODES];

export type CorpCls = 'Y' | 'K' | 'N' | 'E';
export type FsDiv = 'OFS' | 'CFS';
export type IndexClassCode = 'M210000' | 'M220000' | 'M230000' | 'M240000';
export type DisclosureType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
export type SortKey = 'date' | 'crp' | 'rpt';
export type SortOrder = 'desc' | 'asc';

/** Taxonomy template ids for `xbrlTaxonomy` (docs §5.3). */
export type TaxonomySjDiv =
  | `BS${1 | 2 | 3 | 4}` | `IS${1 | 2 | 3 | 4}` | `CIS${1 | 2 | 3 | 4}`
  | `DCIS${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` | `CF${1 | 2 | 3 | 4}` | `SCE${1 | 2}`;

/** Dates may be passed as `YYYYMMDD` strings or Date objects (formatted in KST). */
export type DateInput = string | Date;

// ── Request params ─────────────────────────────────────────────────────
export interface CorpParams { corp_code: string }
export interface ReceiptParams { rcept_no: string }

export interface PeriodicParams {
  corp_code: string;
  bsns_year: string | number;
  reprt_code: ReportCode;
}
export interface PeriodicFsParams extends PeriodicParams { fs_div: FsDiv }
export interface PeriodicIdxParams extends PeriodicParams { idx_cl_code: IndexClassCode }

export interface MultiPeriodicParams {
  /** Up to 100 corp codes (error 021 above that). The client chunks larger arrays via `*All` helpers. */
  corp_code: string | readonly string[];
  bsns_year: string | number;
  reprt_code: ReportCode;
}
export interface MultiIdxParams extends MultiPeriodicParams { idx_cl_code: IndexClassCode }

export interface XbrlParams { rcept_no: string; reprt_code: ReportCode }
export interface TaxonomyParams { sj_div: TaxonomySjDiv }

export interface EventParams {
  corp_code: string;
  bgn_de: DateInput;
  end_de: DateInput;
}

export interface SearchParams {
  corp_code?: string;
  bgn_de?: DateInput;
  end_de?: DateInput;
  last_reprt_at?: 'Y' | 'N';
  pblntf_ty?: DisclosureType;
  /** 4-char subtype, e.g. A001 (docs §3.2). */
  pblntf_detail_ty?: string;
  corp_cls?: CorpCls;
  sort?: SortKey;
  sort_mth?: SortOrder;
  page_no?: number;
  /** 1–100. */
  page_count?: number;
}

// ── Responses ──────────────────────────────────────────────────────────
export type DartRecord = Record<string, string | undefined>;

/** Identity fields on nearly all DS002/DS005/DS006 rows (docs §2.2). */
export interface IdentityFields {
  rcept_no?: string;
  corp_cls?: CorpCls;
  corp_code?: string;
  corp_name?: string;
  /** DS002 only. */
  stlm_dt?: string;
}
export type DartRow = IdentityFields & DartRecord;

export interface DartGroup<Row = DartRow> {
  title?: string;
  list: Row[];
  [key: string]: unknown;
}

export interface Envelope {
  status: string;
  message: string;
  list?: unknown[];
  group?: unknown[];
  [key: string]: unknown;
}

export interface Filing extends DartRecord {
  corp_cls: CorpCls;
  corp_name: string;
  corp_code: string;
  stock_code: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

export interface SearchPage {
  page_no: number;
  page_count: number;
  total_count: number;
  total_page: number;
  list: Filing[];
}

export interface CompanyProfile extends DartRecord {
  corp_name: string;
  corp_name_eng: string;
  stock_name: string;
  stock_code: string;
  ceo_nm: string;
  corp_cls: CorpCls;
  jurir_no: string;
  bizr_no: string;
  adres: string;
  hm_url: string;
  ir_url: string;
  phn_no: string;
  fax_no: string;
  induty_code: string;
  est_dt: string;
  acc_mt: string;
}

export interface CorpCodeEntry {
  corp_code: string;
  corp_name: string;
  corp_eng_name: string;
  /** Empty string for unlisted companies. */
  stock_code: string;
  modify_date: string;
}

export interface MajorAccountRow extends DartRecord {
  rcept_no: string;
  bsns_year: string;
  stock_code: string;
  reprt_code: string;
  account_nm: string;
  fs_div: string;
  fs_nm: string;
  sj_div: string;
  sj_nm: string;
  thstrm_nm: string;
  thstrm_dt: string;
  thstrm_amount: string;
  frmtrm_nm?: string;
  frmtrm_amount?: string;
  bfefrmtrm_nm?: string;
  bfefrmtrm_amount?: string;
  ord: string;
  currency: string;
}

export interface FullStatementRow extends DartRecord {
  rcept_no: string;
  reprt_code: string;
  bsns_year: string;
  corp_code: string;
  sj_div: 'BS' | 'IS' | 'CIS' | 'CF' | 'SCE';
  sj_nm: string;
  account_id: string;
  account_nm: string;
  account_detail?: string;
  thstrm_nm: string;
  thstrm_amount: string;
  thstrm_add_amount?: string;
  frmtrm_q_nm?: string;
  frmtrm_q_amount?: string;
  ord: string;
  currency: string;
}

export interface FinancialIndexRow extends DartRecord {
  reprt_code: string;
  bsns_year: string;
  corp_code: string;
  stock_code: string;
  stlm_dt: string;
  idx_cl_code: string;
  idx_cl_nm: string;
  idx_code: string;
  idx_nm: string;
  idx_val: string;
}

export interface MajorStockRow extends DartRow {
  rcept_dt: string;
  report_tp: string;
  repror: string;
  stkqy: string;
  stkqy_irds: string;
  stkrt: string;
  stkrt_irds: string;
  ctr_stkqy: string;
  ctr_stkrt: string;
  report_resn: string;
}

export interface ExecutiveStockRow extends DartRow {
  rcept_dt: string;
  repror: string;
  isu_exctv_rgist_at: string;
  isu_exctv_ofcps: string;
  isu_main_shrholdr: string;
  sp_stock_lmp_cnt: string;
  sp_stock_lmp_irds_cnt: string;
  sp_stock_lmp_rate: string;
  sp_stock_lmp_irds_rate: string;
}
