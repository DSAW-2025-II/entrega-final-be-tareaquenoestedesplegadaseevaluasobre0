const { v4: uuidv4 } = require('uuid');
const AuthService = require('../../domain/services/AuthService');

// Middleware de contexto de request: adjunta req.id (UUID v4) y header de respuesta X-Request-Id
// Deriva actor desde cookie access_token cuando está presente (best-effort)
// Para rutas internas (cron/webhooks) sin JWT válido -> actor: system
// Asegura que req.correlationId use req.id como fallback para que logs estructurados y auditorías compartan el mismo id
module.exports = async function requestContext(req, res, next) {
  try {
    // ID de request
    const id = uuidv4();
    req.id = id;
    // Exponer header
    res.setHeader('X-Request-Id', id);

    // Asegurar que correlationId existe y usa request id como fallback
    if (!req.correlationId) req.correlationId = id;

    // Intentar derivar actor desde cookie access_token (best-effort)
    const token = req.cookies && req.cookies.access_token;
    if (token) {
      try {
        const auth = new AuthService();
        const decoded = auth.verifyAccessToken(token);
        // Mapear rol a tipo de actor
        const actorType = (decoded && decoded.role && String(decoded.role).toLowerCase() === 'admin') ? 'admin' : 'user';
        req.actor = {
          type: actorType,
          id: decoded.sub || null,
          roles: decoded.role ? [decoded.role] : []
        };
      } catch (err) {
        // Token inválido -> solo mapear a 'system' cuando el request es ruta interna de webhook/cron
        const path = (req.path || '').toLowerCase();
        if (path.startsWith('/internal') || path.startsWith('/notifications') || path.startsWith('/cron') || path.includes('/webhook')) {
          req.actor = { type: 'system', id: 'system', roles: ['system'] };
        } else {
          // Dejar req.actor undefined para requests anónimos
          req.actor = null;
        }
      }
    } else {
      // No hay token presente: si es ruta interna, establecer actor system
      const path = (req.path || '').toLowerCase();
      if (path.startsWith('/internal') || path.startsWith('/notifications') || path.startsWith('/cron') || path.includes('/webhook')) {
        req.actor = { type: 'system', id: 'system', roles: ['system'] };
      } else {
        req.actor = null;
      }
    }

    // Expose small helper to easily inject correlationId into audit payloads and structured logs
    req.withCorrelation = (payload) => {
      if (!payload || typeof payload !== 'object') return { correlationId: req.correlationId };
      return Object.assign({}, payload, { correlationId: req.correlationId });
    };

    next();
  } catch (err) {
    // Non-fatal: attach minimal defaults and continue
    req.id = req.id || uuidv4();
    if (!req.correlationId) req.correlationId = req.id;
    req.actor = req.actor || null;
    req.withCorrelation = (payload) => Object.assign({}, payload || {}, { correlationId: req.correlationId });
    next();
  }
};
