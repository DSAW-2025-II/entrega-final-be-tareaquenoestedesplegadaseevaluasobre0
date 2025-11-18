/**
 * Modelo de log de auditoría: registra acciones administrativas y cambios importantes del sistema.
 * Inmutable (solo append): las entradas no se pueden modificar ni eliminar para mantener integridad.
 * Incluye cadena de hashes para verificación de integridad.
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // Acción realizada (ej: 'suspend_user', 'force_cancel_trip')
    entity: { type: String, required: true }, // Tipo de entidad afectada (ej: 'user', 'trip')
    entityId: { type: mongoose.Schema.Types.Mixed, required: false }, // ID de la entidad afectada
    // Almacena identificador del actor como string (puede ser ObjectId hex o ID externo)
    who: { type: String, required: false }, // Quién realizó la acción (admin ID o 'system')
    when: { type: Date, required: true, default: () => new Date() }, // Cuándo se realizó
    what: { type: mongoose.Schema.Types.Mixed, default: {} }, // Snapshots antes/después o datos de cambio
    why: { type: String, default: '' }, // Razón de la acción (requerida para acciones de admin)
    correlationId: { type: String, default: null }, // ID de correlación para rastreo
    ip: { type: String, default: null }, // IP del request
    userAgent: { type: String, default: null }, // User-Agent del request
    prevHash: { type: String, default: null }, // Hash de la entrada anterior (cadena de integridad)
    hash: { type: String, default: null, index: true } // Hash de esta entrada
  },
  {
    timestamps: false, // No usar timestamps automáticos, usar campo 'when' manual
    collection: 'audit_logs'
  }
);

// Solo append: no permitir actualizaciones vía APIs convencionales.
// No podemos hacer cumplir inmutabilidad a nivel de base de datos fácilmente aquí,
// pero confiamos en convenciones de aplicación y tests para asegurar que las entradas solo se crean.

const AuditLogModel = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLogModel;
