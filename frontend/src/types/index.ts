// ============================================================
// 공통 타입 정의 (PascalCase)
// ============================================================

/** 사용자 정보 타입 */
export interface UserInfo {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 로그인 요청 타입 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 로그인 응답 타입 */
export interface LoginResponse {
  accessToken: string;
  user: UserInfo;
}

/** API 응답 공통 타입 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** API 에러 타입 */
export interface ApiError {
  code: string;
  message: string;
  status: number;
}

/** 인증 상태 타입 */
export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
}
