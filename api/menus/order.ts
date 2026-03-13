import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';

/**
 * PUT /api/menus/order
 * Body: { orders: Array<{ menu_id: string; menu_order: number }> }
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  const { orders } = req.body as { orders: { menu_id: string; menu_order: number }[] };
  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json(errorResponse('MISSING_FIELD', 'orders 필드는 배열이어야 합니다.'));
  }

  const updates = await Promise.all(
    orders.map(({ menu_id, menu_order }) =>
      supabaseAdmin.from('tb_menu').update({ menu_order }).eq('menu_id', menu_id)
    )
  );

  const failed = updates.find((r) => r.error);
  if (failed?.error) {
    return res.status(500).json(errorResponse('DB_ERROR', failed.error.message));
  }

  return res.status(200).json(successResponse(null, '순서가 저장되었습니다.'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
