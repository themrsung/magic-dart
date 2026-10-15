/** OpenDART result codes (docs §9). */
export const STATUS_MESSAGES = {
  '000': '정상',
  '010': '등록되지 않은 키',
  '011': '사용할 수 없는 키',
  '012': '접근할 수 없는 IP',
  '013': '조회된 데이터 없음',
  '014': '파일이 존재하지 않음',
  '020': '요청 제한 초과',
  '021': '조회 가능 회사 개수 초과 (max 100)',
  '100': '필드의 부적절한 값',
  '101': '부적절한 접근',
  '800': '시스템 점검 중',
  '900': '정의되지 않은 오류',
  '901': '개인정보 보유기간 만료 키',
} as const;

export type StatusCode = keyof typeof STATUS_MESSAGES;

/** Codes worth retrying after a delay. */
export const RETRYABLE_STATUSES: ReadonlySet<string> = new Set(['800', '900']);

/** Error returned by the API itself (non-000 `status`). */
export class OpenDartError extends Error {
  readonly status: string;
  readonly endpoint: string;
  readonly apiMessage: string;

  constructor(status: string, apiMessage: string, endpoint: string) {
    const known = (STATUS_MESSAGES as Record<string, string>)[status];
    super(`OpenDART ${endpoint}: [${status}] ${apiMessage || known || 'unknown status'}`);
    this.name = 'OpenDartError';
    this.status = status;
    this.endpoint = endpoint;
    this.apiMessage = apiMessage;
  }

  get isNoData(): boolean { return this.status === '013'; }
  get isAuthError(): boolean { return ['010', '011', '012', '901'].includes(this.status); }
  get isRateLimited(): boolean { return this.status === '020'; }
  get isRetryable(): boolean { return RETRYABLE_STATUSES.has(this.status); }
}

/** Client-side validation failure; thrown before any request is sent. */
export class OpenDartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenDartValidationError';
  }
}

/** Client refused to send because the configured request budget is exhausted. */
export class RequestBudgetExceededError extends Error {
  constructor(limit: number) {
    super(`Request budget of ${limit} exhausted`);
    this.name = 'RequestBudgetExceededError';
  }
}

/** Transport-level failure (non-2xx HTTP, network error, unparseable body). */
export class OpenDartHttpError extends Error {
  readonly httpStatus: number | undefined;
  constructor(message: string, httpStatus?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OpenDartHttpError';
    this.httpStatus = httpStatus;
  }
}
