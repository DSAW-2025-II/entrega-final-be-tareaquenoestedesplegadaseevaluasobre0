const AuditLogModel = require('../../infrastructure/database/models/AuditLogModel');
const crypto = require('crypto');

/**
 * Canonicaliza payload de auditoría en string JSON determinístico para hashing.
 * Garantiza que el mismo payload siempre produzca el mismo hash.
 */
function canonicalizeForHash({ actor, action, entity, ts, delta, reason, correlationId, ip, userAgent, prevHash }) {
  // Construir objeto ordenado
  const obj = {
    actor: { type: actor && actor.type ? actor.type : null, id: actor && actor.id ? actor.id : null },
    action: action || null,
    entity: { type: entity && entity.type ? entity.type : null, id: entity && entity.id ? entity.id : null },
    ts: ts ? (ts instanceof Date ? ts.toISOString() : String(ts)) : new Date().toISOString(),
    delta: delta || null,
    reason: reason || null,
    correlationId: correlationId || null,
    ip: ip || null,
    userAgent: userAgent || null,
    prevHash: prevHash || null
  };
  return JSON.stringify(obj);
}

/**
 * Obtiene el hash más reciente del log de auditoría para construir la cadena de integridad.
 * Si se proporciona una sesión, busca dentro de esa transacción para consistencia.
 */
async function getLatestHash(session) {
  try {
    const prev = await AuditLogModel.findOne({}, { hash: 1 }).sort({ ts: -1 }).session(session).lean();
    return prev && prev.hash ? prev.hash : null;
  } catch (err) {
    // best-effort: si falla, retornar null (la cadena se reconstruirá desde el hash anterior disponible)
    return null;
  }
}

/**
 * Escribe una entrada de auditoría. Si se proporciona una sesión, la escritura se hará dentro de ella.
 * payload: { session, actor:{type,id}, action, entity:{type,id}, reason, delta, ip, userAgent, correlationId, meta }
 */
async function write(payload) {
  const { session, actor, action, entity, reason, delta, ip, userAgent, correlationId, meta } = payload || {};

  // Hacer cumplir razón para escrituras de admin
  if (actor && actor.type === 'admin' && (!reason || String(reason).trim().length === 0)) {
    const err = new Error('reason required for admin audit entries');
    err.code = 'invalid_schema';
    throw err;
  }

  const ts = new Date();

  // Determinar hash anterior (best-effort) dentro de la sesión proporcionada para que la cadena sea consistente cuando sea posible
  const prevHash = await getLatestHash(session);

  const canonical = canonicalizeForHash({ actor, action, entity, ts, delta, reason, correlationId, ip, userAgent, prevHash });
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');

  // Calcular hmacDay por día para verificación rápida (HMAC(secret, date+hash))
  const secret = process.env.AUDIT_HMAC_SECRET || 'dev_audit_secret';
  const dateKey = ts.toISOString().slice(0, 10);
  const hmacDay = crypto.createHmac('sha256', secret).update(dateKey + hash).digest('hex');

  const entry = {
    ts,
    actor: { type: actor && actor.type ? actor.type : null, id: actor && actor.id ? actor.id : null },
    action,
    // Mantener nueva forma (objetos actor/entity) pero también poblar campos legacy para compatibilidad
    entity: { type: entity && entity.type ? entity.type : null, id: entity && entity.id ? entity.id : null },
    reason: reason || null,
    delta: delta || null,
    ip: ip || null,
    userAgent: userAgent || null,
    correlationId: correlationId || null,
    prevHash: prevHash || null,
    hash,
    hmacDay,
    meta: meta || {}
  };

  // Poblar campos legacy del modelo de auditoría (algunos caminos de código aún dependen de la forma antigua)
  // AuditLogModel schema espera: action (string), entity (string), entityId, who, when, what, why
  try {
    entry.entity = entity && entity.type ? String(entity.type) : (typeof entity === 'string' ? entity : null);
    entry.entityId = entity && entity.id ? entity.id : null;
    entry.who = actor && actor.id ? String(actor.id) : null;
    entry.when = ts;
    // Mapear delta a legacy `what.after` para compatibilidad
    entry.what = { after: delta || null };
    entry.why = reason || '';
  } catch (e) {
    // ignorar errores de mapeo (best-effort compatibility)
  }

  // Persistir dentro de la sesión si se proporciona
  if (session) {
    return AuditLogModel.create([entry], { session });
  }

  return AuditLogModel.create(entry);
}

module.exports = { write };
