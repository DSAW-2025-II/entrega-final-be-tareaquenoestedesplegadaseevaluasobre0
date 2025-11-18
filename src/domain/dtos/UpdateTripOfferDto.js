// DTO de actualización de oferta de viaje: objeto de transferencia de datos para actualizar oferta de viaje existente
class UpdateTripOfferDto {
  constructor({ pricePerSeat, totalSeats, notes, status }) {
    // Solo incluir campos que están presentes
    if (pricePerSeat !== undefined) this.pricePerSeat = pricePerSeat;
    if (totalSeats !== undefined) this.totalSeats = totalSeats;
    if (notes !== undefined) this.notes = notes;
    if (status !== undefined) this.status = status;
  }

  // Crear DTO desde body de request
  static fromRequest(body) {
    return new UpdateTripOfferDto({
      pricePerSeat: body.pricePerSeat,
      totalSeats: body.totalSeats,
      notes: body.notes,
      status: body.status
    });
  }

  // Validar estructura del DTO
  validate() {
    const errors = [];

    if (this.pricePerSeat !== undefined && typeof this.pricePerSeat !== 'number') {
      errors.push('pricePerSeat must be a number');
    }

    if (this.totalSeats !== undefined && !Number.isInteger(this.totalSeats)) {
      errors.push('totalSeats must be an integer');
    }

    if (this.notes !== undefined && typeof this.notes !== 'string') {
      errors.push('notes must be a string');
    }

    if (this.status !== undefined && !['draft', 'published', 'canceled'].includes(this.status)) {
      errors.push('status must be draft, published, or canceled');
    }

    return errors;
  }

  // Verificar si el DTO tiene campos para actualizar
  hasUpdates() {
    return (
      this.pricePerSeat !== undefined ||
      this.totalSeats !== undefined ||
      this.notes !== undefined ||
      this.status !== undefined
    );
  }
}

module.exports = UpdateTripOfferDto;
