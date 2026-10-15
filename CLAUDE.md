# CLAUDE.md

Typed, rate-limited Node client for the OpenDART (금융감독원 전자공시) API. TypeScript with no runtime dependencies. Node ≥22.18 runs the `.ts` files directly, so there is no build step.

## Commands

- `pnpm install` installs the dev deps (`typescript`, `@types/node` only)
- `pnpm typecheck` runs `tsc --noEmit`
- `pnpm test` runs the offline unit tests (`node --test`). They mock `fetch` and make no network calls.
- Run a single test file: `node --test test/units.test.ts`
- `pnpm smoke` runs the live test. It calls every endpoint once against the real API. It needs `OPENDART_API_KEY` in `.env` (gitignored; see `.env.example`). The key is IP-locked: calls from an unregistered IP fail with status `012`.

## Architecture

- `guidelines/` holds the UI design guidelines for a frontend agent building on this client (data presentation, charts, error states, i18n). Start at `guidelines/README.md`.
- `docs/opendart-api-guide.md` is the API reference this client implements (a structured summary of the official OpenDART developer guide at opendart.fss.or.kr). Section numbers (e.g. "docs §3.2") in code comments point here.
- `src/endpoints.ts` holds the `ENDPOINTS` registry: all 85 APIs with group, path, `params` shape, `response` shape (`list` / `object` / `group` / `paged` / `zip`) and file extension. **To add an API, add a registry entry.** It is then exposed automatically as `client.api.<name>`.
- `src/params.ts` maps each param shape to its request type. `buildQuery` validates parameters before any request is sent and throws `OpenDartValidationError`. It checks corp_code length, `bsns_year ≥ 2015`, reprt/idx/sj_div codes, date ranges and the 100-corp cap.
- `src/client.ts` contains `OpenDartClient`: request sending, retries (HTTP 5xx/429 and status `800`), envelope unwrapping, `013` → `[]` (controlled by `noDataAsEmpty`), the `searchAll` paginator, the `*Chunked` multi-company helpers, and the `corpCodes()` / `document()` / `fnlttXbrl()` ZIP endpoints.
- `src/rate-limiter.ts` enforces requests per second (default 10) and an optional total `maxRequests` budget (`RequestBudgetExceededError`).
- `src/zip.ts` is a minimal ZIP reader built on `node:zlib`. `src/normalize.ts` parses amounts (`parseAmount` returns a bigint), the three date formats, KST dates and `rm` flags.
- `src/types.ts` has the response row types. `src/errors.ts` has the status codes (docs §9) and the error classes.

## Gotchas

- Dates are sent as `YYYYMMDD`. A `Date` object is converted in KST.
- Responses keep raw strings. Normalise them with the helpers in `normalize.ts`; never `Number()` large amounts.
- DS006 and the 2026 V2 compensation APIs return grouped responses (`{title, list}[]`).
- File endpoints return XML/ZIP. Their errors come back as an XML `<result><status>` body, which the client parses.
- Inject `fetch`, `sleep` and `now` in tests. Never hit the live API from `test/`.
