/**
 * server.js - 서버 진입점
 * 차후 .NET(ASP.NET Core) 마이그레이션 시 이 파일을 Program.cs로 대체
 */
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`[Server] 포털 서비스 백엔드 실행 중: http://localhost:${PORT}`);
  console.log(`[Server] 환경: ${process.env.NODE_ENV || 'development'}`);
});

// 예상치 못한 예외 처리
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  server.close(() => process.exit(1));
});

module.exports = server;
