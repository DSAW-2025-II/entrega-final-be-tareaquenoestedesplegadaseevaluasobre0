/**
 * Modelo de métricas de notificación: agrega métricas diarias de notificaciones por tipo y canal.
 * Optimiza consultas de estadísticas y dashboards administrativos.
 */
const mongoose = require('mongoose');

const notificationMetricSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true }, // Fecha en formato YYYY-MM-DD
  type: { type: String, required: true, index: true }, // Tipo de notificación (ej: 'booking.accepted')
  channel: { type: String, required: true, index: true }, // Canal de entrega (ej: 'email', 'in_app')
  rendered: { type: Number, default: 0 }, // Número de notificaciones renderizadas
  attempted: { type: Number, default: 0 }, // Número de intentos de envío
  delivered: { type: Number, default: 0 }, // Número de entregas exitosas
  bounced: { type: Number, default: 0 }, // Número de rebotes (emails inválidos)
  complained: { type: Number, default: 0 }, // Número de quejas (spam)
  skippedByPreferences: { type: Number, default: 0 } // Número omitidas por preferencias del usuario
}, { timestamps: true });

// Índice único por (fecha, tipo, canal) - una métrica por combinación
notificationMetricSchema.index({ date: 1, type: 1, channel: 1 }, { unique: true });

module.exports = mongoose.model('NotificationMetric', notificationMetricSchema);
