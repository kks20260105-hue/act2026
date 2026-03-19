/**
 * OAuthCallbackPage.tsx
 * 소셜 로그인(네이버/카카오/Google) 콜백 처리 페이지
 * URL: /oauth/callback?token=xxx&provider=naver|kakao|google
 */
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Spin, Typography } from 'antd';
import { useAuthStore } from '../stores/authStore';

const { Text } = Typography;

const OAuthCallbackPage: React.FC = () => {
  const navigate          = useNavigate();
  const { message }       = App.useApp();
  const [searchParams]    = useSearchParams();
  const setUser           = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const token    = searchParams.get('token');
    const error    = searchParams.get('error');
    const provider = searchParams.get('provider') ?? '소셜';

    if (error) {
      message.error(`${provider} 로그인에 실패했습니다: ${error}`);
      navigate('/login', { replace: true });
      return;
    }

    if (!token) {
      message.error('인증 토큰이 없습니다. 다시 시도해주세요.');
      navigate('/login', { replace: true });
      return;
    }

    // JWT 디코딩으로 user 정보 파싱 (payload 추출)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      // ✅ portal_access_token에도 저장 (authService.logout에서 읽음)
      localStorage.setItem('portal_access_token', token);

      setUser(
        {
          id:       payload.id   ?? payload.sub,
          email:    payload.email ?? '',
          nickname: payload.name  ?? payload.nickname ?? '',
        },
        token,
        payload.roles ?? [],
      );

      message.success(`${provider} 계정으로 로그인되었습니다!`);
      navigate('/', { replace: true });
    } catch {
      message.error('토큰 파싱 오류입니다. 다시 시도해주세요.');
      navigate('/login', { replace: true });
    }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', gap: 16,
    }}>
      <Spin size="large" />
      <Text style={{ fontSize: 13, color: '#666' }}>소셜 로그인 처리 중...</Text>
    </div>
  );
};

export default OAuthCallbackPage;
