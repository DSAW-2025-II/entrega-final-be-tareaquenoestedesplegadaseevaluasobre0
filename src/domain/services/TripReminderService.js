// Servicio de recordatorios de viaje: envía recordatorios 5 minutos antes de la salida
// Debe inicializarse como un trabajo cron que se ejecute periódicamente

const NotificationService = require('./NotificationService');
const MongoTripOfferRepository = require('../../infrastructure/repositories/MongoTripOfferRepository');
const MongoBookingRequestRepository = require('../../infrastructure/repositories/MongoBookingRequestRepository');
const TripOfferModel = require('../../infrastructure/database/models/TripOfferModel');
const BookingRequestModel = require('../../infrastructure/database/models/BookingRequestModel');

class TripReminderService {
  constructor() {
    this.tripOfferRepository = new MongoTripOfferRepository();
    this.bookingRequestRepository = new MongoBookingRequestRepository();
  }

  // Verificar viajes que inician en 5 minutos y enviar recordatorios
  // Este método debe ser llamado por un trabajo cron cada minuto
  async checkAndSendReminders() {
    try {
      const now = new Date();
      
      // Buscar viajes que inician entre ahora+4min y ahora+6min (ventana de 5min)
      // Esto asegura que capturemos viajes que están aproximadamente a 5 minutos
      const fourMinutesFromNow = new Date(now.getTime() + 4 * 60 * 1000);
      const sixMinutesFromNow = new Date(now.getTime() + 6 * 60 * 1000);

      const upcomingTrips = await TripOfferModel.find({
        status: 'published',
        departureAt: {
          $gte: fourMinutesFromNow,
          $lte: sixMinutesFromNow
        }
      }).lean();

      // Verificar si los recordatorios ya fueron enviados (evitar duplicados)
      const InAppNotification = require('../../infrastructure/database/models/InAppNotificationModel');
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      console.log(
        `[TripReminderService] Found ${upcomingTrips.length} trips starting in ~5 minutes`
      );

      let totalNotifications = 0;

      for (const trip of upcomingTrips) {
        try {
          // Verificar si el recordatorio ya fue enviado para este viaje (dentro de los últimos 5 minutos)
          const existingReminder = await InAppNotification.findOne({
            type: 'trip.reminder',
            'data.tripId': trip._id.toString(),
            createdAt: { $gte: fiveMinutesAgo }
          });

          if (existingReminder) {
            console.log(
              `[TripReminderService] Reminder already sent for trip ${trip._id}, skipping`
            );
            continue;
          }

          // Obtener todas las reservas aceptadas para este viaje
          const acceptedBookings = await BookingRequestModel.find({
            tripId: trip._id,
            status: 'accepted'
          }).lean();

          const passengerIds = acceptedBookings.map(b => b.passengerId.toString());
          const allUserIds = [trip.driverId.toString(), ...passengerIds];

          // Formatear hora de salida
          const departureTime = new Date(trip.departureAt).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          });

          // Enviar notificación al conductor
          await NotificationService.createNotification(
            trip.driverId.toString(),
            'trip.reminder',
            'Tu viaje comienza pronto',
            `Tu viaje inicia en aproximadamente 5 minutos (${departureTime}).`,
            {
              tripId: trip._id.toString(),
              departureAt: trip.departureAt,
              origin: trip.origin?.text || '',
              destination: trip.destination?.text || ''
            }
          );

          // Enviar notificación a todos los pasajeros aceptados
          if (passengerIds.length > 0) {
            await NotificationService.createNotifications(
              passengerIds,
              'trip.reminder',
              'Tu viaje comienza pronto',
              `El viaje inicia en aproximadamente 5 minutos (${departureTime}).`,
              {
                tripId: trip._id.toString(),
                departureAt: trip.departureAt,
                origin: trip.origin?.text || '',
                destination: trip.destination?.text || ''
              }
            );
          }

          totalNotifications += 1 + passengerIds.length;
          console.log(
            `[TripReminderService] Sent reminders for trip ${trip._id} | driver + ${passengerIds.length} passengers`
          );
        } catch (error) {
          console.error(
            `[TripReminderService] Failed to send reminders for trip ${trip._id}:`,
            error.message
          );
        }
      }

      if (totalNotifications > 0) {
        console.log(
          `[TripReminderService] Completed | sent ${totalNotifications} reminder notifications`
        );
      }

      return totalNotifications;
    } catch (error) {
      console.error('[TripReminderService] Error checking reminders:', error.message);
      return 0;
    }
  }
}

module.exports = TripReminderService;

