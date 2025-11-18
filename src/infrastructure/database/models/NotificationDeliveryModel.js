/**
 * Modelo de entrega de notificación: rastrea el estado de entrega de notificaciones enviadas a proveedores externos (email).
 * Vincula notificaciones en la app con mensajes del proveedor y eventos de webhook.
 */
const mongoose = require('mongoose');

const notificationDeliverySchema = new mongoose.Schema({
  providerMessageId: { type: String, required: true, unique: true, index: true }, // ID del mensaje del proveedor (ej: SendGrid)
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InAppNotification', default: null }, // Notificación en la app relacionada
  status: { type: String, enum: ['pending','sent','delivered','bounced','complained','dropped','failed'], default: 'pending' }, // Estado de entrega
  attempts: { type: Number, default: 0 }, // Número de intentos de entrega
  lastEventAt: { type: Date, default: null }, // Fecha del último evento recibido
  processedEvents: { type: [String], default: [] }, // Eventos de webhook ya procesados (evitar duplicados)
  meta: { type: mongoose.Schema.Types.Mixed, default: {} } // Metadatos adicionales del proveedor
}, { timestamps: true });

// providerMessageId ya está indexado vía la definición del campo (unique: true)
// evitar declaraciones de índice duplicadas

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);
