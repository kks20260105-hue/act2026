#!/usr/bin/env node
// scripts/api_revoke_check3.js
// Usage: node scripts/api_revoke_check3.js <userId> <roleId>

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

function readBackendJwtSecret() {
  try {
    const envPath = path.resolve(__dirname, '..', 'backend', '.env');
    const txt = fs.readFileSync(envPath, 'utf8');
    const m = txt.match(/^JWT_SECRET\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\n#]+))/m);
    if (!m) return null;
    return (m[1] || m[2] || m[3] || '').trim();
  } catch (e) {
    return null;
  }
}

async function main() {
  const userId = process.argv[2];
  const roleId = process.argv[3];
  if (!userId || !roleId) {
    console.error('Usage: node scripts/api_revoke_check3.js <userId> <roleId>');
    process.exit(1);
  }

  const JWT_SECRET = readBackendJwtSecret() || process.env.JWT_SECRET || 'portal-secret-key-2026';
  const baseUrl = process.env.API_BASE || 'http://localhost:4000';

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
