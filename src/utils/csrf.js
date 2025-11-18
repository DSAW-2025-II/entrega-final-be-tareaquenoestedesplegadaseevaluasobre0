// Utilidades de token CSRF: patrón double-submit cookie para protección CSRF
// 1. En login, generar token aleatorio
// 2. Guardarlo en cookie no-httpOnly (legible por JS)
// 3. Cliente lee cookie y lo envía en header X-CSRF-Token
// 4. Servidor compara header vs cookie
// 5. Si coinciden, la petición es del mismo origen (protegida CSRF)
const crypto = require('crypto');

// Generar token CSRF aleatorio (32 bytes = 64 caracteres hex)
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Validar token CSRF comparando cookie y header
function validateCsrfToken(cookieToken, headerToken) {
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Comparación timing-safe para prevenir ataques de timing
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  } catch (error) {
    // Si las longitudes no coinciden, Buffer.from fallará
    return false;
  }
}

// Establecer cookie CSRF en la respuesta
function setCsrfCookie(res, token, options = {}) {
  res.cookie('csrf_token', token, {
    httpOnly: false,           // CRÍTICO: debe ser legible por JS
    secure: true,              // Requerir HTTPS siempre
    sameSite: 'none',          // Permitir cookies cross-site (necesario para diferentes dominios)
    maxAge: 2 * 60 * 60 * 1000, // 2 horas (igual que expiración JWT)
    path: '/',
    ...options
  });
}

// Limpiar cookie CSRF
function clearCsrfCookie(res) {
  res.clearCookie('csrf_token', {
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/'
  });
}

module.exports = {
  generateCsrfToken,
  validateCsrfToken,
  setCsrfCookie,
  clearCsrfCookie
};

