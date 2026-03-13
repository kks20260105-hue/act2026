import React from 'react';
import { Layout, Breadcrumb } from 'antd';
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
  parentMenuUrl?:  string;
}

export default function PageLayout({ children, breadcrumbs, showLNB = true, parentMenuUrl }: Props) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <GNBLayout />
      <Layout>
        {showLNB && <LNBLayout parentMenuUrl={parentMenuUrl} />}
        <Layout style={{ padding: '16px 24px' }}>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb
              style={{ marginBottom: 16 }}
              items={breadcrumbs.map((b) => ({ title: b.href ? <a href={b.href}>{b.title}</a> : b.title }))}
            />
          )}
          <Content
            style={{
              background:   '#fff',
              padding:      24,
              borderRadius: 8,
              minHeight:    'calc(100vh - 160px)',
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
