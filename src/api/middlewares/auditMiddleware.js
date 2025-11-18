// Middleware de auditoría: adjunta helper res.audit(session, payload) para escribir eventos de auditoría
const auditWriter = require('../../domain/services/auditWriter');

function auditMiddleware(req, res, next) {
  res.audit = async function(session, payload) {
    // Permitir llamar solo con payload (sin session): res.audit(payload)
    if (!payload && session) {
      payload = session;
      session = null;
    }
    const merged = Object.assign({}, payload || {});
    if (session) merged.session = session;
    
    // Adjuntar metadatos de nivel de petición si no se proporcionaron
    if (!merged.ip) merged.ip = req.ip || (req.headers && req.headers['x-forwarded-for']);
    if (!merged.userAgent) merged.userAgent = req.get ? req.get('user-agent') : (req.headers && req.headers['user-agent']);
    if (!merged.correlationId) merged.correlationId = req.correlationId || null;
    
    // Si actor no se proporcionó, intentar usar actor resuelto desde requestContext
    if (!merged.actor && typeof req.actor !== 'undefined' && req.actor !== null) merged.actor = req.actor;

    return auditWriter.write(merged);
  };

  next();
}

module.exports = auditMiddleware;
