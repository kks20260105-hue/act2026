/** API 에러 코드 상수 */
export const ErrorCode = {
  // Auth
  UNAUTHORIZED:        'UNAUTHORIZED',
  INVALID_TOKEN:       'INVALID_TOKEN',
  FORBIDDEN:           'FORBIDDEN',

  // Validation
  VALIDATION_ERROR:    'VALIDATION_ERROR',
  MISSING_FIELD:       'MISSING_FIELD',
  CONFIRM_REQUIRED:    'CONFIRM_REQUIRED',
  INVALID_FORMAT:      'INVALID_FORMAT',

  // Resource
  NOT_FOUND:           'NOT_FOUND',
  DUPLICATE:           'DUPLICATE',

  // DB / Server
  DB_ERROR:            'DB_ERROR',
  SERVER_ERROR:        'SERVER_ERROR',

  // Upload
  UPLOAD_PARSE_ERROR:  'UPLOAD_PARSE_ERROR',
  UPLOAD_LIMIT:        'UPLOAD_LIMIT',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/** 표준 에러 응답 생성 */
export function errorResponse(
  code: ErrorCodeType,
  message: string,
  details?: unknown
) {
  return { success: false, code, message, details: details ?? null };
}

/** 표준 성공 응답 생성 */
export function successResponse<T>(data: T, message = '성공') {
  return { success: true, message, data };
}
