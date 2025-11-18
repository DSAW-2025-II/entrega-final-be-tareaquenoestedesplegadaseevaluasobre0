/**
 * Modelo de verificación de conductor: almacena documentos y estado de verificación de conductores.
 * Rastrea el proceso de verificación desde envío hasta aprobación/rechazo por administradores.
 */
const mongoose = require('mongoose');

// Schema para documentos individuales (cédula, licencia, SOAT)
const docSchema = new mongoose.Schema({
  storagePath: { type: String, required: true }, // Ruta de almacenamiento del archivo
  hash: { type: String, required: true }, // Hash del documento para integridad
  uploadedAt: { type: Date, required: true }, // Fecha de carga
  expiresAt: { type: Date, required: false } // Fecha de expiración (para SOAT)
}, { _id: false });

const driverVerificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true }, // Un perfil por usuario
  status: { type: String, enum: ['unverified','pending_review','verified','rejected','expired'], default: 'unverified' }, // Estado de verificación
  fullName: { type: String, required: false }, // Nombre completo del conductor
  documentNumberHash: { type: String, required: false }, // Hash del número de documento (privacidad)
  documents: {
    govIdFront: { type: docSchema, required: false }, // Frente de cédula
    govIdBack: { type: docSchema, required: false }, // Reverso de cédula
    driverLicense: { type: docSchema, required: false }, // Licencia de conducción
    soat: { type: docSchema, required: false } // SOAT del vehículo
  },
  licenseNumberHash: { type: String, required: false }, // Hash del número de licencia
  soatNumberHash: { type: String, required: false }, // Hash del número de SOAT
  submittedAt: { type: Date, required: false }, // Fecha de envío de documentos
  lastUpdatedAt: { type: Date, required: false }, // Última actualización
  adminNotes: [{ adminId: String, notes: String, createdAt: Date }], // Notas de administradores durante revisión
  // Metadatos de revisión
  decisionAt: { type: Date, required: false }, // Fecha de decisión (aprobación/rechazo)
  reviewedBy: { type: String, required: false }, // ID del admin que revisó
  rejectionReason: { type: String, required: false }, // Razón de rechazo (si aplica)
  // Historial de recordatorios para evitar envíos duplicados por ventana (ej: '30d','7d','1d')
  remindersSent: [{ window: String, sentAt: Date }]
}, { timestamps: true });

module.exports = mongoose.model('DriverVerification', driverVerificationSchema);
