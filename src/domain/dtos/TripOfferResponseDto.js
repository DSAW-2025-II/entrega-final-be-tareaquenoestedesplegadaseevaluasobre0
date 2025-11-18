// DTO de respuesta de oferta de viaje: objeto de transferencia de datos para respuestas públicas de API
// Mapeo estricto sin filtraciones de datos
class TripOfferResponseDto {
  constructor(tripOffer, populatedDoc = null) {
    this.id = tripOffer.id;
    this.driverId = tripOffer.driverId;
    this.vehicleId = tripOffer.vehicleId;
    this.origin = {
      text: tripOffer.origin.text,
      geo: {
        lat: tripOffer.origin.geo.lat,
        lng: tripOffer.origin.geo.lng
      }
    };
    this.destination = {
      text: tripOffer.destination.text,
      geo: {
        lat: tripOffer.destination.geo.lat,
        lng: tripOffer.destination.geo.lng
      }
    };
    this.departureAt = tripOffer.departureAt.toISOString();
    this.estimatedArrivalAt = tripOffer.estimatedArrivalAt.toISOString();
    this.pricePerSeat = tripOffer.pricePerSeat;
    this.totalSeats = tripOffer.totalSeats;
    this.status = tripOffer.status;
    this.notes = tripOffer.notes || '';
    this.createdAt = tripOffer.createdAt?.toISOString();
    this.updatedAt = tripOffer.updatedAt?.toISOString();

    // Incluir información del conductor si está poblada
    if (populatedDoc?.driverId && typeof populatedDoc.driverId === 'object') {
      this.driver = {
        id: populatedDoc.driverId._id?.toString() || populatedDoc.driverId.id,
        firstName: populatedDoc.driverId.firstName,
        lastName: populatedDoc.driverId.lastName,
        profilePhotoUrl: populatedDoc.driverId.profilePhoto || null
      };
    }

    // Incluir información del vehículo si está poblada
    if (populatedDoc?.vehicleId && typeof populatedDoc.vehicleId === 'object') {
      this.vehicle = {
        id: populatedDoc.vehicleId._id?.toString() || populatedDoc.vehicleId.id,
        brand: populatedDoc.vehicleId.brand,
        model: populatedDoc.vehicleId.model,
        plate: populatedDoc.vehicleId.plate || null
      };
    }
  }

  // Crear DTO de respuesta desde entidad de dominio
  static fromDomain(tripOffer) {
    if (!tripOffer) return null;
    return new TripOfferResponseDto(tripOffer);
  }

  // Crear DTO de respuesta desde entidad de dominio con información poblada de conductor/vehículo
  static fromDomainWithPopulated(tripOffer, populatedDoc) {
    if (!tripOffer) return null;
    return new TripOfferResponseDto(tripOffer, populatedDoc);
  }

  // Crear DTO de respuesta directamente desde documento Mongoose poblado
  static fromPopulatedDoc(doc) {
    if (!doc) return null;
    
    // Crear objeto mínimo tipo tripOffer desde el documento
    const tripOffer = {
      id: doc._id.toString(),
      driverId: doc.driverId?._id?.toString() || doc.driverId?.toString() || doc.driverId,
      vehicleId: doc.vehicleId?._id?.toString() || doc.vehicleId?.toString() || doc.vehicleId,
      origin: doc.origin,
      destination: doc.destination,
      departureAt: doc.departureAt,
      estimatedArrivalAt: doc.estimatedArrivalAt,
      pricePerSeat: doc.pricePerSeat,
      totalSeats: doc.totalSeats,
      status: doc.status,
      notes: doc.notes || '',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
    
    return new TripOfferResponseDto(tripOffer, doc);
  }

  // Crear array de DTOs de respuesta desde entidades de dominio
  static fromDomainArray(tripOffers) {
    return tripOffers.map((trip) => TripOfferResponseDto.fromDomain(trip));
  }
}

module.exports = TripOfferResponseDto;
