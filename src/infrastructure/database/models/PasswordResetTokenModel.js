/**
 * Modelo de token de restablecimiento de contraseña: colección dedicada para tokens con seguimiento completo.
 * 
 * Diseño:
 * - Separado del modelo User para mejor seguridad y auditabilidad
 * - Rastrea IP, User-Agent para forensia de seguridad
 * - Campo consumedAt permite consumo idempotente del token
 * - Indexado para búsquedas rápidas y limpieza automática
 * 
 * Seguridad:
 * - tokenHash es SHA-256 del token en texto plano (nunca almacenar texto plano)
 * - expiresAt permite expiración automática
 * - consumedAt previene reutilización del token
 */

const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true // Búsquedas rápidas por usuario
  },
  tokenHash: {
    type: String,
    required: [true, 'Token hash is required'],
    unique: true, // Prevenir tokens duplicados
    index: true // Búsquedas rápidas por token
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: true // Habilitar limpieza TTL y verificaciones de expiración
  },
  consumedAt: {
    type: Date,
    default: null // null = no consumido, Date = timestamp de consumo
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true // Nunca permitir modificación
  },
  createdIp: {
    type: String,
    default: null,
    trim: true // IP del request que generó el token
  },
  createdUa: {
    type: String,
    default: null,
    trim: true // User-Agent del request que generó el token
  }
}, {
  timestamps: false, // Gestionamos createdAt manualmente, no necesitamos updatedAt
  strict: true, // Rechazar campos indefinidos
  strictQuery: false
});

// Índice compuesto para búsqueda y validación eficiente de tokens
passwordResetTokenSchema.index({ tokenHash: 1, expiresAt: 1 });

// Índice para consultas de limpieza (encontrar tokens expirados, no consumidos)
passwordResetTokenSchema.index({ expiresAt: 1, consumedAt: 1 });

// Índice para consultas específicas de usuario (invalidar todos los tokens de un usuario)
passwordResetTokenSchema.index({ userId: 1, consumedAt: 1 });

// Índice TTL: eliminar documentos automáticamente 24 horas después de la expiración
// Esto mantiene la colección limpia sin trabajos de limpieza manuales
passwordResetTokenSchema.index(
  { expiresAt: 1 },
  { 
    expireAfterSeconds: 86400, // 24 horas después de expiresAt
    name: 'ttl_expired_tokens'
  }
);

// Virtual: verifica si el token está expirado
passwordResetTokenSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Virtual: verifica si el token está consumido
passwordResetTokenSchema.virtual('isConsumed').get(function() {
  return this.consumedAt !== null;
});

// Virtual: verifica si el token es válido (no expirado, no consumido)
passwordResetTokenSchema.virtual('isValid').get(function() {
  return !this.isExpired && !this.isConsumed;
});

// Método de instancia: marca el token como consumido (idempotente)
passwordResetTokenSchema.methods.consume = async function() {
  if (!this.consumedAt) {
    this.consumedAt = new Date();
    await this.save();
  }
  return this;
};

// Método estático: limpia tokens expirados manualmente (si es necesario)
passwordResetTokenSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

// Método estático: cuenta tokens activos para un usuario
passwordResetTokenSchema.statics.countActiveForUser = async function(userId) {
  return await this.countDocuments({
    userId,
    expiresAt: { $gt: new Date() },
    consumedAt: null
  });
};

const PasswordResetTokenModel = mongoose.model('PasswordResetToken', passwordResetTokenSchema);

module.exports = PasswordResetTokenModel;
