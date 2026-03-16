import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

interface LoginFormValues {
  email:    string;
  password: string;
}

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

      // 빈 응답·비-JSON 방어
      const text = await res.text();
      if (!text) throw new Error('서버 응답이 없습니다. 잠시 후 다시 시도해 주세요.');
      let json: any;
      try { json = JSON.parse(text); }
      catch { throw new Error('서버 응답 형식 오류입니다.'); }

      if (!res.ok) throw new Error(json.message ?? '로그인에 실패했습니다.');
      const { user, accessToken } = json.data ?? json;

      // ── 디버그 로그 ──────────────────────────────
      console.group('[Login] 로그인 응답');
      console.log('✅ HTTP Status:', res.status);
      console.log('📦 json.data:', json.data);
      console.log('👤 user:', user);
      console.log('🎫 accessToken:', accessToken ? accessToken.substring(0, 30) + '...' : 'NONE');
      console.log('🔑 user.roles:', user?.roles);
      console.groupEnd();
      // ──────────────────────────────────────────────

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: 12 }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0 }}>KKS Portal</Title>
          <Text type="secondary">서비스를 이용하시려면 로그인하세요.</Text>
        </div>
        <Form form={form} layout="vertical" onFinish={handleLogin} autoComplete="off" size="large">
          <Form.Item name="email" rules={[{ required: true, message: '이메일을 입력하세요.' }, { type: 'email', message: '올바른 이메일 형식을 입력하세요.' }]}>
            <Input prefix={<UserOutlined />} placeholder="이메일" autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '비밀번호를 입력하세요.' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>로그인</Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}> 2026 KKS Portal Service. All rights reserved.</Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
