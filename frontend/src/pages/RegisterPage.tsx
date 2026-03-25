/**
 * RegisterPage.tsx - 일반 사번 등록 (회원가입) 페이지
 */
import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App, Select, Divider } from 'antd';
import {
  UserOutlined, LockOutlined, MailOutlined,
  IdcardOutlined, TeamOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface RegisterFormValues {
  employeeId: string;   // 사번
  name:       string;   // 이름
  email:      string;   // 이메일
  department: string;   // 부서
  position:   string;   // 직급
  password:   string;   // 비밀번호
  confirm:    string;   // 비밀번호 확인
}

const DEPARTMENTS = [
  '경영지원', '기획팀', '개발팀', '디자인팀',
  '영업팀', '마케팅', '운영팀', '인사팀', '기타',
];

const POSITIONS = ['사원', '주임', '대리', '과장', '차장', '부장', '임원', '기타'];

const RegisterPage: React.FC = () => {
  const navigate    = useNavigate();
  const { message } = App.useApp();
  const [form]      = Form.useForm<RegisterFormValues>();
  const [loading, setLoading] = useState(false);

  const handleRegister = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          employeeId: values.employeeId,
          name:       values.name,
          email:      values.email,
          department: values.department,
          position:   values.position,
          password:   values.password,
        }),
      });

      const text = await res.text();
      if (!text) throw new Error('서버 응답이 없습니다.');
      const json = JSON.parse(text);

      if (!res.ok) throw new Error(json.message ?? '회원가입에 실패했습니다.');

      message.success('회원가입이 완료되었습니다. 관리자 승인 후 로그인하실 수 있습니다.');
      navigate('/login', { replace: true });
    } catch (err: any) {
      message.error(err.message ?? '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f0f0', padding: 20,
    }}>
      <Card
        style={{ width: 460, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', borderRadius: 8, border: '1px solid #d0d0d0' }}
        bordered={false}
        bodyStyle={{ padding: '28px 32px' }}
      >
        {/* ── 타이틀 ── */}
        <div style={{ marginBottom: 20 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/login')}
            style={{ padding: 0, fontSize: 12, color: '#666', marginBottom: 12 }}
          >
            로그인으로 돌아가기
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IdcardOutlined style={{ fontSize: 22, color: '#555' }} />
            <div>
              <Title level={4} style={{ margin: 0, color: '#1a1a1a' }}>사번 등록 (회원가입)</Title>
              <Text style={{ fontSize: 12, color: '#6a6a6a' }}>사내 임직원 전용 · 관리자 승인 후 이용 가능합니다.</Text>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '0 0 20px' }} />

        {/* ── 등록 폼 ── */}
        <Form form={form} layout="vertical" onFinish={handleRegister} autoComplete="off" size="middle">

          {/* 사번 + 이름 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={<span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>사번 <span style={{ color: '#cc0000' }}>*</span></span>}
              name="employeeId"
              style={{ marginBottom: 14 }}
              rules={[
                { required: true, message: '사번을 입력하세요.' },
                { pattern: /^[A-Za-z0-9]{4,20}$/, message: '사번은 영문/숫자 4~20자입니다.' },
              ]}
            >
              <Input prefix={<IdcardOutlined style={{ color: '#888' }} />} placeholder="예) EMP2024001" style={{ fontSize: 12 }} />
            </Form.Item>
            <Form.Item
              label={<span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>이름 <span style={{ color: '#cc0000' }}>*</span></span>}
              name="name"
              style={{ marginBottom: 14 }}
              rules={[{ required: true, message: '이름을 입력하세요.' }]}
            >
              <Input prefix={<UserOutlined style={{ color: '#888' }} />} placeholder="홍길동" style={{ fontSize: 12 }} />
            </Form.Item>
          </div>

          {/* 이메일 */}
          <Form.Item
            label={<span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>이메일 (로그인 ID) <span style={{ color: '#cc0000' }}>*</span></span>}
            name="email"
            style={{ marginBottom: 14 }}
            rules={[
              { required: true, message: '이메일을 입력하세요.' },
              { type: 'email', message: '올바른 이메일 형식을 입력하세요.' },
            ]}
          >
            <Input prefix={<MailOutlined style={{ color: '#888' }} />} placeholder="example@company.com" style={{ fontSize: 12 }} />
          </Form.Item>

          {/* 부서 + 직급 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={<span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>부서 <span style={{ color: '#cc0000' }}>*</span></span>}
              name="department"
              style={{ marginBottom: 14 }}
              rules={[{ required: true, message: '부서를 선택하세요.' }]}
            >
              <Select
                placeholder="부서 선택"
                suffixIcon={<TeamOutlined style={{ color: '#888' }} />}
                style={{ fontSize: 12 }}
              >
                {DEPARTMENTS.map((d) => (
                  <Select.Option key={d} value={d} style={{ fontSize: 12 }}>{d}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              label={<span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>직급 <span style={{ color: '#cc0000' }}>*</span></span>}
              name="position"
              style={{ marginBottom: 14 }}
              rules={[{ required: true, message: '직급을 선택하세요.' }]}
            >
              <Select placeholder="직급 선택" style={{ fontSize: 12 }}>
                {POSITIONS.map((p) => (
                  <Select.Option key={p} value={p} style={{ fontSize: 12 }}>{p}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          {/* 비밀번호 + 확인 */}
          <Form.Item
            label={<span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>비밀번호 <span style={{ color: '#cc0000' }}>*</span></span>}
            name="password"
            style={{ marginBottom: 14 }}
            rules={[
              { required: true, message: '비밀번호를 입력하세요.' },
              { min: 8, message: '비밀번호는 8자 이상이어야 합니다.' },
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#888' }} />} placeholder="8자 이상 입력" style={{ fontSize: 12 }} />
          </Form.Item>
          <Form.Item
            label={<span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>비밀번호 확인 <span style={{ color: '#cc0000' }}>*</span></span>}
            name="confirm"
            style={{ marginBottom: 20 }}
            dependencies={['password']}
            rules={[
              { required: true, message: '비밀번호를 한 번 더 입력하세요.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다.'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#888' }} />} placeholder="비밀번호 재입력" style={{ fontSize: 12 }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary" htmlType="submit" block loading={loading}
              style={{ height: 38, fontSize: 13, fontWeight: 600, backgroundColor: '#555555', borderColor: '#555555' }}
            >
              가입 신청
            </Button>
          </Form.Item>
        </Form>

        {/* ── 안내 ── */}
        <div style={{ marginTop: 16, padding: '10px 12px', background: '#f8f8f8', borderRadius: 4, border: '1px solid #e8e8e8' }}>
          <Text style={{ fontSize: 11, color: '#888', lineHeight: 1.6 }}>
            ※ 가입 신청 후 관리자 승인이 완료되면 로그인 이메일로 안내드립니다.<br />
            ※ 소셜 계정(네이버·카카오·Google) 가입은 로그인 화면에서 진행하세요.
          </Text>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text style={{ fontSize: 11, color: '#aaaaaa' }}>© 2026 Portal Service. All rights reserved.</Text>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
