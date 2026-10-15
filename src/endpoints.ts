/**
 * Registry of all 85 OpenDART APIs (docs/opendart-api-guide.md §0–§8).
 * The client is driven entirely by this table: `params` selects the request
 * shape / validator, `response` selects how the envelope is unwrapped.
 */

export type GroupCode = 'DS001' | 'DS002' | 'DS003' | 'DS004' | 'DS005' | 'DS006';

export type ParamShape =
  | 'search'        // list (공시검색) — §3.1
  | 'corp'          // corp_code
  | 'receipt'       // rcept_no
  | 'none'          // corpCode.xml
  | 'periodic'      // corp_code + bsns_year + reprt_code
  | 'periodicFs'    // + fs_div
  | 'periodicIdx'   // + idx_cl_code
  | 'multiPeriodic' // corp_code[] + bsns_year + reprt_code
  | 'multiIdx'      // corp_code[] + bsns_year + reprt_code + idx_cl_code
  | 'xbrl'          // rcept_no + reprt_code
  | 'taxonomy'      // sj_div
  | 'event';        // corp_code + bgn_de + end_de

export type ResponseShape =
  | 'list'   // envelope.list[]
  | 'group'  // envelope.group[] of { title, list[] } (DS006, V2 compensation)
  | 'object' // envelope itself is the record (company)
  | 'paged'  // list + paging fields (공시검색)
  | 'zip';   // binary ZIP

export interface EndpointDef {
  /** Path segment, without extension. */
  readonly path: string;
  readonly group: GroupCode;
  readonly title: string;
  readonly params: ParamShape;
  readonly response: ResponseShape;
  /** File endpoints use `.xml` and return ZIP; everything else uses `.json`. */
  readonly ext: 'json' | 'xml';
}

// Generic so that `params` / `response` keep their literal types for the typed client surface.
const def = <P extends ParamShape, R extends ResponseShape = 'list'>(
  group: GroupCode, path: string, title: string, params: P,
  response: R = 'list' as R, ext: 'json' | 'xml' = 'json',
) => ({ group, path, title, params, response, ext }) as const;

const p2 = <R extends ResponseShape = 'list'>(path: string, title: string, response: R = 'list' as R) =>
  def('DS002', path, title, 'periodic', response);
const e5 = (path: string, title: string) => def('DS005', path, title, 'event');
const e6 = (path: string, title: string) => def('DS006', path, title, 'event', 'group');

export const ENDPOINTS = {
  // ── DS001 공시정보 ───────────────────────────────────────────────
  list: def('DS001', 'list', '공시검색', 'search', 'paged'),
  company: def('DS001', 'company', '기업개황', 'corp', 'object'),
  document: def('DS001', 'document', '공시서류원본파일', 'receipt', 'zip', 'xml'),
  corpCode: def('DS001', 'corpCode', '고유번호', 'none', 'zip', 'xml'),

  // ── DS002 정기보고서 주요정보 (30) ───────────────────────────────
  stockTotqySttus: p2('stockTotqySttus', '주식의 총수 현황'),
  tesstkAcqsDspsSttus: p2('tesstkAcqsDspsSttus', '자기주식 취득 및 처분 현황'),
  alotMatter: p2('alotMatter', '배당에 관한 사항'),
  irdsSttus: p2('irdsSttus', '증자(감자) 현황'),
  detScritsIsuAcmslt: p2('detScritsIsuAcmslt', '채무증권 발행실적'),
  entrprsBilScritsNrdmpBlce: p2('entrprsBilScritsNrdmpBlce', '기업어음증권 미상환 잔액'),
  srtpdPsndbtNrdmpBlce: p2('srtpdPsndbtNrdmpBlce', '단기사채 미상환 잔액'),
  cprndNrdmpBlce: p2('cprndNrdmpBlce', '회사채 미상환 잔액'),
  newCaplScritsNrdmpBlce: p2('newCaplScritsNrdmpBlce', '신종자본증권 미상환 잔액'),
  cndlCaplScritsNrdmpBlce: p2('cndlCaplScritsNrdmpBlce', '조건부 자본증권 미상환 잔액'),
  pssrpCptalUseDtls: p2('pssrpCptalUseDtls', '공모자금의 사용내역'),
  prvsrpCptalUseDtls: p2('prvsrpCptalUseDtls', '사모자금의 사용내역'),
  accnutAdtorNmNdAdtOpinion: p2('accnutAdtorNmNdAdtOpinion', '회계감사인의 명칭 및 감사의견'),
  adtServcCnclsSttus: p2('adtServcCnclsSttus', '감사용역체결현황'),
  accnutAdtorNonAdtServcCnclsSttus: p2('accnutAdtorNonAdtServcCnclsSttus', '회계감사인과의 비감사용역 계약체결 현황'),
  outcmpnyDrctrNdChangeSttus: p2('outcmpnyDrctrNdChangeSttus', '사외이사 및 그 변동현황'),
  hyslrSttus: p2('hyslrSttus', '최대주주 현황'),
  hyslrChgSttus: p2('hyslrChgSttus', '최대주주 변동현황'),
  mrhlSttus: p2('mrhlSttus', '소액주주 현황'),
  exctvSttus: p2('exctvSttus', '임원 현황'),
  empSttus: p2('empSttus', '직원 현황'),
  otrCprInvstmntSttus: p2('otrCprInvstmntSttus', '타법인 출자현황'),
  unrstExctvMendngSttus: p2('unrstExctvMendngSttus', '미등기임원 보수현황'),
  drctrAdtAllMendngSttusGmtsckConfmAmount: p2('drctrAdtAllMendngSttusGmtsckConfmAmount', '이사·감사 전체의 보수현황(주주총회 승인금액)'),
  hmvAuditAllSttus: p2('hmvAuditAllSttus', '이사·감사 전체의 보수현황(보수지급금액 - 이사·감사 전체)'),
  drctrAdtAllMendngSttusMendngPymntamtTyCl: p2('drctrAdtAllMendngSttusMendngPymntamtTyCl', '이사·감사 전체의 보수현황(보수지급금액 - 유형별)'),
  hmvAuditIndvdlBySttus: p2('hmvAuditIndvdlBySttus', '이사·감사의 개인별 보수현황(5억 이상)'),
  hmvAuditIndvdlBySttusV2: p2('hmvAuditIndvdlBySttusV2', '이사·감사의 개인별 보수현황(5억 이상) Ver 2.0', 'group'),
  indvdlByPay: p2('indvdlByPay', '개인별 보수지급 금액(5억이상 상위5인)'),
  indvdlByPayV2: p2('indvdlByPayV2', '개인별 보수지급 금액(5억이상 상위5인) Ver 2.0', 'group'),

  // ── DS003 정기보고서 재무정보 (7) ────────────────────────────────
  fnlttSinglAcnt: def('DS003', 'fnlttSinglAcnt', '단일회사 주요계정', 'periodic'),
  fnlttMultiAcnt: def('DS003', 'fnlttMultiAcnt', '다중회사 주요계정', 'multiPeriodic'),
  fnlttXbrl: def('DS003', 'fnlttXbrl', '재무제표 원본파일(XBRL)', 'xbrl', 'zip', 'xml'),
  fnlttSinglAcntAll: def('DS003', 'fnlttSinglAcntAll', '단일회사 전체 재무제표', 'periodicFs'),
  xbrlTaxonomy: def('DS003', 'xbrlTaxonomy', 'XBRL택사노미재무제표양식', 'taxonomy'),
  fnlttSinglIndx: def('DS003', 'fnlttSinglIndx', '단일회사 주요 재무지표', 'periodicIdx'),
  fnlttCmpnyIndx: def('DS003', 'fnlttCmpnyIndx', '다중회사 주요 재무지표', 'multiIdx'),

  // ── DS004 지분공시 종합정보 (2) ──────────────────────────────────
  majorstock: def('DS004', 'majorstock', '대량보유 상황보고', 'corp'),
  elestock: def('DS004', 'elestock', '임원·주요주주 소유보고', 'corp'),

  // ── DS005 주요사항보고서 주요정보 (36) ───────────────────────────
  astInhtrfEtcPtbkOpt: e5('astInhtrfEtcPtbkOpt', '자산양수도(기타), 풋백옵션'),
  dfOcr: e5('dfOcr', '부도발생'),
  bsnSp: e5('bsnSp', '영업정지'),
  ctrcvsBgrq: e5('ctrcvsBgrq', '회생절차 개시신청'),
  dsRsOcr: e5('dsRsOcr', '해산사유 발생'),
  bnkMngtPcbg: e5('bnkMngtPcbg', '채권은행 등의 관리절차 개시'),
  bnkMngtPcsp: e5('bnkMngtPcsp', '채권은행 등의 관리절차 중단'),
  lwstLg: e5('lwstLg', '소송 등의 제기'),
  piicDecsn: e5('piicDecsn', '유상증자 결정'),
  fricDecsn: e5('fricDecsn', '무상증자 결정'),
  pifricDecsn: e5('pifricDecsn', '유무상증자 결정'),
  crDecsn: e5('crDecsn', '감자 결정'),
  cvbdIsDecsn: e5('cvbdIsDecsn', '전환사채권 발행결정'),
  bdwtIsDecsn: e5('bdwtIsDecsn', '신주인수권부사채권 발행결정'),
  exbdIsDecsn: e5('exbdIsDecsn', '교환사채권 발행결정'),
  wdCocobdIsDecsn: e5('wdCocobdIsDecsn', '상각형 조건부자본증권 발행결정'),
  tsstkAqDecsn: e5('tsstkAqDecsn', '자기주식 취득 결정'),
  tsstkDpDecsn: e5('tsstkDpDecsn', '자기주식 처분 결정'),
  tsstkAqTrctrCnsDecsn: e5('tsstkAqTrctrCnsDecsn', '자기주식취득 신탁계약 체결 결정'),
  tsstkAqTrctrCcDecsn: e5('tsstkAqTrctrCcDecsn', '자기주식취득 신탁계약 해지 결정'),
  bsnInhDecsn: e5('bsnInhDecsn', '영업양수 결정'),
  bsnTrfDecsn: e5('bsnTrfDecsn', '영업양도 결정'),
  tgastInhDecsn: e5('tgastInhDecsn', '유형자산 양수 결정'),
  tgastTrfDecsn: e5('tgastTrfDecsn', '유형자산 양도 결정'),
  otcprStkInvscrInhDecsn: e5('otcprStkInvscrInhDecsn', '타법인 주식 및 출자증권 양수결정'),
  otcprStkInvscrTrfDecsn: e5('otcprStkInvscrTrfDecsn', '타법인 주식 및 출자증권 양도결정'),
  stkrtbdInhDecsn: e5('stkrtbdInhDecsn', '주권 관련 사채권 양수 결정'),
  stkrtbdTrfDecsn: e5('stkrtbdTrfDecsn', '주권 관련 사채권 양도 결정'),
  cmpMgDecsn: e5('cmpMgDecsn', '회사합병 결정'),
  cmpDvDecsn: e5('cmpDvDecsn', '회사분할 결정'),
  cmpDvmgDecsn: e5('cmpDvmgDecsn', '회사분할합병 결정'),
  stkExtrDecsn: e5('stkExtrDecsn', '주식교환·이전 결정'),
  ovLstDecsn: e5('ovLstDecsn', '해외 증권시장 주권등 상장 결정'),
  ovDlstDecsn: e5('ovDlstDecsn', '해외 증권시장 주권등 상장폐지 결정'),
  ovLst: e5('ovLst', '해외 증권시장 주권등 상장'),
  ovDlst: e5('ovDlst', '해외 증권시장 주권등 상장폐지'),

  // ── DS006 증권신고서 주요정보 (6) ────────────────────────────────
  estkRs: e6('estkRs', '지분증권'),
  bdRs: e6('bdRs', '채무증권'),
  stkdpRs: e6('stkdpRs', '증권예탁증권'),
  mgRs: e6('mgRs', '합병'),
  extrRs: e6('extrRs', '주식의포괄적교환·이전'),
  dvRs: e6('dvRs', '분할'),
} as const satisfies Record<string, EndpointDef>;

export type EndpointName = keyof typeof ENDPOINTS;

/** Endpoint names whose definition matches the given param shape. */
export type EndpointsWithParams<S extends ParamShape> = {
  [K in EndpointName]: (typeof ENDPOINTS)[K]['params'] extends S ? K : never
}[EndpointName];

export const ENDPOINT_NAMES = Object.keys(ENDPOINTS) as EndpointName[];

export function endpointsInGroup(group: GroupCode): EndpointName[] {
  return ENDPOINT_NAMES.filter((n) => ENDPOINTS[n].group === group);
}
