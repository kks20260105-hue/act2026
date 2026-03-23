import React from 'react';
import { Layout, Breadcrumb } from 'antd';
import styles from './PageLayout.module.css';
import GNBLayout from './GNBLayout';
import LNBLayout from './LNBLayout';

const { Content } = Layout;

interface BreadcrumbItem {
  title: string;
  href?: string;
}

interface Props {
  children:        React.ReactNode;
  breadcrumbs?:    BreadcrumbItem[];
  showLNB?:        boolean;
  parentMenuUrl?:  string; // 생략 시 LNBLayout이 URL로 자동 감지
}

export default function PageLayout({ children, breadcrumbs, showLNB = true, parentMenuUrl }: Props) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <GNBLayout />
      <Layout>
        {showLNB && <LNBLayout parentMenuUrl={parentMenuUrl} />}
        <Layout className={styles.inner}>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb
              className={styles.breadcrumb}
              items={breadcrumbs.map((b) => ({ title: b.href ? <a href={b.href}>{b.title}</a> : b.title }))}
            />
          )}
          <Content className={styles.content}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
