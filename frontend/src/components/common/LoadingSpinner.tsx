import React from 'react';
import { Spin } from 'antd';
import styles from './LoadingSpinner.module.css';

interface Props {
  tip?: string;
  fullPage?: boolean;
}

export default function LoadingSpinner({ tip = '로딩 중...', fullPage = false }: Props) {
  if (fullPage) {
    return (
      <div className={styles.fullPage}>
        <Spin size="large" tip={tip} />
      </div>
    );
  }
  return (
    <div className={styles.inline}>
      <Spin tip={tip} />
    </div>
  );
}
