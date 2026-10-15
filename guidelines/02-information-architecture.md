# 02 — Information Architecture

## Mental model

Users think in **companies** and **events in time**, not in API groups. The six OpenDART groups are an implementation detail. Map them onto a company-centric product:

| User question | Primary data | API group |
|---|---|---|
| "Who is this company?" | Profile, listing market, CEO, fiscal month | DS001 `company` |
| "What did they file recently?" | Filing feed | DS001 `list` |
| "How are they doing financially?" | Statements, key accounts, ratios | DS003 |
| "Who owns and runs it?" | Shareholders, executives, pay, employees | DS002 (governance), DS004 |
| "What corporate actions happened?" | Capital raises, buybacks, M&A, defaults | DS005 |
| "What securities are they issuing?" | Registration statements | DS006 |

## Recommended screen map

```
Home / Search
├── Market filing feed (date-ranged, max 3 months, filterable by disclosure type)
└── Company  (/company/:corp_code)
    ├── Overview        — profile + latest filings + headline financials
    ├── Filings         — full paginated filing history (searchAll)
    ├── Financials
    │   ├── Key accounts      (fnlttSinglAcnt)
    │   ├── Full statements   (fnlttSinglAcntAll: BS / IS / CIS / CF / SCE)
    │   └── Ratios            (fnlttSinglIndx, 2023 Q3+)
    ├── Shares & Capital — share count, treasury stock, dividends, capital changes, debt outstanding
    ├── Ownership       — largest shareholder (+ changes), 5% holders, minority holders, executive holdings
    ├── People & Pay    — executives, employees, compensation (incl. V2 nested data)
    ├── Audit           — auditor, opinion, audit/non-audit service contracts
    ├── Corporate Events — DS005, grouped by theme (see below)
    └── Offerings       — DS006 registration statements
Compare (/compare?corp=…)   — multi-company accounts & ratios (fnlttMultiAcnt / fnlttCmpnyIndx)
```

## Grouping DS005 (36 event endpoints)

Don't show 36 tabs. Group by the themes in guide §7:

1. **Distress & legal**: default, business suspension, rehabilitation, dissolution, creditor management, lawsuits
2. **Equity capital**: rights issues, bonus issues, combined issues, capital reduction
3. **Hybrid & debt issuance**: CB, BW, EB, contingent convertible bonds
4. **Treasury stock**: acquisition, disposal, trust contracts and their termination
5. **Asset & business transfers**: business, tangible assets, other companies' shares, equity-linked bonds
6. **M&A & restructuring**: merger, split, split-merger, share exchange
7. **Overseas listing**: listing and delisting decisions and events

Render the events as a **single unified timeline** (by `rcept_dt`), with a theme filter. Endpoints with no data for the period should collapse into a quiet "No events of these types" footnote. Don't list empty sections individually.

## Navigation context that must persist

- **Selected company** is always visible (sticky header: name, stock code, market badge).
- **Selected period** (year + report period) persists across the Financials, Shares, Ownership, People and Audit tabs, which all take the same `corp_code + bsns_year + reprt_code`. Changing it in one tab changes it everywhere.
- **Date range** persists across Events, Offerings and the Filings feed.
- Encode all of these in the URL so views are shareable and bookmarkable.

## Labels

- Use the Korean `title` from `ENDPOINTS` as the canonical label, with a short English gloss where the audience is mixed (e.g. "최대주주 현황 · Largest shareholder").
- Never show endpoint paths (`hyslrSttus`) or group codes (`DS002`) to end users. They may appear in a developer/debug panel only.
