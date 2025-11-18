// Entidad de dominio SeatLedger: rastrea asientos asignados por viaje para aplicación atómica de capacidad
// Encapsula lógica de negocio para asignación y disponibilidad de asientos
class SeatLedger {
  constructor({
    id,
    tripId,
    allocatedSeats = 0,
    bookedPassengers = [],
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.tripId = tripId;
    this.allocatedSeats = allocatedSeats;
    this.bookedPassengers = bookedPassengers; // Array de { bookingRequestId, passengerId, seats, acceptedAt }
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;

    this.validate();
  }

  // Validar invariantes del ledger de asientos
  validate() {
    if (!this.tripId) {
      throw new Error('Trip ID is required');
    }

    if (!Number.isInteger(this.allocatedSeats) || this.allocatedSeats < 0) {
      throw new Error('Allocated seats must be a non-negative integer');
    }
  }

  // Verificar si hay capacidad para asignar asientos
  hasCapacity(totalSeats, requestedSeats = 1) {
    return this.allocatedSeats + requestedSeats <= totalSeats;
  }

  // Obtener asientos disponibles restantes
  getRemainingSeats(totalSeats) {
    return Math.max(0, totalSeats - this.allocatedSeats);
  }

  // Calcular porcentaje de utilización
  getUtilizationPercentage(totalSeats) {
    if (totalSeats === 0) return 0;
    return Math.round((this.allocatedSeats / totalSeats) * 100);
  }

  // Verificar si el viaje está completamente reservado
  isFullyBooked(totalSeats) {
    return this.allocatedSeats >= totalSeats;
  }

  // Crear representación de objeto plano (para persistencia en base de datos)
  toObject() {
    return {
      id: this.id,
      tripId: this.tripId,
      allocatedSeats: this.allocatedSeats,
      bookedPassengers: this.bookedPassengers,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = SeatLedger;
