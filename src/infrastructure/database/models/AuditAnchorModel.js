/**
 * Modelo de ancla de auditoría: almacena anclas diarias para verificación de integridad de logs de auditoría.
 * Cada día se genera un ancla con HMAC de todos los logs del día, creando una cadena de integridad.
 */
const mongoose = require('mongoose');

const auditAnchorSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true, index: true }, // Fecha en formato YYYY-MM-DD
  hmac: { type: String, required: true }, // HMAC de todos los logs del día para verificación de integridad
  keyVersion: { type: String, required: false }, // Versión de la clave HMAC usada
  entries: { type: Number, required: false, default: 0 }, // Número de entradas de log del día
  createdAt: { type: Date, default: () => new Date() }, // Fecha de creación del ancla
  updatedAt: { type: Date, default: () => new Date() } // Fecha de última actualización
});

module.exports = mongoose.model('AuditAnchor', auditAnchorSchema);
