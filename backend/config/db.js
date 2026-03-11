/**
 * config/db.js - Supabase DB 연결 설정
 * DB명: free2026db (Supabase 프로젝트명)
 * 
 * 차후 .NET 마이그레이션 시:
 *   → appsettings.json의 ConnectionStrings로 대체
 *   → DbContext (EF Core) 또는 Dapper 사용
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('[DB] SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 환경 변수가 설정되지 않았습니다.');
}

/**
 * Supabase Admin Client (서비스 키 사용 - 서버 전용)
 * RLS를 우회하여 관리 작업에 사용
 */
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * DB 연결 테스트
 */
const testConnection = async () => {
  try {
    const { error } = await supabaseAdmin.from('users').select('count').limit(1);
    if (error) throw error;
    console.log('[DB] Supabase(free2026db) 연결 성공');
  } catch (err) {
    console.error('[DB] Supabase 연결 실패:', err.message);
  }
};

module.exports = { supabaseAdmin, testConnection };
