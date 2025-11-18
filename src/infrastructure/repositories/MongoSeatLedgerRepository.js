/**
 * Repositorio de libro de asientos MongoDB: implementación de operaciones de libro de asientos.
 * Proporciona operaciones atómicas y seguras ante condiciones de carrera para asignación de asientos.
 */

const SeatLedgerModel = require('../database/models/SeatLedgerModel');

class MongoSeatLedgerRepository {
  /**
   * Asigna asientos atómicamente para un viaje.
   * Seguro ante condiciones de carrera: usa actualización condicional para prevenir sobreasignación.
   * 
   * @param {string} tripId - ObjectId del viaje
   * @param {number} totalSeats - Total de asientos disponibles en el viaje
   * @param {number} seatsToAllocate - Número de asientos a asignar
   * @returns {Promise<Object|null>} Libro actualizado o null si se excedió la capacidad
   */
  async allocateSeats(tripId, totalSeats, seatsToAllocate = 1) {
    const ledger = await SeatLedgerModel.allocateSeats(tripId, totalSeats, seatsToAllocate);
    
    if (!ledger) {
      return null; // Capacidad excedida
    }

    return {
      tripId: ledger.tripId.toString(),
      allocatedSeats: ledger.allocatedSeats,
      remainingSeats: totalSeats - ledger.allocatedSeats,
      updatedAt: ledger.updatedAt
    };
  }

  /**
   * Desasigna asientos atómicamente para un viaje (libera capacidad).
   * Seguro ante condiciones de carrera: usa actualización condicional para prevenir asignación negativa.
   * Usado cuando un pasajero cancela una reserva aceptada.
   * 
   * @param {string} tripId - ObjectId del viaje
   * @param {number} seatsToDeallocate - Número de asientos a liberar (por defecto 1)
   * @returns {Promise<Object|null>} Libro actualizado o null si resultaría negativo
   */
  async deallocateSeats(tripId, seatsToDeallocate = 1) {
    // Guarda: no se puede desasignar de un libro inexistente
    const ledger = await SeatLedgerModel.findOne({ tripId });
    if (!ledger) {
      console.warn(`[SeatLedgerRepository] No ledger found for trip ${tripId}; cannot deallocate`);
      return null;
    }

    // Guarda: prevenir allocatedSeats negativo
    if (ledger.allocatedSeats < seatsToDeallocate) {
      console.warn(
        `[SeatLedgerRepository] Cannot deallocate ${seatsToDeallocate} seats from trip ${tripId}; only ${ledger.allocatedSeats} allocated`
      );
      return null;
    }

    // Decremento atómico con guarda de negativos
    const updatedLedger = await SeatLedgerModel.findOneAndUpdate(
      {
        tripId,
        allocatedSeats: { $gte: seatsToDeallocate } // Guarda: asegurar que no se vuelva negativo
      },
      {
        $inc: { allocatedSeats: -seatsToDeallocate } // Decrementar atómicamente
      },
      {
        new: true, // Retornar documento actualizado
        runValidators: true
      }
    );

    if (!updatedLedger) {
      // Condición de carrera: otra operación cambió el libro entre nuestra verificación y actualización
      console.warn(`[SeatLedgerRepository] Race condition prevented deallocation for trip ${tripId}`);
      return null;
    }

    return {
      tripId: updatedLedger.tripId.toString(),
      allocatedSeats: updatedLedger.allocatedSeats,
      updatedAt: updatedLedger.updatedAt
    };
  }

  /**
   * Obtiene la asignación actual para un viaje.
   * Crea el libro si no existe.
   * 
   * @param {string} tripId - ObjectId del viaje
   * @returns {Promise<Object>} Estado actual del libro
   */
  async getOrCreateLedger(tripId) {
    const ledger = await SeatLedgerModel.getOrCreateLedger(tripId);

    return {
      tripId: ledger.tripId.toString(),
      allocatedSeats: ledger.allocatedSeats,
      updatedAt: ledger.updatedAt
    };
  }

  /**
   * Obtiene el libro para un viaje (retorna null si no existe).
   * 
   * @param {string} tripId - ObjectId del viaje
   * @returns {Promise<Object|null>} Libro o null
   */
  async getLedgerByTripId(tripId) {
    const ledger = await SeatLedgerModel.getLedgerByTripId(tripId);
    
    if (!ledger) {
      return null;
    }

    return {
      tripId: ledger.tripId.toString(),
      allocatedSeats: ledger.allocatedSeats,
      updatedAt: ledger.updatedAt
    };
  }

  /**
   * Verifica si el viaje tiene capacidad para asientos.
   * 
   * @param {string} tripId - ObjectId del viaje
   * @param {number} totalSeats - Total de asientos en el viaje
   * @param {number} requestedSeats - Asientos solicitados
   * @returns {Promise<boolean>} True si tiene capacidad
   */
  async hasCapacity(tripId, totalSeats, requestedSeats = 1) {
    const ledger = await SeatLedgerModel.getLedgerByTripId(tripId);
    
    if (!ledger) {
      // Sin libro significa que aún no hay asignaciones
      return requestedSeats <= totalSeats;
    }

    return ledger.allocatedSeats + requestedSeats <= totalSeats;
  }

  /**
   * Obtiene asientos restantes para un viaje.
   * 
   * @param {string} tripId - ObjectId del viaje
   * @param {number} totalSeats - Total de asientos en el viaje
   * @returns {Promise<number>} Asientos restantes
   */
  async getRemainingSeats(tripId, totalSeats) {
    const ledger = await SeatLedgerModel.getLedgerByTripId(tripId);
    
    if (!ledger) {
      return totalSeats; // Aún no hay asignaciones
    }

    return Math.max(0, totalSeats - ledger.allocatedSeats);
  }

  /**
   * Elimina el libro (solo para testing).
   * 
   * @param {string} tripId - ObjectId del viaje
   * @returns {Promise<boolean>} True si se eliminó
   */
  async delete(tripId) {
    const result = await SeatLedgerModel.findOneAndDelete({ tripId });
    return !!result;
  }
}

module.exports = MongoSeatLedgerRepository;

