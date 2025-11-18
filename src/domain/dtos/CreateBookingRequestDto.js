// DTO de creación de solicitud de reserva: objeto de transferencia de datos para crear nueva solicitud de reserva
// Valida entrada del pasajero antes de pasar a la capa de servicio
class CreateBookingRequestDto {
  constructor({ tripId, seats = 1, note = '', paymentMethod = null }) {
    this.tripId = tripId;
    this.seats = seats;
    this.note = note;
    this.paymentMethod = paymentMethod; // 'card' o 'cash' o null
  }

  // Validar campos del DTO: lanza Error si la validación falla
  validate() {
    const errors = [];

    // Validación de ID de viaje
    if (!this.tripId) {
      errors.push('tripId is required');
    } else if (typeof this.tripId !== 'string') {
      errors.push('tripId must be a string');
    } else if (!/^[a-f\d]{24}$/i.test(this.tripId)) {
      errors.push('tripId must be a valid MongoDB ObjectId');
    }

    // Validación de asientos
    if (this.seats === undefined || this.seats === null) {
      errors.push('seats is required');
    } else if (!Number.isInteger(this.seats)) {
      errors.push('seats must be an integer');
    } else if (this.seats < 1) {
      errors.push('seats must be at least 1');
    }

    // Validación de nota (opcional)
    if (this.note !== undefined && this.note !== null) {
      if (typeof this.note !== 'string') {
        errors.push('note must be a string');
      } else if (this.note.length > 300) {
        errors.push('note cannot exceed 300 characters');
      }
    }

    // Validación de método de pago (opcional)
    if (this.paymentMethod !== undefined && this.paymentMethod !== null) {
      if (typeof this.paymentMethod !== 'string') {
        errors.push('paymentMethod must be a string');
      } else if (!['card', 'cash'].includes(this.paymentMethod)) {
        errors.push('paymentMethod must be either "card" or "cash"');
      }
    }

    if (errors.length > 0) {
      const error = new Error('Validation failed');
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    return true;
  }

  // Crear DTO desde body de request
  static fromRequest(body) {
    return new CreateBookingRequestDto({
      tripId: body.tripId,
      seats: body.seats !== undefined ? Number(body.seats) : 1,
      note: body.note || '',
      paymentMethod: body.paymentMethod || null
    });
  }
}

module.exports = CreateBookingRequestDto;

