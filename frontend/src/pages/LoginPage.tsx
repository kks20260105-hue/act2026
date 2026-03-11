import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { Toast } from 'primereact/toast';
import { Checkbox } from 'primereact/checkbox';
import { classNames } from 'primereact/utils';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { loginThunk, clearError } from '@/redux/slices/authSlice';
import type { LoginRequest } from '@/types';
import { VALIDATION_RULES, ERROR_MESSAGES, ROUTE_PATHS } from '@/constants';
import styles from './LoginPage.module.css';

// ─────────────────────────────────────────────────────────────
// 폼 유효성 검사 에러 타입
// ─────────────────────────────────────────────────────────────
interface FormErrors {
  email?: string;
  password?: string;
}

// ─────────────────────────────────────────────────────────────
// LoginPage 컴포넌트
// ─────────────────────────────────────────────────────────────
const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated } = useAppSelector((state) => state.auth);
  const toastRef = useRef<Toast>(null);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState<boolean>(false);

  // 이미 로그인된 경우 → 메인(/)으로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTE_PATHS.ROOT, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Redux 에러 메시지 Toast로 표시
  useEffect(() => {
    if (error) {
      toastRef.current?.show({
        severity: 'error',
        summary: '로그인 실패',
        detail: error,
        life: 4000,
      });
      dispatch(clearError());
    }
  }, [error, dispatch]);

  // ─────────────────────────────────────────────
  // 유효성 검사
  // ─────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!email.trim()) {
      errors.email = ERROR_MESSAGES.REQUIRED;
    } else if (!VALIDATION_RULES.EMAIL_REGEX.test(email)) {
      errors.email = ERROR_MESSAGES.INVALID_EMAIL;
    }

    // TODO: 비밀번호 유효성 검사 (임시 비활성화)
    // if (!password.trim()) {
    //   errors.password = ERROR_MESSAGES.REQUIRED;
    // } else if (password.length < VALIDATION_RULES.PASSWORD_MIN_LENGTH) {
    //   errors.password = ERROR_MESSAGES.PASSWORD_TOO_SHORT;
    // }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─────────────────────────────────────────────
  // 로그인 제출 핸들러
  // ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);

    if (!validateForm()) return;

    const credentials: LoginRequest = { email: email.trim(), password };
    await dispatch(loginThunk(credentials));
  };

  // ─────────────────────────────────────────────
  // 입력 변경 핸들러
  // ─────────────────────────────────────────────
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (submitted && formErrors.email) {
      setFormErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (submitted && formErrors.password) {
      setFormErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  // ─────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────
  return (
    <div className={styles.loginWrapper}>
      <Toast ref={toastRef} position="top-center" />

      {/* 로그인 카드 */}
      <Card className={styles.loginCard}>
        {/* 로고 / 타이틀 영역 */}
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>
            <i className="pi pi-th-large" style={{ fontSize: '28px', color: '#888888' }} />
          </div>
          <h1 className={styles.siteTitle}>Portal Service</h1>
          <p className={styles.siteSubtitle}>서비스를 이용하시려면 로그인하세요.</p>
        </div>

        <Divider className={styles.divider} />

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} noValidate>
          {/* 이메일 입력 */}
          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>
              이메일 <span className={styles.required}>*</span>
            </label>
            <InputText
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="example@email.com"
              className={classNames(styles.inputField, {
                'p-invalid': submitted && formErrors.email,
              })}
              autoComplete="email"
              disabled={isLoading}
              maxLength={100}
            />
            {submitted && formErrors.email && (
              <small className={styles.errorMsg}>{formErrors.email}</small>
            )}
          </div>

          {/* 비밀번호 입력 */}
          <div className={styles.fieldGroup}>
            <label htmlFor="password" className={styles.label}>
              비밀번호 {/* <span className={styles.required}>*</span> 임시 비필수 */}
            </label>
            <Password
              id="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="비밀번호를 입력하세요"
              className={classNames(styles.passwordField, {
                'p-invalid': submitted && formErrors.password,
              })}
              inputClassName={styles.inputField}
              feedback={false}
              toggleMask
              autoComplete="current-password"
              disabled={isLoading}
            />
            {submitted && formErrors.password && (
              <small className={styles.errorMsg}>{formErrors.password}</small>
            )}
          </div>

          {/* 로그인 유지 / 비밀번호 찾기 */}
          <div className={styles.optionRow}>
            <div className={styles.checkboxGroup}>
              <Checkbox
                inputId="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.checked ?? false)}
                disabled={isLoading}
              />
              <label htmlFor="rememberMe" className={styles.checkboxLabel}>
                로그인 유지
              </label>
            </div>
            <button type="button" className={styles.linkButton} disabled={isLoading}>
              비밀번호 찾기
            </button>
          </div>

          {/* 로그인 버튼 */}
          <Button
            type="submit"
            label={isLoading ? '로그인 중...' : '로그인'}
            icon={isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'}
            className={styles.submitBtn}
            disabled={isLoading}
            loading={isLoading}
          />
        </form>

        <Divider className={styles.divider} />

        {/* 하단 안내 */}
        <p className={styles.footerText}>
          계정이 없으신가요?
          <button type="button" className={styles.linkButton} style={{ marginLeft: '6px' }}>
            회원가입
          </button>
        </p>
      </Card>

      {/* 카피라이트 */}
      <p className={styles.copyright}>
        © 2026 Portal Service. All rights reserved.
      </p>
    </div>
  );
};

export default LoginPage;
