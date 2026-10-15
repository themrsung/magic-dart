# 04 — Data Visualization

Charts should make disclosure data *easier to verify*, not just prettier. Every chart answers one question, states its basis, and lets the user reach the underlying numbers.

## Universal chart rules

1. **Caption every chart with its basis**: company, period range, `CFS`/`OFS`, currency/unit, and source report(s).
2. **Parse with `parseAmount`, then scale down for plotting.** Convert bigint values to `number` in a display unit (억원 or 조원) *after* dividing, so precision loss can't happen silently. State the unit on the axis.
3. **Bars start at zero.** Line charts may use a non-zero baseline only for ratios, and must show it clearly.
4. **Missing periods are gaps, not zeros.** A period with no filing (status `013`, or no report yet) breaks the line. Never interpolate.
5. **Corrected data wins.** When a 정정 filing exists for a period, plot the corrected figures and mark the point (e.g. a hollow marker plus a tooltip "정정 공시 반영").
6. **Tooltips show the exact value** (full 원 amount with separators), the period label, and a link to the source filing.
7. **Provide a table toggle** for every chart. It is the accessible alternative and the user's audit path.
8. **Charts must stay legible in greyscale.** Use colour plus position, pattern or direct labels; avoid red/green-only encodings.

## Choosing a chart

| Data | Endpoint(s) | Recommended | Avoid |
|---|---|---|---|
| Revenue, operating income and net income over time | `fnlttSinglAcnt` across years/quarters | Grouped bars (annual) or line (quarterly, cumulative) | Stacked bars (the items aren't parts of a whole) |
| Quarterly performance | `fnlttSinglAcnt` per quarter | Bars of **3-month** values (derive Q4 = annual − Q3 cumulative, and label it "derived") | Mixing 3-month and cumulative values on one axis |
| Balance-sheet composition | `fnlttSinglAcntAll` (BS) | Two stacked columns, assets vs liabilities + equity, at the same scale | Pie charts |
| Cash flows | `fnlttSinglAcntAll` (CF) | Waterfall: opening cash → operating → investing → financing → closing | Plain line |
| Financial ratios | `fnlttSinglIndx`, `fnlttCmpnyIndx` | Small multiples, one per ratio, grouped by class (수익성/안정성/성장성/활동성) | One chart mixing ratios of different units |
| Peer comparison | `fnlttMultiAcnt`, `fnlttCmpnyIndx` | Horizontal bar ranking, with the focus company highlighted | Radar charts (they hide magnitude and distort with axis order) |
| Ownership structure | `hyslrSttus`, `mrhlSttus`, `majorstock` | Horizontal 100% bar: largest shareholder + related parties / 5% holders / minority / other | 3D or exploded pies. A single donut is acceptable for ≤5 segments. |
| Ownership changes over time | `hyslrChgSttus`, `majorstock` | Step line of stake % by `rcept_dt` (stakes change discretely) | Smoothed lines |
| Executive holdings | `elestock` | Sortable table with sparkline per person | A chart of thousands of rows |
| Dividends | `alotMatter` | Bars of DPS per year, with payout ratio as a separate small chart | Dual-axis charts |
| Debt maturity profile | `entrprsBilScritsNrdmpBlce`, `cprndNrdmpBlce`, etc. | Stacked bars across maturity buckets, in the order the API returns them | Re-ordering buckets alphabetically |
| Compensation | `hmvAuditAllSttus`, `indvdlByPay`, V2 endpoints | Bars per person/role; break out stock-based comp as a separate segment | Mixing headcount and amounts on one axis |
| Corporate events | DS005 | Timeline / swimlane by theme, markers sized by amount where an amount exists | Bar charts of event counts as the primary view |
| Filing activity | `list` / `searchAll` | Calendar heatmap or weekly bar of filing counts, coloured by `pblntf_ty` | — |

## Specific traps

- **Dual axes**: avoid them. If two measures must be compared, use two aligned small charts with a shared x-axis.
- **Q4 doesn't exist as a report.** Annual figures (`11011`) are full-year. Derive Q4 only when the 3분기 cumulative figure is available, and visually mark derived values.
- **Consolidated and separate** figures must never appear in the same series. If a company switches basis between years, break the series and annotate the switch.
- **Fiscal year-ends differ.** In peer comparisons, warn when companies have different `acc_mt`, because "2024" may cover different months.
- **Units across companies**: normalise to one unit before comparing, and state it once in the chart header.
- **Outliers and sign flips** (e.g. operating loss): diverging bars from zero, with the label on the bar. Do not clip.
- **Ratio availability**: the financial-index APIs only cover 2023 Q3 onward. Earlier years show as a shaded "no data" region labelled with that reason, not as an empty axis.

## Density and interaction

- Dashboard cards: one KPI number + delta vs prior period + a 5–8 point sparkline. The delta shows the direction with an arrow and a sign, not colour alone.
- Hovering a period on one chart highlights the same period on sibling charts (linked brushing) on the Financials tab.
- Clicking a data point opens the source filing context (report name, `rcept_no` link), not a deeper chart.
- Animate only on data change, under 300 ms, and respect `prefers-reduced-motion`.
