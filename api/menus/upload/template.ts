import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../../../lib/authMiddleware';

/**
 * GET /api/menus/upload/template
 * 엑셀 업로드 템플릿 CSV 다운로드
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }

  const csvHeader = 'menu_nm,menu_url,parent_menu_url,menu_depth,menu_order,icon_class,use_yn,allow_roles';
  const csvExample = [
    '홈,/,, 1,1,home,Y,USER',
    '업무,/work,,1,2,briefcase,Y,USER',
    '공지사항,/work/notice,/work,2,1,notification,Y,"USER,MANAGER"',
    '관리,/admin,,1,9,setting,Y,"ADMIN,SUPER_ADMIN"',
    '메뉴관리,/admin/menus,/admin,2,1,menu,Y,"ADMIN,SUPER_ADMIN"',
  ].join('\n');

  const csv = `${csvHeader}\n${csvExample}`;
  const BOM  = '\uFEFF';  // UTF-8 BOM (Excel 한글 깨짐 방지)

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=menu_upload_template.csv');
  return res.status(200).send(BOM + csv);
}

export default withAuth(handler);
