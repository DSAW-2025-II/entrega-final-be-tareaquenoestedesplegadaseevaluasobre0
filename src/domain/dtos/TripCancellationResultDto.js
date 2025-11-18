// DTO de resultado de cancelación de viaje: objeto de transferencia de datos para efectos en cascada de cancelación de viaje
// Proporciona resumen de reservas afectadas y reembolsos activados
class TripCancellationResultDto {
  constructor({
    id,
    status,
    effects
  }) {
    this.id = id;
    this.status = status;
    this.effects = {
      declinedAuto: effects.declinedAuto || 0,
      canceledByPlatform: effects.canceledByPlatform || 0,
      refundsCreated: effects.refundsCreated || 0,
      ledgerReleased: effects.ledgerReleased || 0
    };
  }

  // Crear DTO desde resultado de cancelación
  static fromCancellationResult(tripId, tripStatus, cascadeEffects) {
    return new TripCancellationResultDto({
      id: tripId,
      status: tripStatus,
      effects: cascadeEffects
    });
  }
}

module.exports = TripCancellationResultDto;
