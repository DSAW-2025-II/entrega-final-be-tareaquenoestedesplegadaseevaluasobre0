/**
 * Modelo de evidencia: almacena metadatos de archivos de evidencia subidos para moderación.
 * Usado para adjuntar archivos (imágenes, documentos) a notas de moderación y reportes.
 */
const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  evidenceId: { type: String, required: true, unique: true, index: true }, // ID único de la evidencia
  filename: { type: String, required: true }, // Nombre del archivo original
  contentType: { type: String, required: true }, // Tipo MIME del archivo
  storagePath: { type: String, default: null }, // Ruta de almacenamiento (null hasta que se suba)
  uploadToken: { type: String, default: null }, // Token temporal para subida segura
  uploadExpiresAt: { type: Date, default: null }, // Fecha de expiración del token de subida
  createdAt: { type: Date, default: Date.now }, // Fecha de creación del registro
  uploadedAt: { type: Date, default: null } // Fecha de subida real del archivo
});

module.exports = mongoose.model('Evidence', evidenceSchema);
