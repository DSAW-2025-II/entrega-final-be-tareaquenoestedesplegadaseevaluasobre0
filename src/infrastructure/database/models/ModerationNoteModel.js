/**
 * Modelo de nota de moderación: almacena notas creadas por administradores durante la revisión de reportes.
 * Vincula notas a entidades específicas (usuario, viaje, reserva) con evidencia y razones.
 */
const mongoose = require('mongoose');

const moderationNoteSchema = new mongoose.Schema({
  entity: { type: String, enum: ['user','trip','booking'], required: true, index: true }, // Tipo de entidad moderada
  entityId: { type: String, required: true, index: true }, // ID de la entidad moderada
  category: { type: String, required: true }, // Categoría de la nota (ej: 'suspension', 'warning')
  reason: { type: String, required: true }, // Razón de la moderación
  evidence: [{ type: String }], // Array de IDs de evidencia (archivos adjuntos)
  createdBy: { type: String, required: true }, // ID del admin que creó la nota
  createdAt: { type: Date, default: Date.now } // Fecha de creación
}, { timestamps: false });

module.exports = mongoose.model('ModerationNote', moderationNoteSchema);
