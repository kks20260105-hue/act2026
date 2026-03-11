/**
 * controllers/authController.js - 인증 비즈니스 로직
 * DB: uf_login() 프로시저로 이메일+비밀번호 검증
 * 차후 .NET 마이그레이션 시 → AuthController.cs (ASP.NET Core)
 */
const { validationResult } = require('express-validator');
const { supabaseAdmin } = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'portal-secret-key-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

const authController = {
  /**
   * POST /api/auth/login
   * uf_login(email, password) 프로시저로 검증 → JWT 발급
   */
  login: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, password } = req.body;
      const ip        = req.ip || req.headers['x-forwarded-for'] || '';
      const userAgent = req.headers['user-agent'] || '';

      // ── DB 프로시저 호출: uf_login ──────────────────────────
      const { data: rows, error } = await supabaseAdmin
        .rpc('uf_login', { p_email: email, p_password: password || '' });

      if (error) {
        console.error('[Auth] uf_login 오류:', error.message);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
      }

      if (!rows || rows.length === 0) {
        // 로그인 실패 로그 기록 (이메일로 user_id 조회 시도)
        const { data: userRows } = await supabaseAdmin
          .rpc('uf_get_user_by_email', { p_email: email });
        const userId = userRows?.[0]?.id ?? null;
        if (userId) {
          await supabaseAdmin.rpc('up_insert_login_log', {
            p_user_id: userId, p_ip: ip, p_agent: userAgent, p_success: false,
          });
        }
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        });
      }

      const user = rows[0];

      // JWT 발급
      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      // 로그인 성공 로그
      await supabaseAdmin.rpc('up_insert_login_log', {
        p_user_id: user.id, p_ip: ip, p_agent: userAgent, p_success: true,
      });

      return res.json({
        success: true,
        data: {
          accessToken: token,
          user: {
            id:          user.id,
            email:       user.email,
            username:    user.username,
            displayName: user.display_name,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/logout
   */
  logout: async (req, res, next) => {
    try {
      return res.json({ success: true, message: '로그아웃되었습니다.' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/auth/me
   */
  getMe: async (req, res) => {
    return res.json({ success: true, data: req.user });
  },
};

module.exports = authController;
