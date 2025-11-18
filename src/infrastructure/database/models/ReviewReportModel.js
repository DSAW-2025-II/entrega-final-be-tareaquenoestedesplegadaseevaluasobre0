/**
 * Modelo de reporte de reseña: almacena reportes de reseñas realizados por usuarios.
 * Permite reportar reseñas inapropiadas, spam o fraudulentas para moderación.
 */
const mongoose = require('mongoose');

const reviewReportSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true // Reseña reportada
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true // Usuario que realiza el reporte
    },
    category: {
      type: String,
      enum: ['abuse', 'spam', 'fraud', 'other'],
      required: true,
      index: true // Categoría del reporte
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '' // Razón opcional del reporte
    },
    correlationId: {
      type: String,
      default: null,
      index: true // ID de correlación para rastreo y auditoría
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'review_reports'
  }
);

// Previene registros duplicados de reporte por usuario por reseña (un reporte por reporter por reseña)
reviewReportSchema.index({ reviewId: 1, reporterId: 1 }, { unique: true });

const ReviewReportModel = mongoose.model('ReviewReport', reviewReportSchema);

module.exports = ReviewReportModel;
