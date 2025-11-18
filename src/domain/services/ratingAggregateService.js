const mongoose = require('mongoose');
const ReviewModel = require('../../infrastructure/database/models/ReviewModel');
const DriverRatingAggregate = require('../../infrastructure/database/models/DriverRatingAggregateModel');

// Servicio de agregación de calificaciones: recalcula agregados de calificaciones de conductores
class RatingAggregateService {
  // Recalcular agregados para un conductor escaneando reseñas visibles y actualizando el documento agregado
  // Si se proporciona una sesión, el upsert se ejecuta dentro de esa sesión
  static async recomputeAggregate(driverId, session = null) {
    // Agregación: hacer match de reseñas visibles para el conductor, agrupar por calificación
    const driverObjId = mongoose.Types.ObjectId.isValid(driverId) ? new mongoose.Types.ObjectId(driverId) : driverId;
    const pipeline = [
      { $match: { driverId: driverObjId, status: 'visible' } },
      { $group: { _id: '$rating', count: { $sum: 1 }, sumRating: { $sum: '$rating' } } }
    ];

    const results = await ReviewModel.aggregate(pipeline).exec();

    // Construir histograma y calcular totales
    const histogram = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let total = 0;
    let sum = 0;
    for (const r of results) {
      const key = String(r._id);
      if (histogram.hasOwnProperty(key)) {
        histogram[key] = r.count;
        total += r.count;
        sum += r._id * r.count;
      }
    }

    const avg = total === 0 ? 0 : Math.round((sum / total) * 10) / 10; // one decimal

    const update = {
      driverId,
      avgRating: avg,
      count: total,
      histogram,
      updatedAt: new Date()
    };

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

    if (session) {
      return DriverRatingAggregate.findOneAndUpdate({ driverId }, update, { ...opts, session }).lean();
    }

    return DriverRatingAggregate.findOneAndUpdate({ driverId }, update, opts).lean();
  }

  // Obtener documento agregado; si falta, recalcular sobre la marcha
  static async getAggregate(driverId) {
    let agg = await DriverRatingAggregate.findOne({ driverId }).lean();
    if (!agg) {
      agg = await this.recomputeAggregate(driverId);
    }
    return agg;
  }
}

module.exports = RatingAggregateService;
