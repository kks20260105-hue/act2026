import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, App, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

interface LoginFormValues {
  email:    string;
  password: string;
}

// ── 소셜 로그인 버튼 베이스 ─────────────────────────────────
const socialBtnBase: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 7,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  transition: 'filter 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit',
};

const NaverIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" fill="#ffffff" />
  </svg>
);
const KakaoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 3C6.477 3 2 6.69 2 11.25c0 2.9 1.774 5.453 4.455 6.974l-1.133 4.214a.25.25 0 00.375.277L11.1 19.6A11.59 11.59 0 0012 19.5c5.523 0 10-3.69 10-8.25S17.523 3 12 3z" fill="#3C1E1E" />
  </svg>
);
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const socialButtons = [
  { key: 'naver',  label: '네이버로 로그인',  bg: '#03C75A', color: '#ffffff', border: 'none',              icon: <NaverIcon /> },
  { key: 'kakao',  label: '카카오로 로그인',  bg: '#FEE500', color: '#3C1E1E', border: 'none',              icon: <KakaoIcon /> },
  { key: 'google', label: 'Google로 로그인', bg: '#ffffff', color: '#3c4043', border: '1.5px solid #dadce0', icon: <GoogleIcon /> },
];

const LoginPage: React.FC = () => {
  const navigate    = useNavigate();
  const { message } = App.useApp();
  const isLoggedIn  = useAuthStore((s) => !!s.user && !!s.accessToken);
  const setUser     = useAuthStore((s) => s.setUser);
  const [form]      = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true });
  }, [isLoggedIn, navigate]);

  const handleLogin = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: values.email, password: values.password }),
      });

      const text = await res.text();
      if (!text) throw new Error('서버 응답이 없습니다. 잠시 후 다시 시도해 주세요.');
      let json: any;
      try { json = JSON.parse(text); }
      catch { throw new Error('서버 응답 형식 오류입니다.'); }

      if (!res.ok) throw new Error(json.message ?? '로그인에 실패했습니다.');
      const { user, accessToken } = json.data ?? json;

      console.group('[Login] 로그인 응답');
      console.log('✅ HTTP Status:', res.status);
      console.log('👤 user:', user);
      console.log('🎫 accessToken:', accessToken ? accessToken.substring(0, 30) + '...' : 'NONE');
      console.groupEnd();

      setUser(
        { id: user.id, email: user.email, nickname: user.username ?? user.nickname ?? '' },
        accessToken,
        user.roles ?? [],
      );
      message.success('로그인 성공!');
      navigate('/', { replace: true });
    } catch (err: any) {
      message.error(err.message ?? '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 소셜 로그인 클릭 → 백엔드 OAuth 시작 URL로 이동
  const handleSocialLogin = (key: string) => {
    window.location.href = `/api/auth/${key}`;
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f0f0',
    }}>
      <Card
        style={{ width: 400, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', borderRadius: 10, border: '1px solid #d8d8d8' }}
        bordered={false}
        bodyStyle={{ padding: '30px 32px 24px' }}
      >
        {/* ── 타이틀 ── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0, color: '#1a1a1a' }}>Portal Service</Title>
          <Text style={{ fontSize: 12, color: '#6a6a6a' }}>서비스를 이용하시려면 로그인하세요.</Text>
        </div>

        {/* ── 이메일/비밀번호 폼 ── */}
        <Form form={form} layout="vertical" onFinish={handleLogin} autoComplete="off" size="middle">
          <Form.Item
            name="email"
            style={{ marginBottom: 10 }}
            rules={[
              { required: true, message: '이메일을 입력하세요.' },
              { type: 'email', message: '올바른 이메일 형식을 입력하세요.' },
            ]}
          >
            <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="이메일" autoComplete="email" style={{ fontSize: 13, borderRadius: 7 }} />
          </Form.Item>
          <Form.Item
            name="password"
            style={{ marginBottom: 14 }}
            rules={[{ required: true, message: '비밀번호를 입력하세요.' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#bbb' }} />} placeholder="비밀번호" autoComplete="current-password" style={{ fontSize: 13, borderRadius: 7 }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary" htmlType="submit" block loading={loading}
              style={{ height: 42, fontSize: 14, fontWeight: 700, backgroundColor: '#222', borderColor: '#222', borderRadius: 7 }}
            >
              로그인
            </Button>
          </Form.Item>
        </Form>

        {/* ── 소셜 로그인 ── */}
        <Divider style={{ margin: '18px 0 12px' }}>
          <span style={{ fontSize: 11, color: '#aaa' }}>소셜 계정으로 로그인</span>
        </Divider>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {socialButtons.map((btn) => (
            <button
              key={btn.key}
              style={{ ...socialBtnBase, background: btn.bg, color: btn.color, border: btn.border }}
              onClick={() => handleSocialLogin(btn.key)}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(0.94)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* ── 회원가입 푸터 ── */}
        <div style={{
          marginTop: 20, paddingTop: 16,
          borderTop: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <Text style={{ fontSize: 12, color: '#999' }}>처음 이용하시나요?</Text>
          <button
            onClick={() => navigate('/register/social')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: '#555',
              textDecoration: 'underline', textUnderlineOffset: 2, padding: 0,
            }}
          >
            회원가입
          </button>
        </div>

        {/* ── 하단 카피라이트 ── */}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Text style={{ fontSize: 11, color: '#ccc' }}>© 2026 Portal Service. All rights reserved.</Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
