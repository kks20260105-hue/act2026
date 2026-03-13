import React from 'react';
import { Spin } from 'antd';

interface Props {
  tip?: string;
  fullPage?: boolean;
}

export default function LoadingSpinner({ tip = '로딩 중...', fullPage = false }: Props) {
  if (fullPage) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip={tip} />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
      <Spin tip={tip} />
    </div>
  );
}
