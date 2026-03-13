import React from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import AppRouter from './router';
import './App.css';

// 에러 경계: 렌더링 오류를 잡아 백지 화면 방지
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#c00' }}>
          <h2>앱 오류 발생</h2>
          <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '6px' }}>
            {this.state.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          locale={koKR}
          theme={{
            token: {
              colorPrimary:       '#595959',
              colorLink:          '#595959',
              colorLinkHover:     '#333333',
              colorBgContainer:   '#ffffff',
              colorBorder:        '#d0d0d0',
              colorBorderSecondary: '#e8e8e8',
              colorText:          '#1a1a1a',
              colorTextSecondary: '#4a4a4a',
              colorTextPlaceholder: '#aaaaaa',
              colorFillSecondary: '#f5f5f5',
              colorBgLayout:      '#f0f0f0',
              borderRadius:       4,
              borderRadiusLG:     6,
              fontSize:           13,
              fontFamily:         "'Pretendard', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif",
            },
            components: {
              Button: {
                colorPrimary:       '#595959',
                colorPrimaryHover:  '#333333',
                colorPrimaryActive: '#1a1a1a',
                defaultBorderColor: '#d0d0d0',
                defaultColor:       '#1a1a1a',
              },
              Menu: {
                darkItemBg:             '#1a1a1a',
                darkItemSelectedBg:     '#595959',
                darkItemHoverBg:        '#333333',
                darkItemSelectedColor:  '#ffffff',
              },
              Table: {
                headerBg:           '#f5f5f5',
                headerColor:        '#1a1a1a',
                rowHoverBg:         '#fafafa',
              },
            },
          }}
        >
          <AntApp>
            <AppRouter />
          </AntApp>
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
