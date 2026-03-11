import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, LoginRequest, UserInfo } from '@/types';
import { authService } from '@/services/authService';
import { STORAGE_KEYS } from '@/constants';

// ─────────────────────────────────────────────────────────────
// 초기 상태: 로컬 스토리지에서 토큰 복원
// ─────────────────────────────────────────────────────────────
const storedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

const initialState: AuthState = {
  isAuthenticated: !!storedToken,
  user: storedUser ? (JSON.parse(storedUser) as UserInfo) : null,
  accessToken: storedToken,
  isLoading: false,
  error: null,
};

// ─────────────────────────────────────────────────────────────
// Async Thunks
// ─────────────────────────────────────────────────────────────

/** 로그인 */
export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '로그인에 실패했습니다.';
      return rejectWithValue(msg);
    }
  }
);

/** 로그아웃 */
export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
});

// ─────────────────────────────────────────────────────────────
// Auth Slice
// ─────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<UserInfo>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    // 로그인 처리
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, action.payload.accessToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(action.payload.user));
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // 로그아웃 처리
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
