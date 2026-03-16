import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'portal-secret-key-2026';

export type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse
) => void | VercelResponse | Promise<void | VercelResponse>;

export interface AuthedUser {
  id: string;
  email: string;
  roles?: string[];
}

declare global {
  // Augment the existing VercelRequest interface
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface VercelRequest {
    user?: AuthedUser;
  }
}

/**
 * 미들웨어: Authorization 헤더의 Bearer JWT를 검증하고
 * req.user를 설정합니다. (custom JWT, jsonwebtoken)
 */
export function withAuth(handler: ApiHandler): ApiHandler {
  return async (req: VercelRequest, res: VercelResponse) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '토큰이 없습니다.' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).user = { id: decoded.id, email: decoded.email, roles: decoded.roles ?? [] };
      return handler(req, res);
    } catch {
      return res.status(401).json({ code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' });
    }
  };
}
