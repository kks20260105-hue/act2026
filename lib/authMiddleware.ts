import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseClient';

export type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse
) => void | VercelResponse | Promise<void | VercelResponse>;

export interface AuthedUser {
  id: string;
  email: string;
}

declare global {
  // Augment the existing VercelRequest interface
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface VercelRequest {
    user?: AuthedUser;
  }
}

/**
 * 미들웨어: Authorization 헤더의 Bearer 토큰을 검증하고
 * req.user를 설정합니다.
 */
export function withAuth(handler: ApiHandler): ApiHandler {
  return async (req: VercelRequest, res: VercelResponse) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '토큰이 없습니다.' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' });
    }

    (req as any).user = { id: data.user.id, email: data.user.email! };
    return handler(req, res);
  };
}
