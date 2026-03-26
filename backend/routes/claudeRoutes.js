const express = require('express');
const router = express.Router();

// POST /api/claude - 프록시: 요청을 Anthropic API로 전달
router.post('/', async (req, res, next) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' });

    // Anthropic 실제 엔드포인트로 요청
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await apiRes.json().catch(() => null);
    return res.status(apiRes.status).json(data ?? { success: false, message: '빈 응답' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
