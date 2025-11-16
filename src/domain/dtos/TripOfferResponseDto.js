/**
 * Trip Offer Response DTO
 * Data Transfer Object for public API responses
 * Strict, leak-free mapping
 */
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

    // Include driver info if populated
    if (populatedDoc?.driverId && typeof populatedDoc.driverId === 'object') {
      this.driver = {
        id: populatedDoc.driverId._id?.toString() || populatedDoc.driverId.id,
        firstName: populatedDoc.driverId.firstName,
        lastName: populatedDoc.driverId.lastName,
        profilePhotoUrl: populatedDoc.driverId.profilePhoto || null
      };
    }

    // Include vehicle info if populated
    if (populatedDoc?.vehicleId && typeof populatedDoc.vehicleId === 'object') {
      this.vehicle = {
        id: populatedDoc.vehicleId._id?.toString() || populatedDoc.vehicleId.id,
        brand: populatedDoc.vehicleId.brand,
        model: populatedDoc.vehicleId.model,
        plate: populatedDoc.vehicleId.plate || null
      };
    }
  }

  /**
   * Create response DTO from domain entity
   */
  static fromDomain(tripOffer) {
    if (!tripOffer) return null;
    return new TripOfferResponseDto(tripOffer);
  }

  /**
   * Create response DTO from domain entity with populated driver/vehicle info
   */
  static fromDomainWithPopulated(tripOffer, populatedDoc) {
    if (!tripOffer) return null;
    return new TripOfferResponseDto(tripOffer, populatedDoc);
  }

  /**
   * Create response DTO directly from populated Mongoose document
   */
  static fromPopulatedDoc(doc) {
    if (!doc) return null;
    
    // Create a minimal tripOffer-like object from the document
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

  /**
   * Create array of response DTOs from domain entities
   */
  static fromDomainArray(tripOffers) {
    return tripOffers.map((trip) => TripOfferResponseDto.fromDomain(trip));
  }
}

module.exports = TripOfferResponseDto;
