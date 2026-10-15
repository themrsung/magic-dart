# OpenDART API Developer Guide — Structured Summary

> **Snapshot:** 2026-10-15 (Thu, KST) · **Source:** opendart.fss.or.kr › 개발가이드 (all 6 groups, 85 APIs, scanned via the logged-in UI)
> **Scope:** endpoints, request parameters, response schemas, code tables, error codes. Field lists in §4–§8 omit the common envelope/identity fields described in §2.

---

## 0. Quick index

| Group | Code | # APIs | Query pattern |
|---|---|---|---|
| 공시정보 | DS001 | 4 | mixed (see §3) |
| 정기보고서 주요정보 | DS002 | 30 | `corp_code` + `bsns_year` + `reprt_code` |
| 정기보고서 재무정보 | DS003 | 7 | `corp_code` + `bsns_year` + `reprt_code` (+ extras) |
| 지분공시 종합정보 | DS004 | 2 | `corp_code` only |
| 주요사항보고서 주요정보 | DS005 | 36 | `corp_code` + `bgn_de` + `end_de` |
| 증권신고서 주요정보 | DS006 | 6 | `corp_code` + `bgn_de` + `end_de` |

---

## 1. Basics

- **Base URL:** `https://opendart.fss.or.kr/api/{endpoint}.{json|xml}`
- **Method:** `GET` · **Encoding:** UTF-8 · **Formats:** JSON and XML for every API, **except** file-returning endpoints (`document.xml`, `corpCode.xml`, `fnlttXbrl.xml`), which are XML/ZIP only.
- **Auth:** `crtfc_key` (STRING(40), required on every call).
- **Rate limit:** generally **20,000 requests/day** per key (error `020`), unless a different limit is configured for the key.
- **Viewer link from `rcept_no`:** `https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}`

## 2. Common conventions

### 2.1 Response envelope
| Key | Meaning |
|---|---|
| `status` | Result code (§9) |
| `message` | Result message |
| `list` | Array of records (most APIs) |

### 2.2 Recurring identity fields (present on nearly all DS002/DS005/DS006 records)
`rcept_no` (접수번호, 14자리) · `corp_cls` (Y 유가 / K 코스닥 / N 코넥스 / E 기타) · `corp_code` (고유번호, 8자리) · `corp_name` · DS002 also returns `stlm_dt` (결산기준일, YYYY-MM-DD).

### 2.3 Shared request parameters
| Param | Type | Values |
|---|---|---|
| `corp_code` | STRING(8) | From the 고유번호 file (`corpCode.xml`) |
| `bsns_year` | STRING(4) | 사업연도; data from **2015+** (재무지표 APIs: **2023 Q3+**) |
| `reprt_code` | STRING(5) | `11013` 1Q · `11012` 반기 · `11014` 3Q · `11011` 사업보고서 |
| `bgn_de` / `end_de` | STRING(8) | YYYYMMDD, keyed on **최초접수일**; data from 2015+ |

### 2.4 Value formats used in docs
Amounts/counts shown as `9,999,999,999`; ratios as `0.00`; dates either `YYYYMMDD`, `YYYY-MM-DD`, or `YYYY.MM.DD` depending on the API (inconsistent — normalise on ingest).

---

## 3. DS001 — 공시정보

| API | Endpoint | Request (beyond `crtfc_key`) | Returns |
|---|---|---|---|
| 공시검색 | `list` | see §3.1 | Paged filing list |
| 기업개황 | `company` | `corp_code` (Y) | Company profile |
| 공시서류원본파일 | `document.xml` | `rcept_no` (Y, 14) | **ZIP** of original filing |
| 고유번호 | `corpCode.xml` | — | **ZIP** containing XML of all corp codes |

### 3.1 공시검색 (`list`) request
| Param | Req | Notes |
|---|---|---|
| `corp_code` | N | If omitted, search window is **capped at 3 months** |
| `bgn_de` | N | Default = `end_de` |
| `end_de` | N | Default = today |
| `last_reprt_at` | N | `Y` = final reports only; default `N` (includes 정정) |
| `pblntf_ty` | N | A 정기 · B 주요사항 · C 발행 · D 지분 · E 기타 · F 외부감사 · G 펀드 · H 자산유동화 · I 거래소 · J 공정위 |
| `pblntf_detail_ty` | N | 4-char subtype (§3.2) |
| `corp_cls` | N | Y/K/N/E; single value only |
| `sort` | N | `date` (default) · `crp` · `rpt` |
| `sort_mth` | N | `desc` (default) · `asc` |
| `page_no` | N | default 1 |
| `page_count` | N | 1–100, default 10 |

**Response:** `page_no`, `page_count`, `total_count`, `total_page`, and `list[]` of `corp_cls`, `corp_name`, `corp_code`, `stock_code`, `report_nm`, `rcept_no`, `flr_nm` (제출인), `rcept_dt` (YYYYMMDD), `rm`.

- `report_nm` prefixes: `[기재정정]`, `[첨부정정]`, `[첨부추가]`, `[변경등록]`, `[연장결정]`, `[발행조건확정]`, `[정정명령부과]`, `[정정제출요구]`.
- `rm` flags (concatenated chars): 유 유가증권시장본부 · 코 코스닥시장본부 · 채 채권상장법인 · 넥 코넥스 · 공 공정위 · 연 연결 포함 · 정 후속 정정 있음 · 철 철회(간주).

### 3.2 `pblntf_detail_ty` codes
| Type | Codes |
|---|---|
| A 정기 | A001 사업 · A002 반기 · A003 분기 · A004 등록법인결산서류(자본시장법 이전) · A005 소액공모법인결산서류 |
| B 주요사항 | B001 주요사항보고서 · B002 주요경영사항신고(구) · B003 최대주주등과의거래신고(구) |
| C 발행 | C001–C005 증권신고(지분/채무/파생결합/합병등/기타) · C006–C010 소액공모(동일 순서) · C011 호가중개시스템 소액매출 |
| D 지분 | D001 대량보유 · D002 임원·주요주주 소유 · D003 의결권대리행사권유 · D004 공개매수 · D005 임원·주요주주 거래계획 |
| E 기타 | E001 자기주식취득/처분 · E002 신탁계약 · E003 합병등종료 · E004 주식매수선택권 · E005 사외이사 · E006 주총소집 · E007 시장조성/안정조작 · E008 합병등신고서(구) · E009 금융위등록/취소(구) · E010 커버드본드 |
| F 외부감사 | F001 감사 · F002 연결감사 · F003 결합감사 · F004 회계법인사업 · F005 감사전재무제표미제출 |
| G 펀드 | G001 신탁형 · G002 회사형 · G003 합병 |
| H 자산유동화 | H001 유동화계획/양도등록 · H002 사업/반기/분기 · H003 증권신고(유동화증권) · H004 채권유동화계획 · H005 중요사항발생 · H006 주요사항 |
| I 거래소 | I001 수시 · I002 공정 · I003 시장조치/안내 · I004 지분 · I005 증권투자회사 · I006 채권 |
| J 공정위 | J001 대규모내부거래 · J002 동(구) · J004 기업집단현황 · J005 비상장회사중요사항 · J006 기타 · J008 대규모내부거래(공익법인) · J009 하도급대금결제조건 |

### 3.3 기업개황 (`company`) response
`corp_name`, `corp_name_eng`, `stock_name`, `stock_code`, `ceo_nm`, `corp_cls`, `jurir_no` (법인등록번호), `bizr_no` (사업자등록번호), `adres`, `hm_url`, `ir_url`, `phn_no`, `fax_no`, `induty_code`, `est_dt` (YYYYMMDD), `acc_mt` (결산월 MM).

### 3.4 고유번호 ZIP contents
`corp_code`, `corp_name`, `corp_eng_name`, `stock_code`, `modify_date` (YYYYMMDD).

---

## 4. DS002 — 정기보고서 주요정보
All 30 APIs: **request = `corp_code` + `bsns_year` + `reprt_code`** (all required).

### 4.1 Capital & shares
| API | Endpoint | Key fields |
|---|---|---|
| 주식의 총수 현황 | `stockTotqySttus` | `se`, `isu_stock_totqy` (발행할), `now_to_isu_stock_totqy`, `now_to_dcrs_stock_totqy`, `redc`, `profit_incnr`, `rdmstk_repy`, `etc`, `istc_totqy` (발행주식총수), `tesstk_co` (자기주식), `distb_stock_co` (유통주식) |
| 자기주식 취득 및 처분 현황 | `tesstkAcqsDspsSttus` | `acqs_mth1/2/3`, `stock_knd`, `bsis_qy`, `change_qy_acqs/dsps/incnr`, `trmend_qy`, `rm` |
| 배당에 관한 사항 | `alotMatter` | `se`, `stock_knd`, `thstrm`, `frmtrm`, `lwfr` |
| 증자(감자) 현황 | `irdsSttus` | `isu_dcrs_de`, `isu_dcrs_stle`, `isu_dcrs_stock_knd`, `isu_dcrs_qy`, `isu_dcrs_mstvdv_fval_amount`, `isu_dcrs_mstvdv_amount` |

### 4.2 Debt securities outstanding
| API | Endpoint | Maturity buckets |
|---|---|---|
| 채무증권 발행실적 | `detScritsIsuAcmslt` | (issuance rows) `isu_cmpny`, `scrits_knd_nm`, `isu_mth_nm`, `isu_de`, `facvalu_totamt`, `intrt`, `evl_grad_instt`, `mtd`, `repy_at`, `mngt_cmpny` |
| 기업어음증권 미상환 잔액 | `entrprsBilScritsNrdmpBlce` | ≤10d · 10–30d · 30–90d · 90–180d · 180d–1y · 1–2y · 2–3y · >3y · `sm` |
| 단기사채 미상환 잔액 | `srtpdPsndbtNrdmpBlce` | ≤10d … 180d–1y · `sm` · `isu_lmt` · `remndr_lmt` |
| 회사채 미상환 잔액 | `cprndNrdmpBlce` | ≤1y · 1–2 · 2–3 · 3–4 · 4–5 · 5–10 · >10y · `sm` |
| 신종자본증권 미상환 잔액 | `newCaplScritsNrdmpBlce` | ≤1y · 1–5 · 5–10 · 10–15 · 15–20 · 20–30 · >30y · `sm` |
| 조건부 자본증권 미상환 잔액 | `cndlCaplScritsNrdmpBlce` | ≤1y · 1–2 · 2–3 · 3–4 · 4–5 · 5–10 · 10–20 · 20–30 · >30y · `sm` |

All 미상환 APIs also return `remndr_exprtn1` / `remndr_exprtn2` (잔여만기 row labels).

### 4.3 Use of proceeds
| API | Endpoint | Notes |
|---|---|---|
| 공모자금의 사용내역 | `pssrpCptalUseDtls` | Schema changed: `pay_amount`/`on_dclrt_cptal_use_plan`/`real_cptal_use_sttus` used **≤2018-01-18**; `rs_cptal_use_plan_*`, `real_cptal_use_dtls_*` added **2018-01-19+**; `tm` (회차) added 2019-12-09 |
| 사모자금의 사용내역 | `prvsrpCptalUseDtls` | Same versioning; plan fields prefixed `mtrpt_cptal_use_plan_*` |

### 4.4 Audit
| API | Endpoint | Key fields |
|---|---|---|
| 회계감사인의 명칭 및 감사의견 | `accnutAdtorNmNdAdtOpinion` | `bsns_year` (당기/전기/전전기), `adtor`, `adt_opinion`, `adt_reprt_spcmnt_matter` (≤2019-12-08), `emphs_matter`, `core_adt_matter` (2019-12-09+) |
| 감사용역체결현황 | `adtServcCnclsSttus` | `adtor`, `cn`, `mendng`/`tot_reqre_time` (≤2020-07-05); `adt_cntrct_dtls_mendng/time`, `real_exc_dtls_mendng/time` (2020-07-06+) |
| 비감사용역 계약체결 현황 | `accnutAdtorNonAdtServcCnclsSttus` | `cntrct_cncls_de`, `servc_cn`, `servc_exc_pd`, `servc_mendng` |

### 4.5 Governance & ownership
| API | Endpoint | Key fields |
|---|---|---|
| 독립(사외)이사 및 그 변동현황 | `outcmpnyDrctrNdChangeSttus` | `drctr_co`, `otcmp_drctr_co`, `apnt`, `rlsofc`, `mdstrm_resig` |
| 최대주주 현황 | `hyslrSttus` | `nm`, `relate`, `stock_knd`, `bsis_posesn_stock_co/qota_rt`, `trmend_posesn_stock_co/qota_rt` |
| 최대주주 변동현황 | `hyslrChgSttus` | `change_on` (YYYY.MM.DD), `mxmm_shrholdr_nm`, `posesn_stock_co`, `qota_rt`, `change_cause` |
| 소액주주 현황 | `mrhlSttus` | `shrholdr_co`, `shrholdr_tot_co`, `shrholdr_rate`, `hold_stock_co`, `stock_tot_co`, `hold_stock_rate` |
| 임원 현황 | `exctvSttus` | `nm`, `sexdstn`, `birth_ym`, `ofcps`, `rgist_exctv_at`, `fte_at`, `chrg_job`, `main_career`, `mxmm_shrholdr_relate`, `hffc_pd`, `tenure_end_on` |
| 직원 현황 | `empSttus` | `fo_bbm`, `sexdstn`, `rgllbr_co`, `cnttk_co` (+단시간), `sm`, `avrg_cnwk_sdytrn`, `fyer_salary_totamt`, `jan_salary_am` |
| 타법인 출자현황 | `otrCprInvstmntSttus` | `inv_prm`, `frst_acqs_de/amount`, `invstmnt_purps`, `bsis_blce_*`, `incrs_dcrs_*`, `trmend_blce_qy/qota_rt/acntbk_amount`, `recent_bsns_year_fnnr_sttus_tot_assets/thstrm_ntpf` |

### 4.6 Compensation
| API | Endpoint | Key fields |
|---|---|---|
| 미등기임원 보수현황 | `unrstExctvMendngSttus` | `nmpr`, `fyer_salary_totamt`, `jan_salary_am` |
| 이사·감사 전체 보수(주총 승인금액) | `drctrAdtAllMendngSttusGmtsckConfmAmount` | `se`, `nmpr`, `gmtsck_confm_amount`, `fscl_year` |
| 이사·감사 전체 보수(지급금액 – 전체) | `hmvAuditAllSttus` | `nmpr`, `mendng_totamt`, `jan_avrg_mendng_am`, `fscl_year` + 주식기준보상 block ¹ |
| 이사·감사 전체 보수(지급금액 – 유형별) | `drctrAdtAllMendngSttusMendngPymntamtTyCl` | `se`, `nmpr`, `pymnt_totamt`, `psn1_avrg_pymntamt`, `fscl_year` + block ¹ |
| 개인별 보수현황(5억 이상) | `hmvAuditIndvdlBySttus` | `nm`, `ofcps`, `mendng_totamt`, `mendng_totamt_ct_incls_mendng` |
| 개인별 보수현황(5억 이상) **Ver 2.0** | `hmvAuditIndvdlBySttusV2` | Nested `group` → `list`; adds `fscl_year`, `stk_bsd_pd_mendng_totamt_knd/qty/amt`, `stk_opt_exrc_pr` + block ¹ |
| 상위5인 개인별 보수(5억 이상) | `indvdlByPay` | same as v1 above |
| 상위5인 개인별 보수 **Ver 2.0** | `indvdlByPayV2` | same structure as `hmvAuditIndvdlBySttusV2` |

¹ Stock-based comp block: `stk_bsd_pd_mendng_totamt`, `stk_opt_exrcsbl_qty`, `stk_opt_unexrcsbl_qty`, `stk_opt_rmn_blce`, `othr_stk_bsd_cmpn_unpyd_qty`, `othr_stk_bsd_cmpn_mkt_vl`.

> **New in 2026 (apiId 2026001/2026002):** the V2 compensation endpoints. Note V2 responses are **nested** (`group` with individual header → `list` of stock-comp rows) rather than flat.

---

## 5. DS003 — 정기보고서 재무정보

| API | Endpoint | Request (beyond key) | Notes |
|---|---|---|---|
| 단일회사 주요계정 | `fnlttSinglAcnt` | `corp_code`, `bsns_year`, `reprt_code` | BS/IS major accounts, both OFS/CFS |
| 다중회사 주요계정 | `fnlttMultiAcnt` | same; multiple `corp_code` | Max 100 companies (error `021`) ² |
| 재무제표 원본파일(XBRL) | `fnlttXbrl.xml` | `rcept_no`, `reprt_code` | **ZIP** of XBRL instance |
| 단일회사 전체 재무제표 | `fnlttSinglAcntAll` | + `fs_div` (`OFS` 별도 / `CFS` 연결) | Full statements BS/IS/CIS/CF/SCE |
| XBRL 택사노미 재무제표양식 | `xbrlTaxonomy` | `sj_div` only | Standard taxonomy templates |
| 단일회사 주요 재무지표 | `fnlttSinglIndx` | + `idx_cl_code` | Data from **2023 Q3+** |
| 다중회사 주요 재무지표 | `fnlttCmpnyIndx` | + `idx_cl_code`; multiple `corp_code` | Data from 2023 Q3+ |

² The request table only documents `corp_code` as STRING(8); multi-company calls pass comma-separated codes. The 100-company cap comes from error `021`.

### 5.1 주요계정 response (`fnlttSinglAcnt` / `fnlttMultiAcnt`)
`rcept_no`, `bsns_year`, `stock_code`, `reprt_code`, `account_nm`, `fs_div`/`fs_nm`, `sj_div` (BS/IS)/`sj_nm`, `thstrm_nm/dt/amount/add_amount`, `frmtrm_nm/dt/amount/add_amount`, `bfefrmtrm_nm/dt/amount` (사업보고서 only), `ord`, `currency`.

### 5.2 전체 재무제표 response (`fnlttSinglAcntAll`)
Adds `account_id` (XBRL 표준계정ID; non-standard → `-표준계정코드 미사용-`), `account_detail`, `frmtrm_q_nm/amount`. `sj_div` ∈ BS · IS · CIS · CF · SCE.
- For 분/반기 reports, IS/CIS `thstrm_amount` and `frmtrm_q_amount` are the **3-month** figure; `*_add_amount` is cumulative.

### 5.3 `sj_div` for `xbrlTaxonomy`
BS1–BS4 재무상태표 · IS1–IS4 손익계산서 · CIS1–CIS4 포괄손익계산서 · DCIS1–DCIS8 단일 포괄손익계산서 (세후/세전 variants) · CF1–CF4 현금흐름표 · SCE1–SCE2 자본변동표.

### 5.4 재무지표 (`idx_cl_code`)
| Code | Class |
|---|---|
| `M210000` | 수익성 |
| `M220000` | 안정성 |
| `M230000` | 성장성 |
| `M240000` | 활동성 |

Response: `reprt_code`, `bsns_year`, `corp_code`, `stock_code`, `stlm_dt`, `idx_cl_code/nm`, `idx_code` (e.g., `M211000`), `idx_nm` (e.g., 영업이익률), `idx_val` (e.g., 0.256).

---

## 6. DS004 — 지분공시 종합정보
Request: `corp_code` only.

| API | Endpoint | Key fields |
|---|---|---|
| 대량보유 상황보고 (5% rule) | `majorstock` | `rcept_dt`, `report_tp`, `repror`, `stkqy`, `stkqy_irds`, `stkrt`, `stkrt_irds`, `ctr_stkqy`, `ctr_stkrt`, `report_resn` |
| 임원·주요주주 소유보고 | `elestock` | `rcept_dt` (YYYY-MM-DD), `repror`, `isu_exctv_rgist_at`, `isu_exctv_ofcps`, `isu_main_shrholdr`, `sp_stock_lmp_cnt`, `sp_stock_lmp_irds_cnt`, `sp_stock_lmp_rate`, `sp_stock_lmp_irds_rate` |

---

## 7. DS005 — 주요사항보고서 주요정보
All 36 APIs: **request = `corp_code` + `bgn_de` + `end_de`** (all required; keyed on 최초접수일).

**Recurring fields:** `bddd` (이사회결의일), `od_a_at_t` / `od_a_at_b` (사외이사 참석/불참), `adt_a_atn` (감사 참석), `ftc_stt_atn` (공정위 신고대상), `popt_ctr_atn` / `popt_ctr_cn` (풋옵션 계약), `rs_sm_atn` / `ex_sm_r` (증권신고서 제출대상/면제사유), `exevl_*` (외부평가: 여부/근거/기관/기간/의견), `aprskh_*` (주식매수청구권), `dlptn_*` (거래상대방), `fdpp_*` (자금조달 목적: `fclt` 시설 · `bsninh` 영업양수 · `op` 운영 · `dtrp` 채무상환 · `ocsa` 타법인증권 · `etc`).

### 7.1 Distress / corporate events
| API | Endpoint | Key fields |
|---|---|---|
| 자산양수도(기타), 풋백옵션 | `astInhtrfEtcPtbkOpt` | `rp_rsn`, `ast_inhtrf_prc` |
| 부도발생 | `dfOcr` | `df_cn`, `df_amt`, `df_bnk`, `dfd`, `df_rs` |
| 영업정지 | `bsnSp` | `bsnsp_rm`, `bsnsp_amt`, `rsl`, `sl_vs`, `bsnsp_cn/rs`, `ft_ctp`, `bsnsp_af`, `bsnspd` |
| 회생절차 개시신청 | `ctrcvsBgrq` | `apcnt`, `cpct`, `rq_rs`, `rqd`, `ft_ctp_sc` |
| 해산사유 발생 | `dsRsOcr` | `ds_rs`, `ds_rsd` |
| 채권은행 관리절차 개시 | `bnkMngtPcbg` | `mngt_pcbg_dd`, `mngt_int`, `mngt_pd`, `mngt_rs`, `cfd` |
| 채권은행 관리절차 중단 | `bnkMngtPcsp` | `mngt_pcsp_dd`, `mngt_int`, `sp_rs`, `ft_ctp`, `cfd` |
| 소송 등의 제기 | `lwstLg` | `icnm`, `ac_ap`, `rq_cn`, `cpct`, `ft_ctp`, `lgd`, `cfd` |

### 7.2 Equity capital actions
| API | Endpoint | Key fields |
|---|---|---|
| 유상증자 결정 | `piicDecsn` | `nstk_ostk_cnt`, `nstk_estk_cnt`, `fv_ps`, `bfic_tisstk_ostk/estk`, `fdpp_*`, `ic_mthn`, `ssl_at`/`ssl_bgd`/`ssl_edd` (공매도) |
| 무상증자 결정 | `fricDecsn` | `nstk_*_cnt`, `nstk_asstd`, `nstk_ascnt_ps_ostk/estk` (up to 20 decimals), `nstk_dividrk`, `nstk_dlprd`, `nstk_lstprd` |
| 유무상증자 결정 | `pifricDecsn` | `piic_*` + `fric_*` (union of above) + 공매도 |
| 감자 결정 | `crDecsn` | `crstk_ostk/estk_cnt`, `bfcr_cpt`/`atcr_cpt`, `bfcr/atcr_tisstk_*`, `cr_rt_ostk/estk`, `cr_std`, `cr_mth`, `cr_rs`, `crsc_*` schedule, `cdobprpd_*` |

### 7.3 Hybrid / debt issuance
| API | Endpoint | Distinctive fields |
|---|---|---|
| 전환사채권(CB) 발행결정 | `cvbdIsDecsn` | `cv_rt`, `cv_prc`, `cvisstk_knd/cnt/tisstk_vs`, `cvrqpd_bgd/edd`, `act_mktprcfl_cvprc_lwtrsprc(_bs)` (리픽싱 floor), `rmislmt_lt70p` |
| 신주인수권부사채(BW) 발행결정 | `bdwtIsDecsn` | `ex_rt`, `ex_prc`, `ex_prc_dmth`, `bdwt_div_atn` (분리여부), `nstk_pym_mth`, `nstk_isstk_*`, `expd_bgd/edd`, refixing fields |
| 교환사채(EB) 발행결정 | `exbdIsDecsn` | `ex_rt`, `ex_prc`, `ex_prc_dmth`, `extg`, `extg_stkcnt`, `extg_tisstk_vs`, `exrqpd_bgd/edd` |
| 상각형 조건부자본증권 발행결정 | `wdCocobdIsDecsn` | `dbtrs_sc` (채무재조정 범위) |

Common to all four: `bd_tm`, `bd_knd`, `bd_fta`, `atcsc_rmislmt` (정관상 잔여한도; CB/BW), `ovis_fta/fta_crn/ster/isar/mktnm` (해외발행), `fdpp_*`, `bd_intr_ex` (표면), `bd_intr_sf` (만기), `bd_mtd`, `bdis_mthn`, `sbd`, `pymd`, `rpmcmp`, `grint`, `ovis_ltdtl`.
⚠️ In `wdCocobdIsDecsn` the labels for `bd_intr_sf`/`bd_intr_ex` are **swapped** vs. the other three (sf = 표면, ex = 만기) — verify against live data.

### 7.4 Treasury stock
| API | Endpoint | Distinctive fields |
|---|---|---|
| 자기주식 취득 결정 | `tsstkAqDecsn` | `aqpln_stk_*`, `aqpln_prc_*`, `aqexpd_*`, `hdexpd_*`, `aq_pp`, `aq_mth`, `cs_iv_bk`, `aq_dd`, `d1_prodlm_*` |
| 자기주식 처분 결정 | `tsstkDpDecsn` | `dppln_stk_*`, `dpstk_prc_*`, `dppln_prc_*`, `dpprpd_*`, `dp_pp`, `dp_m_mkt/ovtm/otc/etc`, `dp_dd`, `d1_slodlm_*` |
| 자기주식취득 신탁계약 체결 | `tsstkAqTrctrCnsDecsn` | `ctr_prc`, `ctr_pd_bgd/edd`, `ctr_pp`, `ctr_cns_int`, `ctr_cns_prd` |
| 자기주식취득 신탁계약 해지 | `tsstkAqTrctrCcDecsn` | `ctr_prc_bfcc/atcc`, `cc_pp`, `cc_int`, `cc_prd`, `tp_rm_atcc` |

All four carry the pre-transaction holdings block: `aq_wtn_div_ostk/estk(_rt)` (배당가능이익 내) and `eaq_ostk/estk(_rt)` (기타취득).

### 7.5 Asset / business transfers
| API | Endpoint |
|---|---|
| 영업양수 / 영업양도 결정 | `bsnInhDecsn` / `bsnTrfDecsn` |
| 유형자산 양수 / 양도 결정 | `tgastInhDecsn` / `tgastTrfDecsn` |
| 타법인 주식·출자증권 양수 / 양도결정 | `otcprStkInvscrInhDecsn` / `otcprStkInvscrTrfDecsn` |
| 주권 관련 사채권 양수 / 양도 결정 | `stkrtbdInhDecsn` / `stkrtbdTrfDecsn` |

Pattern: `inh_*` (양수) ↔ `trf_*` (양도) mirrored; amount + `*_tast_vs` (총자산 대비) / `*_ecpt_vs` (자기자본 대비) materiality ratios; 영업양수도 adds segment `ast_/sl_/dbt_*` with A/B ratios; 타법인 adds `iscmp_*` (발행회사) and post-deal `atinh_/attrf_owstkcnt`, `*_eqrt`; 우회상장 flags `bdlst_atn`, `n6m_tpai_plann`.

### 7.6 M&A / restructuring
| API | Endpoint | Distinctive fields |
|---|---|---|
| 회사합병 결정 | `cmpMgDecsn` | `mg_mth`, `mg_stn`, `mg_rt`, `mg_rt_bs`, `mgnstk_*`, `mgptncmp_*`, `rbsnfdtl_*` (상대회사 재무), `nmgcmp_*` (신설), `mgsc_*` schedule |
| 회사분할 결정 | `cmpDvDecsn` | `dv_mth`, `dv_rt`, `dv_trfbsnprt_cn`, `atdv_excmp_*` (존속), `dvfcmp_*` (신설), `abcr_*` (감자), `dvdt`, `dvrgsprd` |
| 회사분할합병 결정 | `cmpDvmgDecsn` | union of 분할 + 합병 fields, `dvmg_rt(_bs)`, `dvmgsc_*` schedule |
| 주식교환·이전 결정 | `stkExtrDecsn` | `extr_sen`, `extr_stn`, `extr_tgcmp_*`, `extr_rt(_bs)`, `extrsc_*` schedule, `atextr_cpcmpnm` (완전모회사) |

### 7.7 Overseas listing
| API | Endpoint | Key fields |
|---|---|---|
| 해외 상장 결정 | `ovLstDecsn` | `lstprstk_*_cnt`, `tisstk_*`, `psmth_nstk_sl/ostk_sl`, `fdpp`, `lststk_orlst/drlst`, `lstex_nt`, `lstpp`, `lstprd` |
| 해외 상장폐지 결정 | `ovDlstDecsn` | `dlststk_*_cnt`, `lstex_nt`, `dlstrq_prd`, `dlst_prd`, `dlst_rs` |
| 해외 상장 | `ovLst` | `lststk_*_cnt`, `lstex_nt`, `stk_cd`, `lstd`, `cfd` |
| 해외 상장폐지 | `ovDlst` | `lstex_nt`, `dlststk_*_cnt`, `tredd`, `dlst_rs`, `cfd` |

---

## 8. DS006 — 증권신고서 주요정보
All 6 APIs: **request = `corp_code` + `bgn_de` + `end_de`**. Responses are **grouped**: an array of `group` objects, each with a `title` and its own `list`.

| API | Endpoint | Groups (`title`) |
|---|---|---|
| 지분증권 | `estkRs` | 일반사항 · 증권의종류 · 인수인정보 · 자금의사용목적 · 매출인에관한사항 · 일반청약자환매청구권 |
| 채무증권 | `bdRs` | 일반사항 · 인수인정보 · 자금의사용목적 · 매출인에관한사항 |
| 증권예탁증권 | `stkdpRs` | 일반사항 · 증권의종류 · 인수인정보 · 자금의사용목적 · 매출인에관한사항 |
| 합병 | `mgRs` | 일반사항 · 발행증권 · 당사회사에관한사항 |
| 주식의포괄적교환·이전 | `extrRs` | same as 합병 |
| 분할 | `dvRs` | same as 합병 |

**Group fields (high level):**
- 일반사항 (지분/예탁): `sbd`, `pymd`, `sband`, `asand`, `asstd`, `exstk/exprc/expd` (신주인수권), `rpt_rcpn`
- 일반사항 (채무): `tm`, `bdnmn`, `slmth`, `fta`, `slta`, `isprc`, `intr`, `isrr`, `rpd`, `print_pymint`, `mngt_cmp`, `cdrt_int`, currency (`dpcrn`, `dpcr_amt`, `usarn`, `usntn`, `wnexpl_at`), guarantee/collateral (`grt_*`, `icmg_*`), equity-linked (`estk_*`), DLB (`drcb_at`, `drcb_uast`, `drcb_optknd`, `drcb_mtd`)
- 일반사항 (합병/교환/분할): `stn`, `bddd`, `ctrd`, `gmtsck_shddstd`, `ap_gmtsck`, `aprskh_pd_bgd/edd`, `aprskh_prc`, `mgdt_etc`, `rt_vl`, `exevl_int`, `grtmn_etc`, `rpt_rcpn`
- 증권의종류 / 발행증권: `stksen`/`kndn`, `stkcnt`/`cnt`, `fv`, `slprc`, `slta`, `slmthn`
- 인수인정보: `actsen`, `actnmn`, `stksen`, `udtcnt`, `udtamt`, `udtprc`, `udtmth`
- 자금의사용목적: `se`, `amt`
- 매출인에관한사항: `hdr`, `rl_cmp`, `bfsl_hdstk`, `slstk`, `atsl_hdstk`
- 일반청약자환매청구권: `grtrs`, `exavivr`, `grtcnt`, `expd`, `exprc`
- 당사회사에관한사항: `cmpnm`, `sen`, `tast`, `cpt`, `isstk_knd`, `isstk_cnt`

---

## 9. Status / error codes

| Code | Meaning |
|---|---|
| `000` | 정상 |
| `010` | 등록되지 않은 키 |
| `011` | 사용할 수 없는 키 (temporarily suspended) |
| `012` | 접근할 수 없는 IP |
| `013` | 조회된 데이터 없음 |
| `014` | 파일이 존재하지 않음 |
| `020` | 요청 제한 초과 (typically >20,000/day) |
| `021` | 조회 가능 회사 개수 초과 (max 100) |
| `100` | 필드의 부적절한 값 |
| `101` | 부적절한 접근 |
| `800` | 시스템 점검 중 |
| `900` | 정의되지 않은 오류 |
| `901` | 개인정보 보유기간 만료 키 → opendart@fss.or.kr |

---

## 10. Documentation defects spotted (as of 2026-10-15)

1. **`bsns_year` type** listed as `STRING(1)` on 주식의 총수 현황 (should be `STRING(4)`, as on the other pages).
2. **`rcept_no` type** listed as `STRING(8)` on 재무제표 원본파일(XBRL) (it's a 14-digit 접수번호; `document.xml` correctly says `STRING(14)`).
3. **`total_count`** in 공시검색 is described as "총 페이지 수" — it's the total record count.
4. **Interest-rate labels** `bd_intr_ex`/`bd_intr_sf` are swapped on 상각형 조건부자본증권 vs. CB/BW/EB.
5. **직원 현황:** `rgllbr_co` / `rgllbr_abacpt_labrr_co` descriptions are copy-paste errors ("상근, 비상근" / "대표이사, 이사…"), and averages such as `avrg_cnwk_sdytrn` are given integer `9,999,999,999` formatting.
6. **Multi-company APIs** do not document the comma-separated `corp_code` format or the 100-company cap in the request table (cap is only implied by error `021`).
7. **Date formats are inconsistent** across APIs (`YYYYMMDD`, `YYYY-MM-DD`, `YYYY.MM.DD`), and `rcept_dt` differs between `majorstock` (YYYYMMDD) and `elestock` (YYYY-MM-DD).
8. **Schema versioning is inline only:** field validity windows (e.g., ≤2018-01-18, 2019-12-09+, 2020-07-06+) are buried in descriptions rather than versioned endpoints — except the 2026 V2 compensation APIs.
