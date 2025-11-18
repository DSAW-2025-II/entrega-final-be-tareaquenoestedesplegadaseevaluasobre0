// Controlador de búsqueda de viajes para pasajeros: solo retorna viajes publicados con salida futura
const MongoTripOfferRepository = require('../../infrastructure/repositories/MongoTripOfferRepository');
const TripOfferResponseDto = require('../../domain/dtos/TripOfferResponseDto');
const PaymentService = require('../../domain/services/PaymentService');
const MongoBookingRequestRepository = require('../../infrastructure/repositories/MongoBookingRequestRepository');
const Stripe = require('stripe');

class PassengerTripController {
  constructor() {
    this.tripOfferRepository = new MongoTripOfferRepository();
    this.bookingRequestRepository = new MongoBookingRequestRepository();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    this.paymentService = new PaymentService(
      this.bookingRequestRepository,
      this.tripOfferRepository,
      stripe
    );
  }

  // GET /passengers/trips/search: buscar viajes publicados con filtros
  async searchTrips(req, res, next) {
    try {
      const passengerId = req.user.id || req.user.sub;

      // Verificar pagos pendientes: bloquear búsqueda solo si hay pagos pendientes de viajes completados
      const pendingPaymentsForCompletedTrips = await this.paymentService.getPendingPaymentsForCompletedTrips(passengerId);
      if (pendingPaymentsForCompletedTrips.length > 0) {
        return res.status(403).json({
          code: 'pending_payments_block',
          message: 'No puedes buscar nuevos viajes hasta que completes los pagos pendientes de viajes que ya finalizaron',
          correlationId: req.correlationId
        });
      }

      const { 
        qOrigin, 
        qDestination, 
        fromDate, 
        toDate, 
        fromTime,
        toTime,
        minAvailableSeats,
        minPrice,
        maxPrice,
        page, 
        pageSize 
      } = req.query;

      console.log(
        `[PassengerTripController] Search trips | qOrigin: ${qOrigin || 'none'} | qDestination: ${qDestination || 'none'} | fromDate: ${fromDate || 'none'} | toDate: ${toDate || 'none'} | fromTime: ${fromTime || 'none'} | toTime: ${toTime || 'none'} | minAvailableSeats: ${minAvailableSeats || 'none'} | minPrice: ${minPrice || 'none'} | maxPrice: ${maxPrice || 'none'} | page: ${page || 1} | pageSize: ${pageSize || 10} | correlationId: ${req.correlationId}`
      );

      // Search published trips
      const result = await this.tripOfferRepository.searchPublishedTrips({
        qOrigin,
        qDestination,
        fromDate,
        toDate,
        fromTime,
        toTime,
        minAvailableSeats: minAvailableSeats ? parseInt(minAvailableSeats) : undefined,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        page: page || 1,
        pageSize: pageSize || 10
      });

      // Convert to DTOs with populated driver and vehicle info
      // Map populatedDocs to DTOs, matching with trips by ID
      const items = result.populatedDocs.map(doc => {
        const docId = doc._id.toString();
        const tripOffer = result.trips.find(t => t.id === docId);
        if (!tripOffer) {
          // Fallback: create DTO from doc directly if tripOffer not found
          return TripOfferResponseDto.fromPopulatedDoc(doc);
        }
        return TripOfferResponseDto.fromDomainWithPopulated(tripOffer, doc);
      });

      console.log(
        `[PassengerTripController] Search completed | found: ${result.total} | returned: ${items.length} | correlationId: ${req.correlationId}`
      );

      res.status(200).json({
        items,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages
      });
    } catch (error) {
      console.error(
        `[PassengerTripController] Search failed | error: ${error.message} | correlationId: ${req.correlationId}`
      );
      next(error);
    }
  }
}

module.exports = PassengerTripController;

