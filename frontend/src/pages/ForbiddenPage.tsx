import React from 'react';
import { Result, Button } from 'antd';
import styles from './ForbiddenPage.module.css';
import { useNavigate } from 'react-router-dom';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <div className={styles.wrapper}>
      <Result
        status="403"
        title="403"
        subTitle="접근 권한이 없습니다. 관리자에게 문의하세요."
        extra={<Button type="primary" onClick={() => navigate('/')}>홈으로</Button>}
      />
    </div>
  );
}
