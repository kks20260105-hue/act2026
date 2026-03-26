#!/usr/bin/env node
/**
 * backend/scripts/delete_revoked_user_roles.js
 *
 * Usage:
 *   node delete_revoked_user_roles.js            # delete all use_yn='N' rows
 *   node delete_revoked_user_roles.js <userId>   # delete for specific user
 *   node delete_revoked_user_roles.js <userId> <roleId> # delete specific role for user
 *
 * WARNING: This permanently deletes rows. Back up before running in production.
 */

require('dotenv').config();
const path = require('path');
const { getSupabaseAdmin } = require('../../lib/sharedAuth');

async function main() {
  const args = process.argv.slice(2);
  const userId = args[0];
  const roleId = args[1];

  console.log('[delete_revoked_user_roles] starting', { userId, roleId });

  let cond = { use_yn: 'N' };
  if (userId) cond.user_id = userId;
  if (roleId) cond.role_id = roleId;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_user_role')
      .delete()
      .match(cond);

    if (error) {
      console.error('[delete_revoked_user_roles] error:', error.message || error);
      process.exit(2);
    }

    console.log('[delete_revoked_user_roles] deleted rows:', Array.isArray(data) ? data.length : (data ? 1 : 0));
    if (Array.isArray(data) && data.length > 0) console.log('[delete_revoked_user_roles] sample:', JSON.stringify(data.slice(0,3)));
    process.exit(0);
  } catch (err) {
    console.error('[delete_revoked_user_roles] unexpected error:', err && err.stack ? err.stack : err);
    process.exit(3);
  }
}

main();
