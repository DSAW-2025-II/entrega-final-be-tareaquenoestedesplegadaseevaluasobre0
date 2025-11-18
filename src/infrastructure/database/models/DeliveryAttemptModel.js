/**
 * Modelo de intento de entrega: almacena eventos de webhook de proveedores de notificación.
 * Registra cada evento recibido (delivered, bounced, etc.) para análisis y debugging.
 */
const mongoose = require('mongoose');

const deliveryAttemptSchema = new mongoose.Schema({
  providerMessageId: { type: String, required: true, index: true }, // ID del mensaje del proveedor
  providerEventId: { type: String, default: null }, // ID único del evento del proveedor
  eventType: { type: String, required: true }, // Tipo de evento (ej: 'delivered', 'bounced', 'opened')
  recipientRedacted: { type: String, default: null }, // Destinatario redactado (privacidad)
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // Metadatos estructurados del evento
  raw: { type: mongoose.Schema.Types.Mixed, default: {} } // Payload crudo del webhook para debugging
}, { timestamps: true });

// Índice único en providerMessageId (sparse permite nulls para eventos sin mensaje asociado)
deliveryAttemptSchema.index({ providerMessageId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('DeliveryAttempt', deliveryAttemptSchema);
