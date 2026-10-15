# 05 — States & Errors

OpenDART reports outcomes through a `status` code (guide §9), surfaced by the client as typed errors. Design a distinct, honest state for each class. Don't funnel them all into a generic "Something went wrong".

## Client error types → UI states

| Source | Meaning | UI treatment |
|---|---|---|
| Status `013` (client returns `[]`) | Query worked; nothing to report | **Empty state**: neutral tone, explains why (e.g. "이 기간에 해당 공시가 없습니다"), and suggests a different period or report type. Never styled as an error. |
| `OpenDartValidationError` | Bad input, caught before sending | **Inline field error** next to the offending control. Prevent it by validating in the UI first (01). |
| Status `100`, `101` | Invalid field value / inappropriate request | Inline field error, if the field can be identified; otherwise a form-level message. |
| Status `014` | File does not exist (document / XBRL) | Disable the download button with the reason "원본 파일이 제공되지 않습니다". |
| Status `020` | Daily request limit exceeded | **Degraded mode banner**: "오늘 조회 한도에 도달했습니다", showing cached data with its timestamps. Disable fetching actions until reset (midnight KST). |
| `RequestBudgetExceededError` | Server-side safety budget reached | Same as `020`, worded as a service limit. |
| Status `021` | Too many companies (>100) | Limit selection in the compare UI to 100, with a counter ("87 / 100"). |
| Status `800` | System maintenance | Banner: "DART 시스템 점검 중". The client already retries; show this only after retries fail. |
| `OpenDartHttpError`, status `900` | Network or unknown server failure | Retryable error state with a **Retry** button. Keep previously loaded data visible. |
| Status `010`, `011`, `012`, `901` | Key unregistered, suspended, IP not allowed, or expired | **Operator problem, not the user's.** End users see "서비스를 일시적으로 이용할 수 없습니다". The detailed status goes to server logs and an admin view only. Never tell end users about keys or IPs. |

`OpenDartError` exposes `isNoData`, `isAuthError` and `status`. Branch on these rather than parsing messages.

## Loading

- Use skeletons that match the final layout (table rows, chart frames). Avoid full-page spinners.
- For fan-out views (01), show per-section progress: "36개 중 12개 조회 완료". Completed sections are interactive immediately.
- Stagger expectations: at 10 req/s, a full DS005 sweep takes ~4 s, and a 250-company comparison takes 3 chunked calls. Show determinate progress whenever the total is known.
- Never block navigation while a background fetch runs.

## Partial results

Fan-out views often end with some sections succeeded, some empty and a few failed. Present this explicitly:

- Succeeded sections render normally.
- Empty (`013`) sections collapse into one summary line ("12개 유형: 해당 기간 공시 없음").
- Failed sections show inline retry controls, without blocking the rest.
- A summary chip at the top: "34 loaded · 2 failed".

## Stale and corrected data

- Cached data shows "기준: 2024.10.15 09:00" (KST).
- If a newer correction filing (정정) exists for displayed data, show a non-dismissable notice, "정정 공시가 있습니다", linking to it.
- Withdrawn filings (`rm` contains 철) show struck-through or greyed out, with a "철회됨" chip, and are excluded from charts by default.

## Empty-state copy principles

- Say **what** is empty and **for which scope** ("삼성전자 · 2024 반기 · 배당 정보 없음").
- Offer a next action (change period, view all filings, view original).
- Distinguish "not applicable" (e.g. the company has no bonds outstanding) from "not yet filed" (the report period hasn't closed). Use the report deadline logic where possible: a 2026 사업보고서 cannot exist before the following spring.
