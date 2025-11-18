// DTO de creación de oferta de viaje: objeto de transferencia de datos para crear nueva oferta de viaje
class CreateTripOfferDto {
  constructor({
    vehicleId,
    origin,
    destination,
    departureAt,
    estimatedArrivalAt,
    pricePerSeat,
    totalSeats,
    status = 'published',
    notes = ''
  }) {
    this.vehicleId = vehicleId;
    this.origin = origin; // { text: string, geo: { lat: number, lng: number } }
    this.destination = destination; // Misma estructura
    this.departureAt = departureAt;
    this.estimatedArrivalAt = estimatedArrivalAt;
    this.pricePerSeat = pricePerSeat;
    this.totalSeats = totalSeats;
    this.status = status;
    this.notes = notes;
  }

  // Crear DTO desde body de request
  static fromRequest(body) {
    return new CreateTripOfferDto({
      vehicleId: body.vehicleId,
      origin: body.origin,
      destination: body.destination,
      departureAt: body.departureAt,
      estimatedArrivalAt: body.estimatedArrivalAt,
      pricePerSeat: body.pricePerSeat,
      totalSeats: body.totalSeats,
      status: body.status || 'published',
      notes: body.notes || ''
    });
  }

  // Validar estructura del DTO
  validate() {
    const errors = [];

    if (!this.vehicleId) {
      errors.push('vehicleId is required');
    }

    if (!this.origin || !this.origin.text || !this.origin.geo) {
      errors.push('origin with text and geo coordinates is required');
    } else {
      if (typeof this.origin.geo.lat !== 'number' || typeof this.origin.geo.lng !== 'number') {
        errors.push('origin.geo must have valid lat and lng numbers');
      }
    }

    if (!this.destination || !this.destination.text || !this.destination.geo) {
      errors.push('destination with text and geo coordinates is required');
    } else {
      if (typeof this.destination.geo.lat !== 'number' || typeof this.destination.geo.lng !== 'number') {
        errors.push('destination.geo must have valid lat and lng numbers');
      }
    }

    if (!this.departureAt) {
      errors.push('departureAt is required');
    }

    if (!this.estimatedArrivalAt) {
      errors.push('estimatedArrivalAt is required');
    }

    if (this.pricePerSeat === undefined || this.pricePerSeat === null) {
      errors.push('pricePerSeat is required');
    }

    if (this.totalSeats === undefined || this.totalSeats === null) {
      errors.push('totalSeats is required');
    }

    if (!['draft', 'published'].includes(this.status)) {
      errors.push('status must be draft or published on create');
    }

    return errors;
  }
}

module.exports = CreateTripOfferDto;
