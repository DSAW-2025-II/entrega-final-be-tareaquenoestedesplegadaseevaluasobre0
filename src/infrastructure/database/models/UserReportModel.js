/**
 * Modelo de reporte de usuario: almacena reportes de usuarios realizados por otros usuarios.
 * Permite a los pasajeros reportar conductores (y viceversa) por comportamiento inapropiado.
 */
const mongoose = require('mongoose');

const userReportSchema = new mongoose.Schema(
  {
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true // Usuario reportado
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true // Usuario que realiza el reporte
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripOffer',
      required: true,
      index: true // Viaje relacionado al reporte
    },
    category: {
      type: String,
      enum: ['abuse', 'harassment', 'fraud', 'no_show', 'unsafe_behavior', 'other'],
      required: true,
      index: true // Categoría del reporte
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '' // Razón opcional del reporte
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending',
      index: true // Estado del reporte (pendiente, revisado, resuelto)
    },
    correlationId: {
      type: String,
      default: null,
      index: true // ID de correlación para rastreo y auditoría
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'user_reports'
  }
);

// Previene registros duplicados de reporte por usuario por viaje (un reporte por reporter por usuario por viaje)
userReportSchema.index({ reportedUserId: 1, reporterId: 1, tripId: 1 }, { unique: true });

const UserReportModel = mongoose.model('UserReport', userReportSchema);

module.exports = UserReportModel;

