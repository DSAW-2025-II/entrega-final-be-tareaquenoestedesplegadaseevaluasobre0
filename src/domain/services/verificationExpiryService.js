const DriverVerification = require('../../infrastructure/database/models/DriverVerificationModel');
const InAppNotification = require('../../infrastructure/database/models/InAppNotificationModel');

// Servicio de expiración de verificación: ejecuta escaneo de expiración sobre perfiles de verificación de conductores
// - Cambia verified -> expired cuando la licencia o SOAT expiran
// - Envía recordatorios en ventanas configuradas (días antes de la expiración)
// Retorna: { processed, newlyExpired, remindersSent: { '30d': n, '7d': n, '1d': n } }
class VerificationExpiryService {
  constructor() {}

  async runExpiryScan({ windowsDays = [30, 7, 1], now = new Date() } = {}) {
    const processed = { count: 0 };
    let newlyExpired = 0;
    const remindersSent = {};
    // Normalizar ventanas a números y ordenar descendente
    const windows = Array.from(new Set(windowsDays.map(d => parseInt(d, 10)).filter(Boolean))).sort((a,b) => b - a);
    windows.forEach(w => { remindersSent[`${w}d`] = 0; });

    // Buscar todos los perfiles verificados
    const cursor = DriverVerification.find({ status: 'verified' }).cursor();
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      processed.count += 1;

      // Determinar la expiración más temprana entre licencia de conducir y SOAT
      const licenseExpiry = doc.documents && doc.documents.driverLicense && doc.documents.driverLicense.expiresAt ? new Date(doc.documents.driverLicense.expiresAt) : null;
      const soatExpiry = doc.documents && doc.documents.soat && doc.documents.soat.expiresAt ? new Date(doc.documents.soat.expiresAt) : null;
      const expiries = [licenseExpiry, soatExpiry].filter(Boolean);
      if (expiries.length === 0) {
        // Sin información de expiración; saltar
        continue;
      }

      const nearestExpiry = new Date(Math.min.apply(null, expiries.map(d => d.getTime())));

      if (now > nearestExpiry) {
        // Expirado -> marcar como expirado
        doc.status = 'expired';
        doc.lastUpdatedAt = now;
        // Agregar nota de admin
        doc.adminNotes = (doc.adminNotes || []).concat([{ adminId: 'system', notes: 'Auto-expired by expiry scan', createdAt: now }]);
        await doc.save();
        newlyExpired += 1;
        continue;
      }

      // Calcular días hasta la expiración (redondeo hacia arriba)
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysUntil = Math.ceil((nearestExpiry.getTime() - now.getTime()) / msPerDay);

      // Para cada ventana, si está dentro de la ventana y no se envió ya, enviar recordatorio
      for (const w of windows) {
          const key = `${w}d`;
          if (daysUntil <= w) {
            // Verificar recordatorios enviados en el documento
            const already = (doc.remindersSent || []).some(r => r.window === key);
            if (!already) {
              // Enviar recordatorio en la app
            try {
              await InAppNotification.create({ userId: doc.userId, type: 'driver.verification.reminder', title: 'Verification expiring soon', body: `Your verification documents expire in ${daysUntil} day(s). Please renew.`, data: { daysUntil, window: key } });
            } catch (e) { console.warn('[VerificationExpiryService] Failed to create in-app reminder', e && e.message); }

            // Registrar recordatorio
            doc.remindersSent = (doc.remindersSent || []).concat([{ window: key, sentAt: now }]);
            remindersSent[key] = (remindersSent[key] || 0) + 1;
            // Guardar actualización única para persistir recordatorio
            try { await doc.save(); } catch (e) { console.warn('[VerificationExpiryService] failed saving reminder mark', e && e.message); }
          }
        }
      }
    }

    return { processed: processed.count, newlyExpired, remindersSent };
  }
}

module.exports = new VerificationExpiryService();
