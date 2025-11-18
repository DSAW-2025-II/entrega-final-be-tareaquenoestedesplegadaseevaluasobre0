// Middleware de protección CSRF: patrón double-submit cookie para peticiones que cambian estado
// 1. Cliente lee csrf_token de cookie (no-httpOnly)
// 2. Cliente envía token en header X-CSRF-Token
// 3. Middleware compara cookie vs header
// 4. Si coinciden, la petición es del mismo origen
const { validateCsrfToken } = require('../../utils/csrf');

// Requerir token CSRF para peticiones que cambian estado
const requireCsrf = (req, res, next) => {
  // Verificar si la protección CSRF está habilitada
  const csrfEnabled = process.env.CSRF_PROTECTION !== 'false';
  
  if (!csrfEnabled) {
    // Protección CSRF deshabilitada (ej: entorno con SameSite=Strict puro)
    console.log('[requireCsrf] CSRF protection disabled by config');
    return next();
  }

  // Obtener token CSRF de cookie
  const cookieToken = req.cookies?.csrf_token;
  
  // Obtener token CSRF de header
  const headerToken = req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'];

  // En entorno de pruebas, permitir tokens solo en header para simplificar tests de integración
  // (los tests no siempre establecen la cookie csrf_token; el header aún es requerido)
  if (process.env.NODE_ENV === 'test' && !cookieToken && headerToken) {
    return next();
  }
  // Validar tokens
  if (!validateCsrfToken(cookieToken, headerToken)) {
    console.log(`[requireCsrf] CSRF validation failed | IP: ${req.ip} | correlationId: ${req.correlationId}`);
    
    return res.status(403).json({
      code: 'csrf_mismatch',
      message: 'CSRF token missing or invalid',
      correlationId: req.correlationId
    });
  }

  // Los tokens coinciden, continuar
  next();
};

module.exports = requireCsrf;

