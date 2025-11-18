// Servicio de auditoría: registra acciones de administradores en logs de auditoría con cadena de hashes y anclas diarias
// Usa SHA-256 para hashes y HMAC para anclas diarias incrementales
const AuditLogModel = require('../../infrastructure/database/models/AuditLogModel');
const AuditAnchor = require('../../infrastructure/database/models/AuditAnchorModel');
const crypto = require('crypto');

class AuditService {
  // Registrar acción de admin como entrada de log de auditoría: crea entrada con hash encadenado y actualiza ancla diaria HMAC
  static async recordAdminAction({ action, entity, entityId = null, who = null, before = {}, after = {}, why = '', req = null }) {
    

    const when = new Date();
    const entryBase = {
      action,
      entity,
      entityId,
      who,
      when,
      what: { before, after },
      why: why || '',
      correlationId: req && req.correlationId ? req.correlationId : null,
      ip: req && (req.ip || (req.headers && req.headers['x-forwarded-for'])) ? (req.ip || req.headers['x-forwarded-for']) : null,
      userAgent: req && req.headers ? req.headers['user-agent'] : null
    };

    try {
      // Obtener hash anterior (cadena global) - mejor esfuerzo
      const prev = await AuditLogModel.findOne({}, { hash: 1 }).sort({ when: -1 }).lean();
      const prevHash = prev && prev.hash ? prev.hash : null;

      // Calcular contenido para hashing (orden determinístico)
      const toHash = JSON.stringify({ action: entryBase.action, entity: entryBase.entity, entityId: entryBase.entityId, who: entryBase.who, when: entryBase.when.toISOString(), what: entryBase.what, why: entryBase.why, correlationId: entryBase.correlationId, ip: entryBase.ip, userAgent: entryBase.userAgent, prevHash });
      const hash = crypto.createHash('sha256').update(toHash).digest('hex');

      const entry = Object.assign({}, entryBase, { prevHash, hash });

      await AuditLogModel.create(entry);

      // Actualizar ancla diaria (HMAC incremental): usa variable de entorno AUDIT_HMAC_SECRET
      const secret = process.env.AUDIT_HMAC_SECRET || 'dev_audit_secret';
      const dateKey = when.toISOString().slice(0,10); // YYYY-MM-DD

      // Obtener ancla existente para la fecha
      const existing = await AuditAnchor.findOne({ date: dateKey }).lean();
      const prevDaily = existing && existing.hmac ? existing.hmac : '';
      const hmac = crypto.createHmac('sha256', secret).update(prevDaily + hash).digest('hex');

      // Upsert ancla
      await AuditAnchor.findOneAndUpdate({ date: dateKey }, { date: dateKey, hmac, updatedAt: new Date(), createdAt: existing ? existing.createdAt : new Date() }, { upsert: true, new: true });

    } catch (err) {
      console.error('[AuditService] Failed to write audit entry or anchor:', err && err.message);
    }
  }

  // Generar ancla diaria para fecha dada (YYYY-MM-DD): si no se proporciona, usa fecha UTC de hoy
  // Algoritmo de ancla: iterar entradas de la fecha en orden cronológico y calcular HMAC incremental (secret, prevDaily + hash)
  // donde prevDaily es la ancla almacenada del día anterior (o cadena vacía si no hay)
  static async generateDailyAnchor({ dateKey = null } = {}) {
    const secret = process.env.AUDIT_HMAC_SECRET || 'dev_audit_secret';
    const keyVersion = process.env.AUDIT_HMAC_KEY_VERSION || 'kv1';

    const day = dateKey || new Date().toISOString().slice(0,10);
    const dayStart = new Date(`${day}T00:00:00.000Z`);
    const nextDay = new Date(new Date(dayStart).getTime() + 24*60*60*1000);

    // Ancla del día anterior (string) usada como punto de partida
    const prevDayDate = new Date(dayStart.getTime() - 24*60*60*1000).toISOString().slice(0,10);
    const prevAnchorDoc = await AuditAnchor.findOne({ date: prevDayDate }).lean();
    let runningDaily = prevAnchorDoc && prevAnchorDoc.hmac ? prevAnchorDoc.hmac : '';

    // Obtener entradas del día ordenadas por ts ascendente
    const cursor = AuditLogModel.find({ ts: { $gte: dayStart, $lt: nextDay } }).sort({ ts: 1 }).cursor();
    let lastHash = null;
    let count = 0;

    for await (const doc of cursor) {
      const hash = doc.hash;
      if (!hash) continue;
      // Actualizar HMAC diario incremental
      runningDaily = crypto.createHmac('sha256', secret).update(runningDaily + hash).digest('hex');
      lastHash = hash;
      count += 1;
    }

    // Upsert ancla para el día
    const anchorValue = runningDaily;
    const now = new Date();
  await AuditAnchor.findOneAndUpdate({ date: day }, { date: day, hmac: anchorValue, keyVersion, entries: count, updatedAt: now, createdAt: now }, { upsert: true, new: true });

  return { day, anchor: `${keyVersion}:${anchorValue}`, entries: count };
  }

  // Verificar integridad para un rango de fechas (inclusivo): retorna { verified: boolean, breaks: Array }
  // Cada break es { type: 'hash_mismatch'|'anchor_mismatch'|'missing_anchor', date, id?, detail }
  static async verifyIntegrity({ from, to }) {
    const secret = process.env.AUDIT_HMAC_SECRET || 'dev_audit_secret';

  // Accept both string dates (YYYY-MM-DD) and Joi-coerced Date objects
  const fromDate = (from instanceof Date) ? new Date(new Date(from).toISOString().slice(0,10) + 'T00:00:00.000Z') : new Date(`${from}T00:00:00.000Z`);
  const toDate = (to instanceof Date) ? new Date(new Date(to).toISOString().slice(0,10) + 'T00:00:00.000Z').getTime() + 24*60*60*1000 : new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24*60*60*1000);
  // If toDate is a number (ms), normalize to Date
  const toDateObj = (typeof toDate === 'number') ? new Date(toDate) : toDate;

    // Fetch anchors map for days in range and previous day
    const days = [];
    for (let d = new Date(fromDate); d < toDateObj; d = new Date(d.getTime() + 24*60*60*1000)) {
      days.push(d.toISOString().slice(0,10));
    }
    const prevDay = new Date(fromDate.getTime() - 24*60*60*1000).toISOString().slice(0,10);

    const anchorsDocs = await AuditAnchor.find({ date: { $in: [prevDay, ...days] } }).lean();
    const anchorsByDate = {};
    for (const a of anchorsDocs) anchorsByDate[a.date] = a;

    // Fetch all audit entries in the range sorted by ts asc
  const entries = await AuditLogModel.find({ ts: { $gte: fromDate, $lt: toDateObj } }).sort({ ts: 1 }).lean();

    const breaks = [];
    let prevComputedHash = null;

    // runningDaily map: initialize per day with previous day's anchor.hmac or ''
    const runningDailyByDay = {};
    for (const day of days) {
      const prev = anchorsByDate[new Date(new Date(day).getTime() - 24*60*60*1000).toISOString().slice(0,10)];
      runningDailyByDay[day] = prev && prev.hmac ? prev.hmac : '';
    }

    for (const e of entries) {
      // recompute hash based on canonical shape - best-effort: use stored fields
      const canonicalObj = {
        actor: e.actor || { type: null, id: null },
        action: e.action || null,
        entity: e.entity || { type: null, id: null },
        ts: e.ts ? (e.ts instanceof Date ? e.ts.toISOString() : String(e.ts)) : new Date().toISOString(),
        delta: e.delta || e.what || null,
        reason: e.reason || null,
        correlationId: e.correlationId || null,
        ip: e.ip || null,
        userAgent: e.userAgent || null,
        prevHash: prevComputedHash || null
      };

      const recomputed = crypto.createHash('sha256').update(JSON.stringify(canonicalObj)).digest('hex');
      if (recomputed !== e.hash) {
        breaks.push({ type: 'hash_mismatch', id: (e._id || e.id).toString(), ts: e.ts, detail: 'Stored hash does not match recomputed hash' });
        // stop early on hash mismatch
        return { verified: false, breaks };
      }

      // update prevComputedHash
      prevComputedHash = recomputed;

      // update running daily hmac for the entry's day
      const dayKey = (e.ts instanceof Date ? e.ts.toISOString().slice(0,10) : new Date(e.ts).toISOString().slice(0,10));
      if (!(dayKey in runningDailyByDay)) {
        // if this day wasn't in requested days (could be boundary) initialize from previous anchor
        const prev = anchorsByDate[new Date(new Date(dayKey).getTime() - 24*60*60*1000).toISOString().slice(0,10)];
        runningDailyByDay[dayKey] = prev && prev.hmac ? prev.hmac : '';
      }
      runningDailyByDay[dayKey] = crypto.createHmac('sha256', secret).update(runningDailyByDay[dayKey] + recomputed).digest('hex');
    }

    // After processing entries, compare per-day anchors
    for (const day of days) {
      const computed = runningDailyByDay[day] || '';
      const stored = anchorsByDate[day] && anchorsByDate[day].hmac ? anchorsByDate[day].hmac : null;
      if (!stored) {
        breaks.push({ type: 'missing_anchor', date: day, detail: 'No stored anchor for day' });
        continue;
      }
      if (computed !== stored) {
        breaks.push({ type: 'anchor_mismatch', date: day, detail: 'Computed anchor does not match stored anchor' });
      }
    }

    return { verified: breaks.length === 0, breaks };
  }
}

module.exports = AuditService;
