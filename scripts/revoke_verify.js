#!/usr/bin/env node
// scripts/revoke_verify.js
// Usage: node scripts/revoke_verify.js heidi@example.com SUPER_ADMIN

const { getSupabaseAdmin } = require('../lib/sharedAuth');

async function main() {
  const email = process.argv[2] || 'heidi@example.com';
  const roleKey = process.argv[3] || 'SUPER_ADMIN';
  const admin = getSupabaseAdmin();

  console.log('Searching user by email:', email);
  const { data: users, error: uerr } = await admin.from('users').select('id,email,display_name').eq('email', email).limit(1);
  if (uerr) { console.error('User lookup error:', uerr); process.exit(1); }
  if (!users || users.length === 0) { console.log('User not found'); process.exit(0); }
  const user = users[0];
  console.log('Found user:', user);

  console.log('Searching role by code/name:', roleKey);
  const { data: roles, error: rerr } = await admin.from('tb_role').select('*').or(`role_cd.eq.${roleKey},role_nm.ilike.%25${roleKey}%25`).limit(1);
  if (rerr) { console.error('Role lookup error:', rerr); process.exit(1); }
  if (!roles || roles.length === 0) { console.log('Role not found'); process.exit(0); }
  const role = roles[0];
  console.log('Found role:', role);

  console.log('Listing current tb_user_role entries for user (before):');
  const { data: urBefore, error: ubErr } = await admin
    .from('tb_user_role')
    .select('user_role_id, user_id, role_id, start_dt, end_dt, use_yn, tb_role(role_cd, role_nm)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (ubErr) { console.error('tb_user_role lookup error:', ubErr); process.exit(1); }
  console.log(JSON.stringify(urBefore, null, 2));

  // Find active mapping for this role
  const active = (urBefore || []).find((x) => x.role_id === role.role_id && x.use_yn === 'Y');
  if (!active) {
    console.log('No active mapping found for this role and user. Nothing to revoke.');
    process.exit(0);
  }


  console.log('Revoking user_role_id (delete):', active.user_role_id);
  const { error: delErr } = await admin
    .from('tb_user_role')
    .delete()
    .eq('user_role_id', active.user_role_id);
  if (delErr) { console.error('Delete error:', delErr); process.exit(1); }
  console.log('Revoke (delete) complete.');

  console.log('Listing tb_user_role entries for user (after):');
  const { data: urAfter, error: uaErr } = await admin
    .from('tb_user_role')
    .select('user_role_id, user_id, role_id, start_dt, end_dt, use_yn, tb_role(role_cd, role_nm)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (uaErr) { console.error('tb_user_role lookup error:', uaErr); process.exit(1); }
  console.log(JSON.stringify(urAfter, null, 2));

  console.log('Done.');
  process.exit(0);
}

main();
