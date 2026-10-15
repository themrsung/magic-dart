# 01 — Architecture & Data Flow

Design decisions about loading, refreshing and interactivity are constrained by how OpenDART works. Read this before designing any screen that fetches data.

## Where the client runs

- `OpenDartClient` is a **server-side** Node library. The OpenDART key (`crtfc_key`) is a 40-character secret, and it only works from a **registered IP address**. Requests from anywhere else fail with status `012`.
- The browser therefore talks to **your backend** (a BFF or API routes), which calls `magic-dart`. Do not design any flow that would need the key in client code, URLs, local storage or logs.
- The UI should never show the raw key, and never let the user paste one into a browser form. Key management happens in server configuration.

## Rate limits shape the UX

| Limit | Value | UX consequence |
|---|---|---|
| Throughput | Client default 10 req/s | Fan-out views (e.g. "all 36 event types for a company") take seconds. Stream results in progressively. |
| Daily quota | ~20,000 requests/day per key (status `020`) | Shared across all users of the deployment. Cache aggressively; avoid "refresh everything" buttons. |
| Multi-company | Max 100 corp codes per call (status `021`) | Comparison views cap selection or batch silently through `*Chunked` helpers. |
| Search window | Max 3 months when no `corp_code` is given | Market-wide filing feeds need a date-range control limited to 3 months. Explain the limit inline; don't just disable the control. |

**Design rules**

- Prefer **on-demand loading per section** over eagerly loading every endpoint for a company. A company page should load the overview first and fetch tabs when opened.
- Large fan-outs (DS005's 36 event endpoints, DS006's 6 grouped endpoints) should render **one row per endpoint as it resolves**, with a per-row spinner. Never show a single blocking spinner for 30+ calls.
- Show cache freshness ("Updated 3 h ago") on data that is cached. Disclosures change rarely after filing, but new filings arrive daily.

## Suggested caching tiers (inform the UI, implemented server-side)

| Data | Change frequency | Suggested TTL |
|---|---|---|
| `corpCodes()` (all companies, ~3.6 MB ZIP) | Daily | 24 h. Load once on the server and power autocomplete from it. |
| Company profile (`company`) | Rare | 24 h |
| Filing search (`list`) | Continuous during business hours (KST) | 5–15 min |
| Periodic report data (DS002/DS003) for a past period | Effectively immutable, unless corrected (정정) | Long. Invalidate when a correction filing appears. |
| Original documents / XBRL ZIPs | Immutable per `rcept_no` | Indefinite |

## Downloads

- `document`, `fnlttXbrl` and `corpCode` return binary ZIPs that can be several MB. Present them as **explicit downloads** with file size, never auto-download.
- Prefer linking to the DART web viewer (`viewerUrl`) for reading a filing. Offer the ZIP as a secondary action for power users.

## Parameters the UI must collect

Most screens are driven by a few inputs. Design consistent, reusable controls for them:

| Input | Values | Control |
|---|---|---|
| Company (`corp_code`, 8 digits) | From `corpCodes()` | Autocomplete on Korean name, English name and 6-digit stock code. Never ask users for the 8-digit corp code. |
| Business year (`bsns_year`) | ≥ 2015 | Year picker. Disable years before 2015 and explain why. |
| Report period (`reprt_code`) | `11013` Q1 · `11012` H1 · `11014` Q3 · `11011` Annual | Segmented control labelled 1분기 / 반기 / 3분기 / 사업보고서. Never expose the numeric codes. |
| Statement basis (`fs_div`) | `CFS` 연결 · `OFS` 별도 | Toggle. Default to `CFS`, and fall back to `OFS` with a visible note when CFS is empty. |
| Date range (`bgn_de`/`end_de`) | YYYYMMDD, KST | Range picker with presets (last 7 days / 1 month / 3 months). |
| Financial index class (`idx_cl_code`) | M210000 수익성 · M220000 안정성 · M230000 성장성 · M240000 활동성 | Tabs. Only available from 2023 Q3 onward. |

Validate in the UI with the same rules the client enforces (`src/params.ts`), so users see constraints *before* submitting rather than as server errors.
