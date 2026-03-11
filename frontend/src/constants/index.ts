// ============================================================
// 상수 정의 (UPPER_SNAKE_CASE)
// ============================================================

/** API 엔드포인트 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  USER: {
    PROFILE: '/users/profile',
    LIST: '/users',
  },
} as const;

/** 로컬 스토리지 키 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'portal_access_token',
  USER: 'portal_user',
} as const;

/** 라우트 경로 */
export const ROUTE_PATHS = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ROOT: '/',
} as const;

/** 유효성 검사 규칙 */
export const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 100,
  USERNAME_MIN_LENGTH: 2,
  USERNAME_MAX_LENGTH: 50,
} as const;

/** 에러 메시지 */
export const ERROR_MESSAGES = {
  REQUIRED: '필수 입력 항목입니다.',
  INVALID_EMAIL: '올바른 이메일 형식을 입력하세요.',
  PASSWORD_TOO_SHORT: `비밀번호는 ${6}자 이상이어야 합니다.`,
  LOGIN_FAILED: '이메일 또는 비밀번호가 올바르지 않습니다.',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
} as const;
