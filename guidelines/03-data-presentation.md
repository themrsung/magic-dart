# 03 — Data Presentation

OpenDART returns almost everything as **strings**, in formats that vary between endpoints. The client deliberately keeps the raw strings. Presentation is where they get normalised, so the rules here are about correctness first and looks second.

## Numbers

**Parsing**
- Use `parseAmount` (→ `bigint`) for monetary amounts and share counts. Revenue and asset figures for large companies exceed 2⁵³, and `Number()` silently corrupts them.
- Use `parseNumber` (→ `number`) for ratios, percentages and small counts. It handles thousands separators, `(1,234)` negatives, trailing `%`, and treats `-` / empty as `null`.
- Some fields contain text where you would expect a number (e.g. `보통주`, `-`). These parse to `null`, so show the original text instead of a blank.

**Formatting**
- Right-align numeric columns and use tabular (monospaced) figures.
- Show KRW in **Korean large units** for scanning, with the exact value on hover or expand:
  - `1,234,567,000,000원` → **1조 2,345억원**
  - Thresholds: 조 = 10¹², 억 = 10⁸, 만 = 10⁴.
  - English mode: `₩1.23T`, `₩123.5B`, `₩12.3M`.
- **Never assume the unit.** Financial statement rows carry a `currency` field; respect it, and label non-KRW figures clearly. Other endpoints may report in 원, 천원 or 백만원 depending on the filing. If the unit is not machine-readable, show the value as reported and say "단위: 공시 원문 참조".
- Negatives: use a leading minus with a semantic colour, **and** a non-colour cue (minus sign, or parentheses in accounting tables). Never rely on red alone.
- Ratios from `fnlttSinglIndx` (`idx_val`) come as decimals or percentages depending on the indicator. Format them according to `idx_nm`, not blindly ×100.

## Periods: the most error-prone part

- Always display the period a figure covers, e.g. **"2024 사업보고서 · 연결 · 당기"**.
- `thstrm` / `frmtrm` / `bfefrmtrm` mean current / prior / two-years-prior period. Label the columns with the **actual fiscal years** (from `thstrm_nm` etc.), not with "당기 / 전기".
- **Quarterly income statements are a trap** (guide §5.2): for 반기 and 3분기 reports, `thstrm_amount` on IS/CIS is the **3-month** figure, and `thstrm_add_amount` is the **year-to-date cumulative** figure. Always label which one is shown ("3개월" vs "누적"). Default to cumulative when comparing against annual figures.
- Balance-sheet items are point-in-time ("as of 2024-12-31"); income and cash-flow items are durations ("FY2024"). Label them accordingly.
- `bsns_year` is the business year, not necessarily the calendar year. Show the company's fiscal year-end month (`acc_mt` from the company profile) when it isn't December.

## Dates

- Use `parseDate` for all date fields. It accepts `YYYYMMDD`, `YYYY-MM-DD` and `YYYY.MM.DD` (the API mixes all three) and returns ISO `YYYY-MM-DD`, or `null`.
- All DART dates are **KST calendar dates** with no time. Render them as dates only, and never convert them through the browser's timezone. A filing on 2024-03-01 is 2024-03-01 for every viewer.
- Display format: `2024.03.15` (Korean UI) / `15 Mar 2024` (English UI). Use relative time ("3일 전") only in feeds, with the absolute date on hover.

## Codes → human labels

Never show raw codes. Map them:

| Field | Codes | Display |
|---|---|---|
| `corp_cls` | Y / K / N / E | Badge: 유가증권(KOSPI) / 코스닥 / 코넥스 / 기타 |
| `reprt_code` | 11013 / 11012 / 11014 / 11011 | 1분기 / 반기 / 3분기 / 사업보고서 |
| `fs_div` | CFS / OFS | 연결 / 별도 |
| `sj_div` | BS / IS / CIS / CF / SCE | 재무상태표 / 손익계산서 / 포괄손익계산서 / 현금흐름표 / 자본변동표 |
| `pblntf_ty` | A–J | 정기공시 / 주요사항보고 / 발행공시 / 지분공시 / 기타공시 / 외부감사관련 / 펀드공시 / 자산유동화 / 거래소공시 / 공정위공시 |
| `rm` | Concatenated flag characters | Small chips via `parseRmFlags` (see below) |

**`rm` flags** on filings (guide §3.1): 유 (KOSPI), 코 (KOSDAQ), 채 (bond-listed), 넥 (KONEX), 공 (FTC), 연 (includes consolidated), **정 (corrected later)**, **철 (withdrawn)**. Make 정 and 철 **prominent**: a corrected or withdrawn filing must never look authoritative. Show a warning chip, and link to the latest version where possible.

**`report_nm` prefixes** such as `[기재정정]`, `[첨부정정]` and `[발행조건확정]` mark amended filings. Strip them from the title and render them as a status chip, so lists stay scannable.

## Missing, empty, and placeholder values

| Raw | Meaning | Display |
|---|---|---|
| `-`, empty string, whitespace | Not applicable / not reported | `—` in muted text |
| Field absent from the row | Not provided by this endpoint/version | Hide the column if it's absent for all rows; otherwise `—` |
| `0` | A real zero | `0`. Never collapse zero into "—". |

Schemas change over time (guide §4.3–4.4): some fields exist only for filings after certain dates (e.g. 2018-01-19, 2019-12-08). When a column is empty for older periods, add a footnote like "2019년 이전 공시에는 제공되지 않음" rather than leaving a mystery gap.

## Tables

- **Financial statements**: preserve the filing's account order (`ord`) and hierarchy. Indent sub-accounts, bold totals, and keep the account names in Korean (`account_nm`) with optional English. Do not re-sort alphabetically.
- Default sort for record lists: `rcept_dt` descending.
- Sticky first column (account or person name) and a sticky header on wide tables. DS002 governance tables can have 15+ columns, so allow column hiding with sensible defaults.
- Long tables (e.g. `elestock` with 3,000+ rows, `otrCprInvstmntSttus` with 100+) need virtualised scrolling, search and column filters.
- Every table footer shows: source report name, `rcept_no` linked to the viewer, and the as-of date.

## Personal data

Executive and shareholder tables contain names, birth year/month (`birth_ym`), careers and pay. This is public disclosure data, but:
- Don't make individuals the primary search entity, or build cross-company person profiles by default.
- Show `birth_ym` as given (year and month). Never infer or display age to the day.
