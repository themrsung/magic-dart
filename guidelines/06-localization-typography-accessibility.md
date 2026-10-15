# 06 — Localization, Typography & Accessibility

## Language

- **Korean first.** Data values (account names, report names, group titles, executive roles, remarks) arrive in Korean and must be displayed faithfully. Never machine-translate field values in place.
- UI chrome (navigation, buttons, labels) is localisable. Ship `ko` as the default and `en` as a full translation.
- In English mode, show the Korean original alongside translated labels for domain terms, e.g. "Largest shareholder (최대주주)". Investors cross-reference the Korean filing, so they need the original term.
- Company names: show `corp_name` (Korean) as primary; show `corp_name_eng` as secondary when available. It is often empty or oddly cased (e.g. `SAMSUNG ELECTRONICS CO,.LTD`), so don't "fix" it.
- Use `ko-KR` / `en-US` `Intl` formatters for numbers, with the custom 조/억 formatting from 03.

## Typography

- Use a font family with complete Hangul coverage and good Latin/numeral pairing (e.g. Pretendard, Noto Sans KR, or SUIT). Avoid fallback mixing within one line.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) in every table, KPI and axis.
- Korean text needs slightly more line-height (≈1.6 for body) and must not use `word-break: break-all`. Use `word-break: keep-all` so Korean words aren't split mid-word.
- Long Korean account names (e.g. "지배기업 소유주지분 귀속 당기순이익") wrap within table cells; truncate only with a full-text tooltip.
- Hierarchy: company name > section > table caption > data. Numbers are never smaller than their labels in KPI cards.

## Colour

- Gains and losses use semantic tokens (`--positive`, `--negative`), configurable per market convention. **Korean markets conventionally use red for up and blue for down.** Make the mapping a user/locale setting, and never encode meaning in hue alone.
- Market badges (KOSPI / KOSDAQ / KONEX) get distinct but low-saturation colours that don't collide with gain/loss colours.
- Warning chips (정정, 철회) use a dedicated caution colour plus an icon.
- Ensure WCAG 2.2 AA contrast (4.5:1 text, 3:1 chart elements and UI components) in light and dark themes.

## Accessibility

- Every chart has a text alternative: a concise summary (trend, min and max, latest value) plus the table toggle from 04.
- Tables use real `<table>` semantics with `<th scope>` headers. Hierarchical financial rows expose their level (`aria-level`, or indentation plus a visually hidden parent label).
- Status chips and `rm` flags have accessible names ("정정 공시 있음", not "정").
- Keyboard: the company autocomplete, the period selectors and the table column controls are fully operable without a mouse. Focus is visible.
- Progress for fan-out loading is announced politely (`aria-live="polite"`), and throttled so screen readers aren't flooded.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Amount abbreviations (1조 2,345억) have the full value available to assistive technology (`aria-label` or visually hidden text).

## Responsive behaviour

- **Desktop** is the primary target for financial tables. On narrow screens, collapse wide tables to a key-column view with a "show all columns" sheet, rather than horizontal-scrolling everything.
- KPI cards and the filing feed are mobile-first.
- Charts reflow to small multiples stacked vertically. Never shrink axis labels below legibility (≈11 px).
