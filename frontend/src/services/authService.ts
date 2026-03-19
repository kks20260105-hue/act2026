import axios from 'axios';
import type { LoginRequest, LoginResponse } from '@/types';
import { ERROR_MESSAGES, STORAGE_KEYS } from '@/constants';

// 환경별 API Base URL
// - 로컬 개발: '' → Vite proxy (/api → http://localhost:4000)
// - Vercel 배포: 'https://act2026.vercel.app'
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL ?? '';
const API_BASE = `${API_ORIGIN}/api/auth`;

// ─────────────────────────────────────────────────────────────
// Auth Service: 백엔드 API 연동 (public.users + uf_login)
// ─────────────────────────────────────────────────────────────
export const authService = {
  /**
   * 로그인 처리 (백엔드 POST /api/auth/login → public.users 검증)
   */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    console.group('[AuthService] 로그인 시도');
    console.log('📧 입력 이메일:', credentials.email);
    console.log('🔑 패스워드 길이:', credentials.password?.length ?? 0, '자');
    console.log('⏳ [STEP 1] 백엔드 /api/auth/login 호출 중...');

    const response = await axios.post<{ success: boolean; data: LoginResponse; message?: string }>(
      `${API_BASE}/login`,
      {
        email: credentials.email.trim(),
        password: credentials.password,
      }
    );

    const { success, data, message } = response.data;

    if (!success || !data) {
      console.error('❌ [STEP 1 실패]', message);
      console.groupEnd();
      throw new Error(message || ERROR_MESSAGES.LOGIN_FAILED);
    }

    console.log('✅ [STEP 1 성공] public.users 인증 완료 (uf_login)');
    console.log('   - user.id:', data.user?.id);
    console.log('   - user.email:', data.user?.email);
    console.log('   - user.username:', data.user?.username);
    console.log('   - user.displayName:', data.user?.displayName);
    console.log('🎉 [로그인 완료] 최종 응답:', data.user);
    console.groupEnd();

    return data;
  },

  /**
   * 로그아웃 처리
   * 1. 백엔드에 POST /api/auth/logout → 소셜 access_token 폐기
   * 2. localStorage 완전 초기화 (토큰, 유저, Zustand persist)
   */
  logout: async (): Promise<void> => {
    // portal_access_token (일반로그인) 또는 auth-store (OAuth로그인) 에서 토큰 읽기
    let token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

    // 폴백: Zustand auth-store에서 추출
    if (!token) {
      try {
        const raw = localStorage.getItem('auth-store');
        if (raw) {
          const parsed = JSON.parse(raw);
          token = parsed?.state?.accessToken ?? null;
        }
      } catch (_) { /* 무시 */ }
    }

    try {
      if (token) {
        await axios.post(
          `${API_BASE}/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        console.warn('[AuthService] 로그아웃: 토큰 없음 → 백엔드 토큰 폐기 생략');
      }
    } catch (err) {
      console.warn('[AuthService] 로그아웃 API 오류 (무시):', err);
    } finally {
      // 토큰·유저 정보 완전 삭제
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      // Zustand persist 스토어 초기화 (auth-store)
      localStorage.removeItem('auth-store');
      sessionStorage.clear();
    }
  },

  /**
   * 현재 세션 조회 (localStorage 토큰 기반)
   */
  getCurrentSession: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },
};
