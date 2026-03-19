/**
 * SocialRegisterPage.tsx
 * 회원가입 유형 선택 페이지 - 소셜 3종 + 일반 사번 등록
 */
import React from 'react';
import { Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, IdcardOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

// ── 네이버 N 로고 ──────────────────────────────────────
const NaverLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" fill="#ffffff" />
  </svg>
);

// ── 카카오 로고 ─────────────────────────────────────────
const KakaoLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 3C6.477 3 2 6.69 2 11.25c0 2.9 1.774 5.453 4.455 6.974l-1.133 4.214a.25.25 0 00.375.277L11.1 19.6A11.59 11.59 0 0012 19.5c5.523 0 10-3.69 10-8.25S17.523 3 12 3z"
      fill="#3C1E1E"
    />
  </svg>
);

// ── 구글 로고 ───────────────────────────────────────────
const GoogleLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

// ── 가입 옵션 정의 ─────────────────────────────────────
const SIGNUP_OPTIONS = [
  {
    key:         'naver',
    label:       '네이버 계정으로 가입',
    subLabel:    '네이버 아이디로 간편하게 가입',
    logo:        <NaverLogo />,
    logoBg:      '#03C75A',
    btnBg:       '#03C75A',
    btnColor:    '#ffffff',
    borderColor: '#03C75A',
    href:        '/api/auth/naver',
  },
  {
    key:         'kakao',
    label:       '카카오 계정으로 가입',
    subLabel:    '카카오 아이디로 간편하게 가입',
    logo:        <KakaoLogo />,
    logoBg:      '#FEE500',
    btnBg:       '#FEE500',
    btnColor:    '#3C1E1E',
    borderColor: '#e6ce00',
    href:        '/api/auth/kakao',
  },
  {
    key:         'google',
    label:       'Google 계정으로 가입',
    subLabel:    'Google 아이디로 간편하게 가입',
    logo:        <GoogleLogo />,
    logoBg:      '#f1f3f4',
    btnBg:       '#ffffff',
    btnColor:    '#3c4043',
    borderColor: '#dadce0',
    href:        '/api/auth/google',
  },
];

const BENEFITS = [
  '별도 비밀번호 없이 소셜 계정으로 로그인',
  '회원가입 즉시 서비스 이용 가능',
  '개인정보는 최소한으로 수집',
];

const SocialRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSocialSignup = (href: string) => {
    window.location.href = href;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* ── 상단 네비 ─────────────────────────────── */}
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#555', marginBottom: 20, padding: 0,
          }}
        >
          <ArrowLeftOutlined style={{ fontSize: 13 }} />
          로그인으로 돌아가기
        </button>

        {/* ── 헤더 카드 ─────────────────────────────── */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px 12px 0 0',
          border: '1px solid #e0e0e0',
          borderBottom: 'none',
          padding: '28px 32px 24px',
          textAlign: 'center',
        }}>
          {/* 아이콘 */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#f0f0f0', border: '1px solid #e0e0e0',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <span style={{ fontSize: 26 }}>🔐</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
            소셜 계정으로 가입
          </div>
          <Text style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
            사용 중인 소셜 계정을 선택하여<br />KKS Portal에 가입하세요.
          </Text>

          {/* 혜택 안내 */}
          <div style={{
            marginTop: 16, padding: '12px 16px',
            background: '#fafafa', borderRadius: 8, border: '1px solid #ececec',
            textAlign: 'left',
          }}>
            {BENEFITS.map((b, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                marginBottom: i < BENEFITS.length - 1 ? 6 : 0,
              }}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 13, marginTop: 1.5 }} />
                <Text style={{ fontSize: 12, color: '#555' }}>{b}</Text>
              </div>
            ))}
          </div>
        </div>

        {/* ── 소셜 버튼 목록 ────────────────────────── */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          borderTop: '1px solid #ebebeb',
          borderBottom: 'none',
          padding: '8px 32px',
        }}>
          {SIGNUP_OPTIONS.map((opt, idx) => (
            <div key={opt.key}>
              <button
                onClick={() => handleSocialSignup(opt.href)}
                style={{
                  width: '100%', height: 52,
                  background: opt.btnBg, color: opt.btnColor,
                  border: `1.5px solid ${opt.borderColor}`,
                  borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  padding: '0 16px', gap: 0,
                  transition: 'filter 0.15s, box-shadow 0.15s',
                  fontFamily: 'inherit',
                  margin: '10px 0',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(0.95)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 로고 영역 */}
                <div style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: opt.logoBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: opt.key === 'google' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                }}>
                  {opt.logo}
                </div>
                {/* 텍스트 영역 */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: opt.btnColor }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 11, color: opt.btnColor, opacity: 0.7, marginTop: 1 }}>
                    {opt.subLabel}
                  </div>
                </div>
              </button>
              {idx < SIGNUP_OPTIONS.length - 1 && (
                <div style={{ height: 1, background: '#f0f0f0', margin: '2px 0' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── 구분선 + 사번 등록 ────────────────────── */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          borderTop: '1px solid #ebebeb',
          borderRadius: '0 0 12px 12px',
          padding: '16px 32px 24px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          }}>
            <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
            <Text style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>또는</Text>
            <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
          </div>

          <button
            onClick={() => navigate('/register')}
            style={{
              width: '100%', height: 48,
              background: '#ffffff', color: '#333',
              border: '1.5px solid #cccccc', borderRadius: 8,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              padding: '0 16px', gap: 12,
              transition: 'border-color 0.15s, background 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#888';
              e.currentTarget.style.background = '#fafafa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cccccc';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 6,
              background: '#555555',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IdcardOutlined style={{ fontSize: 16, color: '#fff' }} />
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>
                사번으로 가입
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>
                임직원 전용 · 관리자 승인 후 이용 가능
              </div>
            </div>
          </button>
        </div>

        {/* ── 하단 안내 ──────────────────────────────── */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 11, color: '#bbb' }}>
            이미 계정이 있으신가요?{' '}
            <span
              onClick={() => navigate('/login')}
              style={{ color: '#666', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              로그인
            </span>
          </Text>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text style={{ fontSize: 11, color: '#ccc' }}>
            © 2026 KKS Portal Service. All rights reserved.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default SocialRegisterPage;
