#!/usr/bin/env node
// scripts/api_revoke_check2.js
// Usage: node scripts/api_revoke_check2.js <userId> <roleId>

const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'backend', '.env') });

async function main() {
  const userId = process.argv[2];
  const roleId = process.argv[3];
  if (!userId || !roleId) {
    console.error('Usage: node scripts/api_revoke_check2.js <userId> <roleId>');
    process.exit(1);
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'portal-secret-key-2026';
  const baseUrl = process.env.API_BASE || 'http://localhost:4000';

  // create a JWT with SUPER_ADMIN role using backend .env secret
  const payload = { id: 'ec7cf0a0-d75f-4ae5-afa7-ff8e5fc0bd97', email: 'local-admin@example.com', roles: ['SUPER_ADMIN'] };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('Using JWT_SECRET from backend .env:', JWT_SECRET ? 'present' : 'missing');
  console.log('GET roles (before)');
  let res = await fetch(`${baseUrl}/api/users/${userId}/roles`, { headers });
  console.log('Status:', res.status);
  console.log(await res.text());

  console.log('\nDELETE role');
  res = await fetch(`${baseUrl}/api/users/${userId}/roles/${roleId}`, { method: 'DELETE', headers });
  console.log('Status:', res.status);
  console.log(await res.text());

  console.log('\nGET roles (after)');
  res = await fetch(`${baseUrl}/api/users/${userId}/roles`, { headers });
  console.log('Status:', res.status);
  console.log(await res.text());
}

main().catch((e) => { console.error(e); process.exit(1); });
