import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'primereact/button';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { logoutThunk } from '@/redux/slices/authSlice';
import { ROUTE_PATHS } from '@/constants';

const HomePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate(ROUTE_PATHS.LOGIN, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* 상단 네비게이션 바 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        }}
      >
        {/* 로고 / 앱명 */}
        <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#333' }}>
          KKS App
        </span>

        {/* 유저 정보 + 로그아웃 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user && (
            <span style={{ fontSize: '0.9rem', color: '#555' }}>
              👤 {user.username ?? user.email}
            </span>
          )}
          <Button
            label="로그아웃"
            icon="pi pi-sign-out"
            severity="secondary"
            outlined
            size="small"
            onClick={handleLogout}
          />
        </div>
      </div>

      {/* 본문 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 56px)',
          fontSize: '48px',
          fontWeight: 'bold',
          color: '#333',
        }}
      >
        Hello World(김기성입니다.)
      </div>
    </div>
  );
};

export default HomePage;
