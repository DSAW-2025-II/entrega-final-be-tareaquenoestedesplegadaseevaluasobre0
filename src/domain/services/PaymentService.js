// Servicio de dominio de pagos: lógica de procesamiento de pagos incluyendo integración con Stripe
const DomainError = require('../errors/DomainError');

class PaymentService {
  constructor(bookingRequestRepository, tripOfferRepository, stripeClient) {
    this.bookingRequestRepository = bookingRequestRepository;
    this.tripOfferRepository = tripOfferRepository;
    this.stripe = stripeClient;
  }

  // Crear intento de pago Stripe para una reserva
  async createPaymentIntent(bookingId, passengerId) {
    console.log(`[PaymentService] Creating payment intent | bookingId: ${bookingId} | passengerId: ${passengerId}`);

    // 1. Buscar solicitud de reserva
    const booking = await this.bookingRequestRepository.findById(bookingId);
    if (!booking) {
      throw new DomainError('Booking request not found', 'booking_not_found', 404);
    }

    // 2. Verificar propiedad
    if (booking.passengerId !== passengerId) {
      throw new DomainError('You do not have permission to pay for this booking', 'forbidden', 403);
    }

    // 3. Verificar que la reserva está aceptada
    if (booking.status !== 'accepted') {
      throw new DomainError('Only accepted bookings can be paid', 'invalid_state', 400);
    }

    // 4. Verificar si ya está pagada
    if (booking.isPaymentCompleted()) {
      throw new DomainError('This booking has already been paid', 'already_paid', 400);
    }

    // 5. Cargar viaje para obtener precio
    const trip = await this.tripOfferRepository.findById(booking.tripId);
    if (!trip) {
      throw new DomainError('Trip offer not found', 'trip_not_found', 404);
    }

    // 6. Calcular monto total (precio por asiento * número de asientos)
    const amount = Math.round(trip.pricePerSeat * booking.seats * 100); // Convertir a centavos

    // 7. Crear intento de pago Stripe
    let paymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        amount: amount,
        currency: 'cop', // Peso colombiano
        metadata: {
          bookingId: bookingId,
          passengerId: passengerId,
          tripId: trip.id
        },
        automatic_payment_methods: {
          enabled: true
        }
      });
    } catch (error) {
      console.error('[PaymentService] Stripe error:', error);
      throw new DomainError('Failed to create payment intent', 'payment_error', 500);
    }

    // 8. Establecer método de pago en la reserva
    booking.setPaymentMethod('card', paymentIntent.id);
    await this.bookingRequestRepository.save(booking);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  }

  // Confirmar pago en efectivo (conductor confirma que el pasajero pagó)
  async confirmCashPayment(bookingId, driverId) {
    console.log(`[PaymentService] Confirming cash payment | bookingId: ${bookingId} | driverId: ${driverId}`);

    // 1. Buscar solicitud de reserva
    const booking = await this.bookingRequestRepository.findById(bookingId);
    if (!booking) {
      throw new DomainError('Booking request not found', 'booking_not_found', 404);
    }

    // 2. Cargar viaje para verificar propiedad
    const trip = await this.tripOfferRepository.findById(booking.tripId);
    if (!trip) {
      throw new DomainError('Trip offer not found', 'trip_not_found', 404);
    }

    // 3. Verify driver owns the trip
    if (trip.driverId !== driverId) {
      throw new DomainError('You do not have permission to confirm payment for this booking', 'forbidden', 403);
    }

    // 4. Verify booking is accepted
    if (booking.status !== 'accepted') {
      throw new DomainError('Only accepted bookings can have payments confirmed', 'invalid_state', 400);
    }

    // 5. Check if already paid
    if (booking.isPaymentCompleted()) {
      throw new DomainError('This booking has already been paid', 'already_paid', 400);
    }

    // 6. Mark payment as completed
    booking.markPaymentCompleted('cash');
    await this.bookingRequestRepository.save(booking);

    return booking;
  }

  /**
   * Confirm payment after Stripe payment intent succeeds
   * Called immediately after frontend confirms payment with Stripe
   * @param {string} bookingId - Booking request ID
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {string} passengerId - Passenger ID (for authorization)
   * @returns {Promise<BookingRequest>} Updated booking request
   */
  async confirmPayment(bookingId, paymentIntentId, passengerId) {
    console.log(`[PaymentService] Confirming payment | bookingId: ${bookingId} | paymentIntentId: ${paymentIntentId} | passengerId: ${passengerId}`);

    // Find booking request
    const booking = await this.bookingRequestRepository.findById(bookingId);
    if (!booking) {
      throw new DomainError('Booking request not found', 404, 'booking_not_found');
    }

    // Verify ownership
    if (booking.passengerId !== passengerId) {
      throw new DomainError('You do not have permission to confirm payment for this booking', 403, 'forbidden');
    }

    // Verify payment intent matches
    if (booking.stripePaymentIntentId !== paymentIntentId) {
      throw new DomainError('Payment intent does not match', 400, 'invalid_payment_intent');
    }

    // Verify booking is accepted
    if (booking.status !== 'accepted') {
      throw new DomainError('Only accepted bookings can be paid', 400, 'invalid_state');
    }

    // Mark payment as completed
    if (!booking.isPaymentCompleted()) {
      booking.markPaymentCompleted('card');
      try {
        await this.bookingRequestRepository.save(booking);
        console.log(`[PaymentService] Payment confirmed for booking: ${bookingId} | paymentStatus: ${booking.paymentStatus} | isPaid: ${booking.isPaid}`);
        
        // Verify the save was successful by reloading
        const savedBooking = await this.bookingRequestRepository.findById(bookingId);
        if (!savedBooking) {
          throw new DomainError('Failed to verify payment confirmation', 500, 'verification_failed');
        }
        console.log(`[PaymentService] Verification - saved booking paymentStatus: ${savedBooking.paymentStatus} | isPaid: ${savedBooking.isPaid}`);
      } catch (saveError) {
        console.error(`[PaymentService] Error saving payment confirmation:`, saveError);
        // If it's already a DomainError, re-throw it
        if (saveError.code && saveError.statusCode) {
          throw saveError;
        }
        throw new DomainError(`Failed to save payment confirmation: ${saveError.message}`, 500, 'save_failed');
      }
    } else {
      console.log(`[PaymentService] Booking ${bookingId} already marked as paid`);
    }

    return booking;
  }

  /**
   * Handle Stripe webhook event
   * @param {Object} event - Stripe webhook event
   * @returns {Promise<void>}
   */
  async handleStripeWebhook(event) {
    console.log(`[PaymentService] Handling Stripe webhook | type: ${event.type}`);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.bookingId;

      if (!bookingId) {
        console.warn('[PaymentService] Payment intent missing bookingId metadata');
        return;
      }

      // Find booking by payment intent ID
      const booking = await this.bookingRequestRepository.findByStripePaymentIntentId(paymentIntent.id);
      if (!booking) {
        console.warn(`[PaymentService] Booking not found for payment intent: ${paymentIntent.id}`);
        return;
      }

      // Mark payment as completed
      if (!booking.isPaymentCompleted()) {
        booking.markPaymentCompleted('card');
        await this.bookingRequestRepository.save(booking);
        console.log(`[PaymentService] Payment confirmed for booking: ${bookingId}`);
      }
    }
  }

  /**
   * Get pending payments for a passenger
   * Only returns payments for completed trips (trips that have finished)
   * @param {string} passengerId - Passenger ID
   * @returns {Promise<BookingRequest[]>} Array of bookings with pending payments for completed trips only
   */
  async getPendingPayments(passengerId) {
    // Only return pending payments for completed trips
    // This prevents showing payment warnings for trips that haven't finished yet
    return this.bookingRequestRepository.findPendingPaymentsForCompletedTrips(passengerId);
  }

  /**
   * Get pending payments only for completed trips (trips in the past)
   * Used to block functionality only for past trips with pending payments
   * @param {string} passengerId - Passenger ID
   * @returns {Promise<BookingRequest[]>} Array of bookings with pending payments for completed trips
   */
  async getPendingPaymentsForCompletedTrips(passengerId) {
    return this.bookingRequestRepository.findPendingPaymentsForCompletedTrips(passengerId);
  }
}

module.exports = PaymentService;

