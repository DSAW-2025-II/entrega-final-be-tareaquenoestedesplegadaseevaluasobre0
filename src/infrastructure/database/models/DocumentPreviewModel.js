/**
 * Modelo de vista previa de documento: almacena tokens temporales para que administradores vean documentos de verificación.
 * Permite acceso seguro y auditado a documentos sensibles con expiración automática.
 */
const mongoose = require('mongoose');

const documentPreviewSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true }, // Token único para acceso al documento
  driverId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // Conductor dueño del documento
  docType: { type: String, required: true, enum: ['govIdFront','govIdBack','driverLicense','soat'] }, // Tipo de documento
  createdBy: { type: String, required: true }, // ID del admin que creó el token
  createdAt: { type: Date, required: true, default: Date.now }, // Fecha de creación del token
  expiresAt: { type: Date, required: true }, // Fecha de expiración del token
  used: { type: Boolean, required: true, default: false }, // Si el token ya fue usado
  usedAt: { type: Date }, // Fecha de uso del token
  accessorIp: { type: String }, // IP que accedió al documento
  accessorUserAgent: { type: String } // User-Agent que accedió al documento
}, { timestamps: false });

module.exports = mongoose.model('DocumentPreview', documentPreviewSchema);
