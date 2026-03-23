import { createClient } from '@supabase/supabase-js';

const url  = process.env.SUPABASE_URL!;
const key  = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!;
const anon = (process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_KEY)!;

/** 서버 전용: RLS 우회 (service_role key) */
export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false },
});

/** 사용자 JWT 검증용 (anon key) */
export const supabaseAnon = createClient(url, anon, {
  auth: { persistSession: false },
});
