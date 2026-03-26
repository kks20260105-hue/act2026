import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { withAuth } from '../../lib/authMiddleware';
import { withRole } from '../../lib/checkRole';
import { successResponse, errorResponse } from '../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  const { search, page = '1', limit = '20' } = req.query;
  const pageNum  = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const offset   = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from('users')
    .select(`
      id, email, username, name, display_name, department, position_nm, is_active, created_at,
      tb_user_role!tb_user_role_user_id_fkey(role_id, start_dt, end_dt, use_yn, tb_role(role_cd, role_nm, role_color))
    `, { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (search) {
    query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%,name.ilike.%${search}%,department.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));

  // 서버 측에서 tb_user_role 필터링: use_yn='Y' 이고 end_dt가 null 또는 오늘 이후인 항목만 포함
  const today = new Date().toISOString().split('T')[0];
  const filtered = (data || []).map((u: any) => {
    if (!u.tb_user_role || !Array.isArray(u.tb_user_role)) return u;
    u.tb_user_role = u.tb_user_role.filter((ur: any) => {
      if (ur.use_yn !== 'Y') return false;
      if (!ur.end_dt) return true;
      return ur.end_dt >= today;
    });
    return u;
  });

  return res.status(200).json({
    ...successResponse(filtered),
    total: count ?? 0,
    page:  pageNum,
    limit: limitNum,
  });
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
