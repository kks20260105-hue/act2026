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

  return res.status(200).json({
    ...successResponse(data),
    total: count ?? 0,
    page:  pageNum,
    limit: limitNum,
  });
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
