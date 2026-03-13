import React from 'react';
import { Result, Button } from 'antd';
import styles from './NotFoundPage.module.css';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className={styles.wrapper}>
      <Result
        status="404"
        title="404"
        subTitle="요청하신 페이지를 찾을 수 없습니다."
        extra={<Button type="primary" onClick={() => navigate('/')}>홈으로</Button>}
      />
    </div>
  );
}
