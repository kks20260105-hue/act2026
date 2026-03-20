/**
 * KakaoEmailInputPage.tsx
 *
 * 카카오 소셜 로그인 시 이메일을 제공받지 못한 경우(심사 전) 표시되는 페이지.
 * 사용자가 직접 이메일을 입력하면 /api/auth/kakao/set-email 로 전송 후 로그인 처리.
 *
 * ※ 카카오 비즈 앱 심사 완료 후 이메일이 제공되면 이 페이지는 자동으로 건너뜁니다.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

interface FormValues {
  email: string;
}

const KakaoEmailInputPage: React.FC = () => {
  const navigate         = useNavigate();
  const { message }      = App.useApp();
  const [searchParams]   = useSearchParams();
  const setUser          = useAuthStore((s) => s.setUser);
  const [form]           = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);

  // 카카오 콜백에서 전달된 파라미터
  const kakaoId      = searchParams.get('kakao_id')      ?? '';
  const name         = searchParams.get('name')          ?? '';
  const profileImage = searchParams.get('profile_image') ?? '';

  const handleSubmit = async (values: FormValues) => {
    if (!kakaoId) {
      message.error('카카오 인증 정보가 없습니다. 다시 로그인해 주세요.');
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/kakao/set-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          kakao_id:      kakaoId,
          email:         values.email,
          name,
          profile_image: profileImage,
        }),
      });

      const text = await res.text();
      if (!text) throw new Error('서버 응답이 없습니다.');
      const json = JSON.parse(text);
      if (!res.ok) throw new Error(json.message ?? '처리 중 오류가 발생했습니다.');

      const { user, accessToken } = json.data;

      // ✅ portal_access_token 저장 (logout 시 사용)
      localStorage.setItem('portal_access_token', accessToken);

      setUser(
        { id: user.id, email: user.email, nickname: user.name ?? user.nickname ?? '' },
        accessToken,
        user.roles ?? [],
      );

      message.success('카카오 계정으로 로그인되었습니다!');
      navigate('/', { replace: true });
    } catch (err: any) {
      message.error(err.message ?? '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #FEE500 0%, #F7C948 100%)',
      }}
    >
      <Card
        style={{ width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: 12 }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {/* 카카오 심볼 */}
          <div
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#3A1D1D', margin: '0 auto 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}
          >
            💬
          </div>
          <Title level={4} style={{ margin: 0 }}>
            {name ? `${name}님, 안녕하세요!` : '카카오 로그인'}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            서비스 이용을 위해 이메일을 입력해 주세요.
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large">
          <Form.Item
            name="email"
            label="이메일"
            rules={[
              { required: true, message: '이메일을 입력하세요.' },
              { type: 'email', message: '올바른 이메일 형식을 입력하세요.' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="example@email.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{ background: '#3A1D1D', borderColor: '#3A1D1D' }}
            >
              확인
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            입력한 이메일은 계정 식별에만 사용됩니다.
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default KakaoEmailInputPage;
