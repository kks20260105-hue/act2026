#!/usr/bin/env node
// scripts/grant_role.js
// Usage: node scripts/grant_role.js <email> <roleKey>

const { getSupabaseAdmin } = require('../lib/sharedAuth');

async function main() {
  const email = process.argv[2];
  const roleKey = process.argv[3];
  if (!email || !roleKey) {
    console.error('Usage: node scripts/grant_role.js <email> <roleKey>');
    process.exit(1);
  }
  const admin = getSupabaseAdmin();

  const { data: users } = await admin.from('users').select('id').eq('email', email).limit(1);
  if (!users || users.length === 0) { console.error('User not found'); process.exit(1); }
  const user = users[0];

  const { data: roles } = await admin.from('tb_role').select('*').or(`role_cd.eq.${roleKey},role_nm.ilike.%25${roleKey}%25`).limit(1);
  if (!roles || roles.length === 0) { console.error('Role not found'); process.exit(1); }
  const role = roles[0];

  // check existing
  const { data: existing } = await admin.from('tb_user_role').select('*').eq('user_id', user.id).eq('role_id', role.role_id).maybeSingle();
  if (existing) {
    const { data: updated, error } = await admin.from('tb_user_role').update({ use_yn: 'Y', updated_at: new Date().toISOString() }).eq('user_role_id', existing.user_role_id).select('*').single();
    if (error) { console.error('Update error', error); process.exit(1); }
    console.log('Updated to active:', updated);
  } else {
    const { data: inserted, error } = await admin.from('tb_user_role').insert({ user_id: user.id, role_id: role.role_id, start_dt: new Date().toISOString().slice(0,10), use_yn: 'Y' }).select('*').single();
    if (error) { console.error('Insert error', error); process.exit(1); }
    console.log('Inserted mapping:', inserted);
  }
}

main();
