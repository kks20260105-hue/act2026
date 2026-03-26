import type { NextApiRequest, NextApiResponse } from "next";
 
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
        //const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
    const apiRes = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
 
    const data = await apiRes.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(apiRes.status).json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: "Claude API 호출 실패: " + msg });
  }
}