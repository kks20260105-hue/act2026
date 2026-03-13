import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 글로벌 JS 에러 캐치
window.addEventListener('error', (e) => {
  console.error('[GlobalError]', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[UnhandledRejection]', e.reason);
});

const rootElement = document.getElementById('root') as HTMLElement;
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
