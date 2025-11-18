// DTO de resultado de cancelación de reserva: objeto de transferencia de datos para efectos de cancelación de reserva
// Proporciona resumen de desasignación de asientos y estado de reembolso
class BookingCancellationResultDto {
  constructor({
    id,
    status,
    effects
  }) {
    this.id = id;
    this.status = status;
    this.effects = {
      ledgerReleased: effects.ledgerReleased || 0,
      refundCreated: effects.refundCreated || false
    };
  }

  // Crear DTO desde resultado de cancelación
  static fromCancellationResult(bookingId, bookingStatus, cancellationEffects) {
    return new BookingCancellationResultDto({
      id: bookingId,
      status: bookingStatus,
      effects: cancellationEffects
    });
  }
}

module.exports = BookingCancellationResultDto;
