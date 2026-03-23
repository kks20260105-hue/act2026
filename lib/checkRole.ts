import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiHandler } from './authMiddleware';
import { supabaseAdmin } from './supabaseClient';

export type RoleCode = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

/**
 * 사용자의 Role 목록을 조회합니다.
 * expired 된 Role은 제외합니다.
 */
export async function getUserRoles(userId: string): Promise<RoleCode[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('tb_user_role')
    .select('tb_role!inner(role_cd)')
    .eq('user_id', userId)
    .eq('use_yn', 'Y')
    .or(`end_dt.is.null,end_dt.gte.${today}`);

  if (error || !data) return [];

  return (data as any[]).map((r) => r.tb_role.role_cd as RoleCode);
}

/**
 * HOF: 필요 Role을 가진 사용자만 핸들러를 실행합니다.
 * withAuth 미들웨어 이후에 사용해야 합니다.
 */
export function withRole(
  requiredRoles: RoleCode[],
  handler: ApiHandler
): ApiHandler {
  return async (req: VercelRequest, res: VercelResponse) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '인증 필요' });
    }

    // JWT 토큰에 이미 roles가 담겨 있으면 DB 재조회 없이 사용 (빠르고 안정적)
    const jwtRoles: RoleCode[] = Array.isArray(user.roles) ? user.roles : [];
    const userRoles = jwtRoles.length > 0 ? jwtRoles : await getUserRoles(user.id);
    const hasRole = requiredRoles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: `접근 권한이 없습니다. 필요 Role: ${requiredRoles.join(', ')}`,
      });
    }

    return handler(req, res);
  };
}
