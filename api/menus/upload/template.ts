import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../../lib/authMiddleware';

/**
 * GET /api/menus/upload/template
 * ?‘ì? ?…ë¡œ???œí”Œë¦?CSV ?¤ìš´ë¡œë“œ
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }

  const csvHeader = 'menu_nm,menu_url,parent_menu_url,menu_depth,menu_order,icon_class,use_yn,allow_roles';
  const csvExample = [
    '??/,, 1,1,home,Y,USER',
    '?…ë¬´,/work,,1,2,briefcase,Y,USER',
    'ê³µì??¬í•­,/work/notice,/work,2,1,notification,Y,"USER,MANAGER"',
    'ê´€ë¦?/admin,,1,9,setting,Y,"ADMIN,SUPER_ADMIN"',
    'ë©”ë‰´ê´€ë¦?/admin/menus,/admin,2,1,menu,Y,"ADMIN,SUPER_ADMIN"',
  ].join('\n');

  const csv = `${csvHeader}\n${csvExample}`;
  const BOM  = '\uFEFF';  // UTF-8 BOM (Excel ?œê? ê¹¨ì§ ë°©ì?)

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=menu_upload_template.csv');
  return res.status(200).send(BOM + csv);
}

export default withAuth(handler);
