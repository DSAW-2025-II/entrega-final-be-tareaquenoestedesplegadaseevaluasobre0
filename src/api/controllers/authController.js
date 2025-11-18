// Controlador de autenticación: maneja login, logout, sesión actual y restablecimiento de contraseña
const AuthService = require('../../domain/services/AuthService');
const MongoUserRepository = require('../../infrastructure/repositories/MongoUserRepository');
const MongoVehicleRepository = require('../../infrastructure/repositories/MongoVehicleRepository');
const MongoPasswordResetTokenRepository = require('../../infrastructure/repositories/PasswordResetTokenRepository');
const { generateCsrfToken, setCsrfCookie, clearCsrfCookie } = require('../../utils/csrf');

class AuthController {
  constructor() {
    this.authService = new AuthService();
    this.userRepository = new MongoUserRepository();
    this.vehicleRepository = new MongoVehicleRepository();
    this.tokenRepository = new MongoPasswordResetTokenRepository();
  }

  // POST /auth/login: autenticar usuario y establecer cookie httpOnly con JWT
  async login(req, res, next) {
    try {
      const { corporateEmail, password } = req.body;

      console.log(`[AuthController] Login attempt for email domain: ${corporateEmail?.split('@')[1] || 'unknown'} | IP: ${req.ip} | correlationId: ${req.correlationId}`);

      // Autenticar usuario mediante AuthService
      const { user, token } = await this.authService.authenticateUser(
        this.userRepository,
        corporateEmail,
        password
      );

      // Establecer cookie httpOnly con JWT (2 horas de expiración)
      const cookieMaxAge = 2 * 60 * 60 * 1000;

      res.cookie('access_token', token, {
        httpOnly: true,              // CRÍTICO: previene ataques XSS (JS no puede leer)
        secure: true,                // Requerir HTTPS siempre
        sameSite: 'none',            // Permitir cookies cross-site
        maxAge: cookieMaxAge,
        path: '/'
      });

      // Generar y establecer token CSRF (patrón double-submit cookie)
      const csrfToken = generateCsrfToken();
      setCsrfCookie(res, csrfToken);

      console.log(`[AuthController] Login successful | userId: ${user.id} | role: ${user.role} | correlationId: ${req.correlationId}`);

      // Retornar DTO mínimo (sin contraseña ni campos sensibles)
      const response = {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        corporateEmail: user.corporateEmail,
        profilePhotoUrl: user.profilePhoto || null
      };
      
      console.log('[AuthController] Response body:', response);
      
      res.status(200).json(response);

    } catch (error) {
      // Manejar credenciales inválidas
      if (error.code === 'invalid_credentials') {
        console.log(`[AuthController] Login failed | reason: invalid_credentials | IP: ${req.ip} | correlationId: ${req.correlationId}`);
        
        return res.status(401).json({
          code: 'invalid_credentials',
          message: 'Email or password is incorrect',
          correlationId: req.correlationId
        });
      }

      console.error(`[AuthController] Login error | correlationId: ${req.correlationId}`);

      return res.status(500).json({
        code: 'internal_error',
        message: 'An error occurred during login',
        correlationId: req.correlationId
      });
    }
  }

  // POST /auth/logout: limpiar cookie access_token (revocación de sesión)
  logout(req, res) {
    const userId = req.user?.id || req.user?.sub || 'anonymous';
    console.log(`[AuthController] Logout | userId: ${userId} | correlationId: ${req.correlationId}`);

    // Limpiar cookie access_token con los mismos atributos que cuando se estableció
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    });

    // También limpiar cookie CSRF
    clearCsrfCookie(res);

    res.status(200).json({
      ok: true
    });
  }

  // GET /auth/me: retornar identidad mínima del usuario para verificación de sesión
  async getMe(req, res) {
    try {
      const userId = req.user.id; // req.user establecido por middleware authenticate

      console.log(`[AuthController] GET /auth/me | userId: ${userId} | role: ${req.user.role} | correlationId: ${req.correlationId}`);

      // Obtener perfil mínimo del usuario con flag hasVehicle
      const profile = await this.authService.getCurrentUserProfile(
        this.userRepository,
        this.vehicleRepository,
        userId
      );

      // Establecer Cache-Control para prevenir caché de datos sensibles
      res.set('Cache-Control', 'no-store');

      console.log(`[AuthController] GET /auth/me success | userId: ${userId} | correlationId: ${req.correlationId}`);

      res.status(200).json(profile);

    } catch (error) {
      if (error.code === 'user_not_found') {
        console.error(`[AuthController] User not found (orphaned JWT?) | userId: ${req.user?.id} | correlationId: ${req.correlationId}`);
        
        return res.status(401).json({
          code: 'unauthorized',
          message: 'Missing or invalid session',
          correlationId: req.correlationId
        });
      }

      console.error(`[AuthController] GET /auth/me error | userId: ${req.user?.id} | correlationId: ${req.correlationId}`);

      return res.status(500).json({
        code: 'internal_error',
        message: 'An error occurred while fetching profile',
        correlationId: req.correlationId
      });
    }
  }

  // POST /auth/password/reset-request: solicitar restablecimiento de contraseña (sin sesión)
  async requestPasswordReset(req, res) {
    try {
      const { corporateEmail } = req.body;
      const clientIp = req.ip;
      const userAgent = req.get('User-Agent') || 'unknown';

      console.log(`[AuthController] Password reset requested | emailDomain: ${corporateEmail?.split('@')[1] || 'unknown'} | IP: ${clientIp} | correlationId: ${req.correlationId}`);

      // Solicitar restablecimiento mediante AuthService
      const result = await this.authService.requestPasswordReset(
        this.userRepository,
        this.tokenRepository,
        corporateEmail,
        clientIp,
        userAgent
      );

      // Si se generó token (usuario existe), loguearlo para MVP
      if (result.token) {
        const resetUrl = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/reset-password?token=${result.token}`;
        
        console.log(`[AuthController] Password reset URL generated | userId: ${result.user.id} | correlationId: ${req.correlationId}`);
        console.log(`[AuthController] Reset URL (MVP only): ${resetUrl}`);
      }

      // CRÍTICO: siempre retornar 200 con mensaje genérico (nunca revelar si el email existe)
      res.status(200).json({
        ok: true
      });

    } catch (error) {
      console.error(`[AuthController] Password reset request error | IP: ${req.ip} | correlationId: ${req.correlationId}`);

      return res.status(500).json({
        code: 'internal_error',
        message: 'An error occurred while processing your request',
        correlationId: req.correlationId
      });
    }
  }

  // POST /auth/password/reset: canjear token de restablecimiento y establecer nueva contraseña
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

      console.log(`[AuthController] Password reset attempt | IP: ${clientIp} | correlationId: ${req.correlationId}`);

      // Realizar restablecimiento mediante AuthService
      await this.authService.resetPassword(
        this.userRepository,
        this.tokenRepository,
        token,
        newPassword,
        clientIp
      );

      console.log(`[AuthController] Password reset successful | IP: ${clientIp} | correlationId: ${req.correlationId}`);
      
      res.status(200).json({
        ok: true
      });

    } catch (error) {
      if (error.code && error.statusCode) {
        console.log(`[AuthController] Password reset failed | code: ${error.code} | IP: ${req.ip} | correlationId: ${req.correlationId}`);
        
        return res.status(error.statusCode).json({
          code: error.code,
          message: error.message,
          correlationId: req.correlationId
        });
      }

      console.error(`[AuthController] Password reset error | IP: ${req.ip} | correlationId: ${req.correlationId}`);

      return res.status(500).json({
        code: 'internal_error',
        message: 'An error occurred while resetting your password',
        correlationId: req.correlationId
      });
    }
  }

  // PATCH /auth/password: cambiar contraseña del usuario autenticado (con sesión)
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.id || req.user?.sub;
      const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

      if (!userId) {
        console.error(`[AuthController] Password change without userId | correlationId: ${req.correlationId}`);
        return res.status(401).json({
          code: 'unauthorized',
          message: 'Authentication required',
          correlationId: req.correlationId
        });
      }

      console.log(`[AuthController] Password change attempt | userId: ${userId} | IP: ${clientIp} | correlationId: ${req.correlationId}`);

      // Realizar cambio mediante AuthService
      await this.authService.changePassword(
        this.userRepository,
        userId,
        currentPassword,
        newPassword,
        clientIp
      );

      console.log(`[AuthController] Password changed successfully | userId: ${userId} | IP: ${clientIp} | correlationId: ${req.correlationId}`);
      
      res.status(200).json({
        ok: true
      });

    } catch (error) {
      if (error.code && error.statusCode) {
        const userId = req.user?.id || req.user?.sub || 'unknown';
        console.log(`[AuthController] Password change failed | userId: ${userId} | code: ${error.code} | IP: ${req.ip} | correlationId: ${req.correlationId}`);
        
        return res.status(error.statusCode).json({
          code: error.code,
          message: error.message,
          correlationId: req.correlationId
        });
      }

      console.error(`[AuthController] Password change error | IP: ${req.ip} | correlationId: ${req.correlationId}`);

      return res.status(500).json({
        code: 'internal_error',
        message: 'An error occurred while changing your password',
        correlationId: req.correlationId
      });
    }
  }
}

module.exports = AuthController;

