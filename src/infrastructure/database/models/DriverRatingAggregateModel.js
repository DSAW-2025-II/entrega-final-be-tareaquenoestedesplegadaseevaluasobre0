/**
 * Modelo de agregado de calificaciones de conductor: almacena estadísticas agregadas de calificaciones.
 * Optimiza consultas de perfiles al evitar calcular promedios y histogramas desde reseñas individuales.
 */
const mongoose = require('mongoose');

// Schema para histograma de calificaciones (distribución de estrellas)
const histogramSchema = new mongoose.Schema({
  '1': { type: Number, default: 0 }, // Número de reseñas de 1 estrella
  '2': { type: Number, default: 0 }, // Número de reseñas de 2 estrellas
  '3': { type: Number, default: 0 }, // Número de reseñas de 3 estrellas
  '4': { type: Number, default: 0 }, // Número de reseñas de 4 estrellas
  '5': { type: Number, default: 0 } // Número de reseñas de 5 estrellas
}, { _id: false });

const driverRatingAggregateSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true }, // Un agregado por conductor
  avgRating: { type: Number, default: 0 }, // Calificación promedio (0-5)
  count: { type: Number, default: 0 }, // Número total de reseñas
  histogram: { type: histogramSchema, default: () => ({}) }, // Distribución de calificaciones
  updatedAt: { type: Date, default: Date.now } // Última actualización del agregado
}, { collection: 'driver_rating_aggregates' });

// Middleware pre-save: actualizar updatedAt automáticamente
driverRatingAggregateSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('DriverRatingAggregate', driverRatingAggregateSchema);
