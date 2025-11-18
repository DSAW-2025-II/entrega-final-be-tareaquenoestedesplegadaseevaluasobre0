// Entidad de dominio TripOffer: representa oferta de viaje del conductor con origen, destino, horarios, precios y capacidad
const InvalidTransitionError = require('../errors/InvalidTransitionError');

class TripOffer {
  constructor({
    id,
    driverId,
    vehicleId,
    origin,
    destination,
    departureAt,
    estimatedArrivalAt,
    pricePerSeat,
    totalSeats,
    status = 'published',
    notes = '',
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.driverId = driverId;
    this.vehicleId = vehicleId;
    this.origin = origin; // { text: string, geo: { lat: number, lng: number } }
    this.destination = destination; // Misma estructura
    this.departureAt = departureAt instanceof Date ? departureAt : new Date(departureAt);
    this.estimatedArrivalAt = estimatedArrivalAt instanceof Date ? estimatedArrivalAt : new Date(estimatedArrivalAt);
    this.pricePerSeat = pricePerSeat;
    this.totalSeats = totalSeats;
    this.status = status;
    this.notes = notes;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Validar restricciones temporales
  validateTiming() {
    if (this.departureAt >= this.estimatedArrivalAt) {
      throw new Error('estimatedArrivalAt must be after departureAt');
    }
  }

  // Verificar si departureAt está en el futuro
  isDepartureInFuture() {
    return this.departureAt > new Date();
  }

  // Verificar si el viaje es editable
  isEditable() {
    return this.status !== 'canceled' && this.status !== 'completed' && this.status !== 'in_progress';
  }

  // Verificar si el viaje puede ser publicado
  canBePublished() {
    return this.status === 'draft' && this.isDepartureInFuture();
  }

  // Verificar si el viaje es cancelable: estados legales para cancelación son draft, published
  // No se puede cancelar: canceled (ya cancelado), completed (viaje finalizado)
  isCancelable() {
    return this.status === 'draft' || this.status === 'published';
  }

  // Verificar si el viaje puede ser cancelado (legacy; usar isCancelable en su lugar)
  // @deprecated Usar isCancelable() para guard de máquina de estados
  canBeCanceled() {
    return this.status === 'published' && this.isDepartureInFuture();
  }

  // Verificar si la transición de estado es válida
  canTransitionTo(newStatus) {
    const validTransitions = {
      draft: ['published', 'canceled'],
      published: ['canceled', 'in_progress'],
      in_progress: ['completed'],
      canceled: [], // Sin transiciones desde canceled
      completed: [] // Sin transiciones desde completed
    };

    return validTransitions[this.status]?.includes(newStatus) || false;
  }

  // Verificar si la ventana de tiempo del viaje se solapa con otro viaje
  overlapsWith(otherTrip) {
    // Verificar si [this.departureAt, this.estimatedArrivalAt] se solapa con [other.departureAt, other.estimatedArrivalAt]
    return (
      this.departureAt < otherTrip.estimatedArrivalAt &&
      this.estimatedArrivalAt > otherTrip.departureAt
    );
  }

  // Actualizar campos mutables
  update({ pricePerSeat, totalSeats, notes, status }) {
    if (pricePerSeat !== undefined) this.pricePerSeat = pricePerSeat;
    if (totalSeats !== undefined) this.totalSeats = totalSeats;
    if (notes !== undefined) this.notes = notes;
    if (status !== undefined) {
      if (!this.canTransitionTo(status)) {
        throw new Error(`Invalid status transition from ${this.status} to ${status}`);
      }
      this.status = status;
    }
    this.updatedAt = new Date();
  }

  // Cancelar el viaje: transiciones legales son published|draft → canceled
  // Lanza InvalidTransitionError si el estado actual no permite cancelación
  cancel() {
    if (!this.isCancelable()) {
      throw new InvalidTransitionError(
        `Cannot cancel trip with status: ${this.status}`,
        this.status,
        'canceled'
      );
    }
    this.status = 'canceled';
    this.updatedAt = new Date();
  }

  /**
   * Start the trip
   * Legal transitions: published → in_progress
   * Throws InvalidTransitionError if current state doesn't allow starting
   * 
   * @throws {InvalidTransitionError} if trip cannot be started from current state
   */
  startTrip() {
    if (!this.canTransitionTo('in_progress')) {
      throw new InvalidTransitionError(
        `Cannot start trip with status: ${this.status}`,
        this.status,
        'in_progress'
      );
    }
    this.status = 'in_progress';
    this.updatedAt = new Date();
  }

  /**
   * Complete the trip
   * Legal transitions: in_progress → completed
   * Throws InvalidTransitionError if current state doesn't allow completion
   * 
   * @throws {InvalidTransitionError} if trip cannot be completed from current state
   */
  completeTrip() {
    if (!this.canTransitionTo('completed')) {
      throw new InvalidTransitionError(
        `Cannot complete trip with status: ${this.status}`,
        this.status,
        'completed'
      );
    }
    this.status = 'completed';
    this.updatedAt = new Date();
  }
}

module.exports = TripOffer;
