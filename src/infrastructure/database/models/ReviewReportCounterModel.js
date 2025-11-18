/**
 * Modelo de contador de reportes de reseña: agrega conteos de reportes por categoría para cada reseña.
 * Optimiza consultas de moderación al evitar contar reportes individuales repetidamente.
 */
const mongoose = require('mongoose');

const reviewReportCounterSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true // Reseña reportada
    },
    category: {
      type: String,
      enum: ['abuse', 'spam', 'fraud', 'other'],
      required: true,
      index: true // Categoría del reporte
    },
    count: {
      type: Number,
      default: 0 // Número de reportes de esta categoría para esta reseña
    }
  },
  {
    timestamps: { updatedAt: true, createdAt: false }, // Solo updatedAt (no createdAt)
    collection: 'review_report_counters'
  }
);

// Único por (reseña, categoría) - un contador por combinación
reviewReportCounterSchema.index({ reviewId: 1, category: 1 }, { unique: true });

const ReviewReportCounterModel = mongoose.model('ReviewReportCounter', reviewReportCounterSchema);

module.exports = ReviewReportCounterModel;
