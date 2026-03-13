import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { RoleCode } from '../../types/role';

interface Props {
  /** 접근 허용 Role 목록. 빈 배열이면 로그인만 확인 */
  roles?:    RoleCode[];
  fallback?: React.ReactNode;
  children:  React.ReactNode;
}

/**
 * Role 기반 렌더링 가드
 * - roles가 없으면 로그인 여부만 확인
 * - roles가 있으면 해당 Role을 가진 사용자만 children 렌더링
 */
export default function PermissionGuard({ roles, fallback, children }: Props) {
  const navigate = useNavigate();
  const { isLoggedIn, checkRole } = useAuth();

  if (!isLoggedIn) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <Result
        status="403"
        title="로그인 필요"
        subTitle="로그인 후 이용하실 수 있습니다."
        extra={<Button type="primary" onClick={() => navigate('/login')}>로그인</Button>}
      />
    );
  }

  if (roles && roles.length > 0 && !checkRole(roles)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <Result
        status="403"
        title="403"
        subTitle="접근 권한이 없습니다."
        extra={<Button onClick={() => navigate('/')}>홈으로</Button>}
      />
    );
  }

  return <>{children}</>;
}
