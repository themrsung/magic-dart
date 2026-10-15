# UI Design Guidelines — magic-dart

These guidelines are for a **frontend design agent** designing the user interface on top of the `magic-dart` OpenDART client. OpenDART is the open API of DART (금융감독원 전자공시), Korea's corporate disclosure system. The UI turns its raw, string-typed and inconsistently formatted disclosure data into screens that are trustworthy, readable and fast.

Read them in order. Each file is self-contained, but later files assume the vocabulary set up in earlier ones.

| File | Covers |
|---|---|
| [01-architecture-and-data-flow.md](01-architecture-and-data-flow.md) | Where the client runs, the API key, rate limits, caching, loading behaviour |
| [02-information-architecture.md](02-information-architecture.md) | Screens, navigation, how the six API groups map to the product |
| [03-data-presentation.md](03-data-presentation.md) | Numbers, currency, dates, codes, missing values, tables |
| [04-data-visualization.md](04-data-visualization.md) | Which chart to use for which dataset, and the traps |
| [05-states-and-errors.md](05-states-and-errors.md) | Empty, loading, partial and error states, mapped to OpenDART status codes |
| [06-localization-typography-accessibility.md](06-localization-typography-accessibility.md) | Korean/English, type, colour, accessibility |

## Source of truth

- `docs/opendart-api-guide.md` is the API reference. Section numbers in these guidelines (e.g. "guide §5.2") point there.
- `src/endpoints.ts` lists all 85 endpoints, with their group, Korean title, parameter shape and response shape. Generate navigation and labels from it rather than hard-coding them.
- `src/normalize.ts` holds the canonical parsers (`parseNumber`, `parseAmount`, `parseDate`, `parseRmFlags`, `viewerUrl`). The UI must use these, or equivalents with identical behaviour. It must not do its own `Number()` or `Date` parsing.

## Non-negotiables

1. **The API key never reaches the browser.** All OpenDART calls go through a server you control (see 01).
2. **Never show a number you did not parse safely.** Large KRW amounts exceed `Number.MAX_SAFE_INTEGER`, so parse them with `parseAmount` (bigint).
3. **"No data" is not an error.** Status `013` becomes `[]`. Show it as a calm empty state, not a red alert (see 05).
4. **Always state the basis of a financial figure:** reporting period, consolidated vs separate (`CFS`/`OFS`), currency and unit. A number without its basis is wrong by omission.
5. **Link back to the source.** Every disclosure-derived view offers "View original filing" through `viewerUrl(rcept_no)`.
6. **Korean is the primary data language.** Field values, report names and group titles come in Korean. Design for Korean text first; English is a translation layer.
