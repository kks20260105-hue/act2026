import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';

/**
 * PUT /api/menu-roles/batch
 * 특정 메뉴의 Role 매핑을 전체 교체합니다.
 * Body: { menu_id: string; role_ids: string[] }
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  const { menu_id, role_ids } = req.body as { menu_id: string; role_ids: string[] };
  if (!menu_id || !Array.isArray(role_ids)) {
    return res.status(400).json(errorResponse('MISSING_FIELD', 'menu_id, role_ids 필수'));
  }

  // 기존 매핑 삭제
  const { error: delError } = await supabaseAdmin
    .from('tb_menu_role')
    .delete()
    .eq('menu_id', menu_id);

  if (delError) return res.status(500).json(errorResponse('DB_ERROR', delError.message));

  // 신규 매핑 삽입
  if (role_ids.length > 0) {
    const inserts = role_ids.map((role_id) => ({
      menu_id,
      role_id,
      read_yn:  'Y',
      write_yn: 'N',
    }));

    const { error: insError } = await supabaseAdmin.from('tb_menu_role').insert(inserts);
    if (insError) return res.status(500).json(errorResponse('DB_ERROR', insError.message));
  }

  return res.status(200).json(successResponse(null, '메뉴-Role 매핑이 저장되었습니다.'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
