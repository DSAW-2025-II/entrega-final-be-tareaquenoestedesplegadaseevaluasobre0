// Servicio de trabajos de ciclo de vida: orquesta trabajos en segundo plano para mantener estados del ciclo de vida de viajes y reservas
// Trabajos: auto-completar viajes (publicados → completados), expirar reservas pendientes (pendientes → expiradas)
// Todos los trabajos son idempotentes y emiten métricas para monitoreo
const TripOfferService = require('./TripOfferService');
const BookingRequestService = require('./BookingRequestService');

class LifecycleJobService {
  constructor(tripOfferRepository, bookingRequestRepository, vehicleRepository, userRepository) {
    // Inicializar servicios dependientes
    this.tripOfferService = new TripOfferService(
      tripOfferRepository,
      vehicleRepository,
      userRepository
    );
    
    this.bookingRequestService = new BookingRequestService(
      bookingRequestRepository,
      tripOfferRepository
    );
  }

  // Ejecutar trabajo de completar viajes: auto-completa viajes elegibles y expira reservas pendientes antiguas
  // Idempotente: puede ejecutarse de forma segura múltiples veces
  async runCompleteTripsJob(options = {}) {
    const { pendingTtlHours = 48 } = options;

    const startTime = Date.now();

    try {
      // Ejecutar ambos trabajos en paralelo para eficiencia
      const [completedTrips, expiredPendings] = await Promise.all([
        this.tripOfferService.autoCompleteTrips(),
        this.bookingRequestService.expirePendingBookings(pendingTtlHours)
      ]);

      const duration = Date.now() - startTime;

      return {
        ok: true,
        completedTrips,
        expiredPendings,
        durationMs: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[LifecycleJobService] complete-trips job failed | error: ${error.message} | duration: ${duration}ms`
      );

      throw error;
    }
  }

  // Ejecutar solo el trabajo de auto-completar viajes
  async runAutoCompleteTripsOnly() {
    const completedTrips = await this.tripOfferService.autoCompleteTrips();

    return {
      ok: true,
      completedTrips,
      expiredPendings: 0
    };
  }

  // Ejecutar solo el trabajo de expirar reservas pendientes
  async runExpirePendingsOnly(ttlHours = 48) {
    const expiredPendings = await this.bookingRequestService.expirePendingBookings(ttlHours);

    return {
      ok: true,
      completedTrips: 0,
      expiredPendings
    };
  }
}

module.exports = LifecycleJobService;
