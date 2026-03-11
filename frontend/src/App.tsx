import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { PrimeReactProvider } from 'primereact/api';
import AppRoutes from '@/routes/AppRoutes';
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
      <PrimeReactProvider value={{ ripple: false }}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </PrimeReactProvider>
    </ErrorBoundary>
  );
};

export default App;
