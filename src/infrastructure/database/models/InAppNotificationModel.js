/**
 * Modelo de notificación en la aplicación: almacena notificaciones enviadas a usuarios dentro de la app.
 * Soporta diferentes tipos de notificaciones con datos personalizados y seguimiento de lectura.
 */
const mongoose = require('mongoose');

const inAppNotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Índice para consultas por usuario
  },
  type: {
    type: String,
    required: true,
    trim: true // Tipo de notificación (ej: 'booking.accepted', 'trip.reminder')
  },
  title: {
    type: String,
    required: true,
    trim: true // Título de la notificación
  },
  body: {
    type: String,
    default: '',
    trim: true // Cuerpo opcional de la notificación
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {} // Datos adicionales personalizados (ej: tripId, bookingId)
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true // Índice para filtrar notificaciones no leídas
  },
  correlationId: {
    type: String,
    default: null // ID de correlación para rastreo y auditoría
  }
}, {
  timestamps: { createdAt: true, updatedAt: true },
  strict: true
});

// Índice compuesto para consultas de feed (usuario + fecha de creación descendente)
// Optimiza la obtención de notificaciones ordenadas por fecha para un usuario
inAppNotificationSchema.index({ userId: 1, createdAt: -1 });

const InAppNotificationModel = mongoose.model('InAppNotification', inAppNotificationSchema);

module.exports = InAppNotificationModel;
