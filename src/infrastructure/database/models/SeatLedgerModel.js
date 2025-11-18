/**
 * Modelo de libro de asientos: rastrea asientos asignados por viaje para hacer cumplir restricciones de capacidad.
 * Previene sobreventa mediante operaciones atómicas.
 * 
 * Reglas de negocio:
 * - Una entrada de libro por viaje (tripId único)
 * - allocatedSeats nunca debe exceder totalSeats del viaje
 * - Todas las actualizaciones deben ser atómicas (usando findOneAndUpdate con condiciones)
 * - Se crea en la primera aceptación, se actualiza en aceptaciones subsecuentes
 * 
 * Seguridad ante condiciones de carrera:
 * - Usa findOneAndUpdate de MongoDB con guardas condicionales
 * - Garantiza exactamente un éxito cuando múltiples aceptaciones concurrentes compiten por el último asiento
 */

const mongoose = require('mongoose');

const seatLedgerSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripOffer',
      required: [true, 'Trip ID is required'],
      unique: true
    },
    allocatedSeats: {
      type: Number,
      required: [true, 'Allocated seats is required'],
      min: [0, 'Allocated seats cannot be negative'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Allocated seats must be an integer'
      }
    }
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
    collection: 'seat_ledgers'
  }
);

// ============================================
// INDEXES
// ============================================

/**
 * Índice único en tripId garantiza un libro por viaje.
 * Crítico para prevenir entradas duplicadas de libro.
 * NOTA: El índice ya se crea por "unique: true" en la definición del schema arriba.
 * No es necesario llamar explícitamente schema.index() para evitar advertencia de índice duplicado.
 */

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Verifica si hay capacidad para asignar más asientos.
 * @param {number} totalSeats - Total de asientos disponibles en el viaje
 * @param {number} requestedSeats - Número de asientos a asignar
 * @returns {boolean} True si la asignación es posible
 */
seatLedgerSchema.methods.hasCapacity = function (totalSeats, requestedSeats = 1) {
  return this.allocatedSeats + requestedSeats <= totalSeats;
};

/**
 * Obtiene asientos disponibles restantes.
 * @param {number} totalSeats - Total de asientos disponibles en el viaje
 * @returns {number} Número de asientos restantes
 */
seatLedgerSchema.methods.getRemainingSeats = function (totalSeats) {
  return Math.max(0, totalSeats - this.allocatedSeats);
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Incrementa atómicamente los asientos asignados para un viaje.
 * Seguro ante condiciones de carrera: usa findOneAndUpdate con guardas condicionales.
 * 
 * @param {string} tripId - ObjectId del viaje
 * @param {number} totalSeats - Total de asientos disponibles en el viaje
 * @param {number} seatsToAllocate - Número de asientos a asignar (por defecto 1)
 * @returns {Promise<Document|null>} Libro actualizado o null si se excedió la capacidad
 */
seatLedgerSchema.statics.allocateSeats = async function (
  tripId,
  totalSeats,
  seatsToAllocate = 1
) {
  // Paso 1: Intentar encontrar libro existente
  let ledger = await this.findOne({ tripId });

  if (!ledger) {
    // No existe libro - crear uno si tenemos capacidad
    if (seatsToAllocate <= totalSeats) {
      try {
        ledger = await this.create({
          tripId,
          allocatedSeats: seatsToAllocate
        });
        return ledger;
      } catch (error) {
        // Si error de clave duplicada (condición de carrera), reintentar la actualización
        if (error.code === 11000) {
          ledger = await this.findOne({ tripId });
          // Continuar con la lógica de actualización abajo
        } else {
          throw error;
        }
      }
    } else {
      // Los asientos solicitados exceden la capacidad total
      return null;
    }
  }

  // Paso 2: El libro existe - incremento atómico con guarda de capacidad
  const updatedLedger = await this.findOneAndUpdate(
    {
      tripId,
      allocatedSeats: { $lte: totalSeats - seatsToAllocate } // Guarda: asegurar capacidad
    },
    {
      $inc: { allocatedSeats: seatsToAllocate }
    },
    {
      new: true, // Retornar documento actualizado
      runValidators: true
    }
  );

  // Si updatedLedger es null, significa que la guarda de capacidad falló
  return updatedLedger;
};

/**
 * Obtiene el libro actual para un viaje (lo crea si no existe).
 * @param {string} tripId - ObjectId del viaje
 * @returns {Promise<Document>} Documento del libro
 */
seatLedgerSchema.statics.getOrCreateLedger = async function (tripId) {
  const ledger = await this.findOneAndUpdate(
    { tripId },
    { $setOnInsert: { allocatedSeats: 0 } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return ledger;
};

/**
 * Obtiene el libro para un viaje (retorna null si no existe).
 * @param {string} tripId - ObjectId del viaje
 * @returns {Promise<Document|null>} Documento del libro o null
 */
seatLedgerSchema.statics.getLedgerByTripId = async function (tripId) {
  return this.findOne({ tripId });
};

const SeatLedgerModel = mongoose.model('SeatLedger', seatLedgerSchema);

module.exports = SeatLedgerModel;

