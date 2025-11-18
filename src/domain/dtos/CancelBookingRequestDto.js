// DTO de cancelación de solicitud de reserva: objeto de transferencia de datos para cancelación de reserva iniciada por pasajero
// Soporta razón opcional para pista de auditoría
class CancelBookingRequestDto {
  constructor({ reason = '' }) {
    this.reason = reason?.trim() || '';
  }

  // Validar solicitud de cancelación: retorna array de mensajes de error (vacío si es válido)
  validate() {
    const errors = [];

    if (this.reason && this.reason.length > 500) {
      errors.push('Cancellation reason cannot exceed 500 characters');
    }

    return errors;
  }

  // Crear DTO desde body de request
  static fromRequest(body = {}) {
    return new CancelBookingRequestDto({
      reason: body.reason
    });
  }
}

module.exports = CancelBookingRequestDto;
