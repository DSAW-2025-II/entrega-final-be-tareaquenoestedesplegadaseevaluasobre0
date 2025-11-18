// Modelo de solicitud de reserva: representa solicitud de pasajero para reservar asiento en viaje publicado
// Reglas de negocio: un pasajero solo puede tener UNA solicitud activa (pending/accepted) por viaje
// Estados: pending, accepted, declined, declined_auto, declined_by_admin, canceled_by_passenger, canceled_by_platform, expired
const mongoose = require('mongoose');

const bookingRequestSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripOffer',
      required: [true, 'Trip ID is required']
    },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Passenger ID is required']
    },
    status: {
      type: String,
      enum: {
        values: [
          'pending',
          'accepted',
          'declined',
          'declined_auto', // US-3.4.2: Auto-declined when driver cancels trip
          'declined_by_admin', // Admin manual decline
          'canceled_by_passenger',
          'canceled_by_platform', // US-3.4.2: Canceled when driver cancels trip
          'expired'
        ],
        message: 'Status must be one of: pending, accepted, declined, declined_auto, canceled_by_passenger, canceled_by_platform, expired'
      },
      default: 'pending',
      index: true
    },
    seats: {
      type: Number,
      required: [true, 'Number of seats is required'],
      min: [1, 'Must request at least 1 seat'],
      validate: {
        validator: Number.isInteger,
        message: 'Seats must be an integer'
      },
      default: 1
    },
    note: {
      type: String,
      trim: true,
      maxlength: [300, 'Note cannot exceed 300 characters'],
      default: ''
    },
    // Campos de pista de auditoría para decisiones del conductor
    acceptedAt: {
      type: Date,
      default: null
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    declinedAt: {
      type: Date,
      default: null
    },
    declinedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    declineReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Decline reason cannot exceed 500 characters'],
      default: ''
    },
    canceledAt: {
      type: Date,
      default: null
    },
    // Razón de cancelación opcional para cancelaciones iniciadas por pasajero
    // Usado para pista de auditoría y análisis
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
      default: ''
    },
    // Bandera interna para hooks de política de reembolso
    // Se establece en true cuando reserva cancelada es elegible para reembolso
    // Nunca expuesta en DTOs o respuestas de API
    refundNeeded: {
      type: Boolean,
      default: false,
      select: false // Exclude by default from queries (internal use only)
    },
    // Campos de pago
    paymentMethod: {
      type: String,
      enum: ['card', 'cash', null],
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed'],
      default: null,
      index: true // For filtering pending payments
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
      index: true
    },
    paidAt: {
      type: Date,
      default: null
    },
    // Bandera de estado de pago: se establece en true cuando la transacción de pago tiene éxito
    // Usado para sincronización de modelo de lectura y propósitos de visualización
    isPaid: {
      type: Boolean,
      default: false,
      index: true // For filtering paid/unpaid bookings
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    collection: 'booking_requests'
  }
);

// Índices compuestos para consultas eficientes
// Índice compuesto para consultas eficientes de pasajero: usado por GET /passengers/bookings, soporta ordenamiento por más reciente primero
bookingRequestSchema.index({ passengerId: 1, createdAt: -1 });

// Índice compuesto para consultas de viaje + estado: usado para ver solicitudes de viajes del conductor, también ayuda con detección de duplicados
bookingRequestSchema.index({ tripId: 1, status: 1 });

// Índice compuesto para detección de duplicados: usado por servicio para verificar si pasajero ya tiene solicitud activa para este viaje
bookingRequestSchema.index({ passengerId: 1, tripId: 1, status: 1 });

/**
 * Compound index for pending payments query
 * Used to find bookings with pending payments for a passenger
 */
bookingRequestSchema.index({ passengerId: 1, paymentStatus: 1 });

// Métodos de instancia
// Verificar si esta solicitud de reserva está activa (no cancelada/rechazada/expirada): estados activos son pending
bookingRequestSchema.methods.isActive = function () {
  return this.status === 'pending';
};

// Verificar si esta solicitud de reserva puede ser cancelada por pasajero: solo solicitudes 'pending' pueden ser canceladas
bookingRequestSchema.methods.canBeCanceledByPassenger = function () {
  return this.status === 'pending';
};

// Cancelar esta solicitud de reserva (iniciada por pasajero): idempotente, si ya está cancelada, no hay error
bookingRequestSchema.methods.cancelByPassenger = function () {
  if (this.status === 'canceled_by_passenger') {
    // Already canceled, idempotent - no-op
    return this;
  }

  if (!this.canBeCanceledByPassenger()) {
    throw new Error(`Cannot cancel booking with status: ${this.status}`);
  }

  this.status = 'canceled_by_passenger';
  this.canceledAt = new Date();
  return this;
};

// Métodos estáticos
// Encontrar reserva activa (pending o accepted) para un pasajero en un viaje específico: usado para prevenir reservas activas duplicadas
bookingRequestSchema.statics.findActiveBooking = async function (passengerId, tripId) {
  return this.findOne({
    passengerId,
    tripId,
    status: { $in: ['pending', 'accepted'] }
  });
};

/**
 * Count active bookings for a trip (for capacity checking - future use)
 */
bookingRequestSchema.statics.countActiveBookingsForTrip = async function (tripId) {
  return this.countDocuments({
    tripId,
    status: 'pending'
  });
};

/**
 * Find bookings by passenger with filters
 */
bookingRequestSchema.statics.findByPassenger = async function (
  passengerId,
  { status, page = 1, limit = 10 } = {}
) {
  const query = { passengerId };
  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }

  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .populate('tripId', 'origin destination departureAt estimatedArrivalAt pricePerSeat status')
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    bookings,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

// ============================================
// PRE-SAVE HOOKS
// ============================================

/**
 * Pre-save validation and business rules
 */
bookingRequestSchema.pre('save', function (next) {
  // Ensure canceledAt is set when status is canceled_by_passenger
  if (this.status === 'canceled_by_passenger' && !this.canceledAt) {
    this.canceledAt = new Date();
  }

  // Clear canceledAt if status is not a canceled state
  if (!this.status.includes('canceled') && this.canceledAt) {
    this.canceledAt = null;
  }

  next();
});

const BookingRequestModel = mongoose.model('BookingRequest', bookingRequestSchema);

module.exports = BookingRequestModel;

