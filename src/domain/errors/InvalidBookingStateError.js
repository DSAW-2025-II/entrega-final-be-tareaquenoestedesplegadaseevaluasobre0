/**
 * Error de estado de reserva inválido (US-4.1.1): se lanza al intentar crear una intención de pago
 * para una reserva que no está en estado 'accepted'.
 * 
 * Estado HTTP: 409 Conflict
 * Código de error: invalid_booking_state
 */

const DomainError = require('./DomainError');

class InvalidBookingStateError extends DomainError {
  constructor(message = 'Booking must be in accepted state to create payment', details = {}) {
    super(message, 409, 'invalid_booking_state', details);
  }
}

module.exports = InvalidBookingStateError;
