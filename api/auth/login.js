/**
 * api/auth/login.js  – Vercel Serverless Function
 * POST /api/auth/login
 *
 * 공유 로직: lib/sharedAuth.js  (개발환경 Express와 동일 코드 사용)
 */
 
const { loginFlow } = require('../../lib/sharedAuth');

module.exports = async (req, res) => {

  // ── CORS ────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // ── Body 파싱 (Vercel 대응) ──────────────────────────────────
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ success: false, message: '잘못된 요청 형식입니다.' }); }
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력하세요.' });
  }

  // ── 환경변수 체크 ────────────────────────────────────────────
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('[login] 환경변수 누락');
    return res.status(500).json({ success: false, message: '서버 환경변수가 설정되지 않았습니다.' });
  }

  // ── 공유 loginFlow 호출 (lib/sharedAuth.js) ─────────────────
  try {
    const result = await loginFlow(email, password);

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, data: result.data });

  } catch (err) {
    console.error('[login] 예외:', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};
