// Servicio de ciclo de vida de pagos: gestiona operaciones relacionadas con pagos pendientes
// - Cancela reservas individuales de pasajeros (no viajes) si el pago no se completó después de que el viaje finalizó
// - Verifica pagos pendientes para viajes completados
// IMPORTANTE: Este servicio cancela RESERVAS (bookings), no VIAJES (trips). Solo se cancela la reserva del pasajero específico, no todo el viaje.

const MongoBookingRequestRepository = require('../../infrastructure/repositories/MongoBookingRequestRepository');
const MongoTripOfferRepository = require('../../infrastructure/repositories/MongoTripOfferRepository');
const BookingRequestService = require('./BookingRequestService');
const MongoSeatLedgerRepository = require('../../infrastructure/repositories/MongoSeatLedgerRepository');
const NotificationService = require('./NotificationService');

class PaymentLifecycleService {
  constructor() {
    this.bookingRequestRepository = new MongoBookingRequestRepository();
    this.tripOfferRepository = new MongoTripOfferRepository();
    this.bookingRequestService = new BookingRequestService(
      this.bookingRequestRepository,
      this.tripOfferRepository
    );
    this.seatLedgerRepository = new MongoSeatLedgerRepository();
    this.notificationService = new NotificationService();
  }

  // Cancelar reservas individuales de pasajeros con pagos pendientes para viajes que ya completaron
  // IMPORTANTE: Solo cancela la reserva del pasajero, NO todo el viaje. Las reservas de otros pasajeros permanecen activas.
  // Solo cancela reservas para viajes que están en el pasado (estado 'completed')
  // Debe ejecutarse periódicamente (ej: cada minuto)
  // Retorna: cantidad de reservas canceladas
  async cancelUnpaidBookingsBeforeTrip() {
    console.log('[PaymentLifecycleService] Checking for unpaid passenger bookings (not trips) for completed trips to cancel...');

    const now = new Date();

    try {
      // Buscar reservas aceptadas con pagos pendientes
      const BookingRequestModel = require('../../infrastructure/database/models/BookingRequestModel');
      
      const unpaidBookings = await BookingRequestModel.find({
        status: 'accepted',
        paymentStatus: 'pending'
      })
        .populate('tripId', 'departureAt estimatedArrivalAt status')
        .lean();

      // Filtrar reservas donde el viaje ya completó (estado 'completed' o el viaje está en el pasado)
      const bookingsToCancel = unpaidBookings.filter(booking => {
        if (!booking.tripId) return false;
        
        // Solo cancelar si el estado del viaje es 'completed' (el viaje ya ocurrió)
        if (booking.tripId.status === 'completed') {
          return true;
        }
        
        // También cancelar si la hora estimada de llegada del viaje ya pasó (el viaje está en el pasado)
        if (booking.tripId.estimatedArrivalAt) {
          const arrivalTime = new Date(booking.tripId.estimatedArrivalAt);
          return arrivalTime < now;
        }
        
        return false;
      });

      console.log(`[PaymentLifecycleService] Found ${bookingsToCancel.length} unpaid bookings to cancel`);

      let canceledCount = 0;

      for (const bookingDoc of bookingsToCancel) {
        try {
          const booking = await this.bookingRequestRepository.findById(bookingDoc._id.toString());
          if (!booking) continue;

          // Cancelar SOLO la reserva de este pasajero (no todo el viaje)
          // Esto desasignará asientos solo para esta reserva específica
          // Las reservas de otros pasajeros permanecen activas
          await this.bookingRequestService.cancelBookingRequest(
            booking.id,
            booking.passengerId,
            'Pago no completado para un viaje que ya finalizó',
            this.seatLedgerRepository
          );

          // Enviar notificación al pasajero
          try {
            await this.notificationService.createNotification({
              userId: booking.passengerId,
              type: 'booking_canceled',
              title: 'Reserva cancelada por falta de pago',
              message: `Tu reserva ha sido cancelada porque el pago no se completó para un viaje que ya finalizó.`,
              metadata: {
                bookingId: booking.id,
                tripId: booking.tripId,
                reason: 'payment_not_completed_after_trip'
              }
            });
          } catch (notifError) {
            console.error('[PaymentLifecycleService] Error sending notification:', notifError);
          }

          canceledCount++;
        } catch (error) {
          console.error(`[PaymentLifecycleService] Error canceling booking ${bookingDoc._id}:`, error);
        }
      }

      console.log(`[PaymentLifecycleService] Canceled ${canceledCount} unpaid bookings`);

      return canceledCount;
    } catch (error) {
      console.error('[PaymentLifecycleService] Error in cancelUnpaidBookingsBeforeTrip:', error);
      throw error;
    }
  }

  // Verificar si un pasajero tiene pagos pendientes para viajes completados
  // Se usa para bloquear funcionalidad si el pago sigue pendiente después de que el viaje completó
  // Retorna: true si hay pagos pendientes para viajes completados
  async hasPendingPaymentsForCompletedTrips(passengerId) {
    try {
      const BookingRequestModel = require('../../infrastructure/database/models/BookingRequestModel');
      
      const unpaidCompletedBookings = await BookingRequestModel.find({
        passengerId,
        status: 'accepted',
        paymentStatus: 'pending'
      })
        .populate('tripId', 'status')
        .lean();

      // Verificar si alguna de estas reservas es para viajes completados
      return unpaidCompletedBookings.some(booking => {
        return booking.tripId && booking.tripId.status === 'completed';
      });
    } catch (error) {
      console.error('[PaymentLifecycleService] Error checking pending payments:', error);
      return false; // Fallar abierto - no bloquear si no podemos verificar
    }
  }
}

module.exports = PaymentLifecycleService;

