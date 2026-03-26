import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY 환경변수가 없습니다." });
  }

  try {
    // 프록시: 클라이언트가 보낸 요청 바디를 Anthropic으로 전달
    // 실제 Anthropic 엔드포인트로 요청합니다.
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await apiRes.json().catch(() => null);

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(apiRes.status).json(data ?? { error: '빈 응답' });
  } catch (e) {
    const msg = (e && (e as any).message) ? (e as any).message : String(e);
    return res.status(500).json({ error: "Claude API 호출 실패: " + msg });
  }
}



