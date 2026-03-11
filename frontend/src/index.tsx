import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/redux/store';
import App from './App';
import './index.css';

// PrimeReact 스타일 임포트
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

// 글로벌 JS 에러 캐치
window.addEventListener('error', (e) => {
  console.error('[GlobalError]', e.message, e.filename, e.lineno);
  const loading = document.getElementById('app-loading');
  if (loading) {
    loading.innerHTML = `<div style="color:#c00;padding:20px"><b>JS 오류:</b><br/>${e.message}<br/><small>${e.filename}:${e.lineno}</small></div>`;
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[UnhandledRejection]', e.reason);
});

const rootElement = document.getElementById('root') as HTMLElement;
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
