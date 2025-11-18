// Controlador de pagos: maneja peticiones HTTP relacionadas con pagos
const PaymentService = require('../../domain/services/PaymentService');
const MongoBookingRequestRepository = require('../../infrastructure/repositories/MongoBookingRequestRepository');
const MongoTripOfferRepository = require('../../infrastructure/repositories/MongoTripOfferRepository');
const Stripe = require('stripe');

// Inicializar cliente Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Inicializar repositorios
const bookingRequestRepository = new MongoBookingRequestRepository();
const tripOfferRepository = new MongoTripOfferRepository();

// Inicializar servicio
const paymentService = new PaymentService(
  bookingRequestRepository,
  tripOfferRepository,
  stripe
);

class PaymentController {
  // POST /api/bookings/:id/payment-intent: crear intento de pago Stripe para una reserva
  async createPaymentIntent(req, res, next) {
    try {
      const { id: bookingId } = req.params;
      const passengerId = req.user.id || req.user.sub;

      console.log(`[PaymentController] Creating payment intent | bookingId: ${bookingId} | passengerId: ${passengerId}`);

      // Verificar si Stripe está configurado
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error('[PaymentController] STRIPE_SECRET_KEY not configured');
        return res.status(500).json({
          code: 'stripe_not_configured',
          message: 'Stripe payment service is not configured. Please contact support.',
          correlationId: req.correlationId
        });
      }

      const result = await paymentService.createPaymentIntent(bookingId, passengerId);

      return res.status(200).json({
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId
      });
    } catch (err) {
      console.error('[PaymentController] Error creating payment intent:', err);
      
      if (err.code) {
        return res.status(err.statusCode || 500).json({
          code: err.code,
          message: err.message,
          correlationId: req.correlationId
        });
      }

      return next(err);
    }
  }

  // POST /api/bookings/:id/set-cash-payment: establecer método de pago en efectivo
  async setCashPayment(req, res, next) {
    try {
      const { id: bookingId } = req.params;
      const passengerId = req.user.id || req.user.sub;

      console.log(`[PaymentController] Setting cash payment | bookingId: ${bookingId} | passengerId: ${passengerId}`);

      // Find booking request
      const booking = await bookingRequestRepository.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          code: 'booking_not_found',
          message: 'Booking request not found',
          correlationId: req.correlationId
        });
      }

      // Verify ownership
      if (booking.passengerId !== passengerId) {
        return res.status(403).json({
          code: 'forbidden',
          message: 'You do not have permission to set payment for this booking',
          correlationId: req.correlationId
        });
      }

      // Verify booking is accepted
      if (booking.status !== 'accepted') {
        return res.status(400).json({
          code: 'invalid_state',
          message: 'Only accepted bookings can have payments set',
          correlationId: req.correlationId
        });
      }

      // Set payment method to cash
      booking.setPaymentMethod('cash');
      await bookingRequestRepository.save(booking);

      return res.status(200).json({
        id: booking.id,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus
      });
    } catch (err) {
      console.error('[PaymentController] Error setting cash payment:', err);
      return next(err);
    }
  }

  /**
   * POST /api/bookings/:id/confirm-payment
   * Confirm payment after Stripe payment intent succeeds (called immediately after frontend confirms)
   */
  async confirmPayment(req, res, next) {
    try {
      const { id: bookingId } = req.params;
      const paymentIntentId = req.body?.paymentIntentId;
      const passengerId = req.user.id || req.user.sub;

      console.log(`[PaymentController] Confirming payment | bookingId: ${bookingId} | paymentIntentId: ${paymentIntentId} | passengerId: ${passengerId}`);
      console.log(`[PaymentController] req.body:`, req.body);
      console.log(`[PaymentController] req.body type:`, typeof req.body);

      if (!paymentIntentId) {
        return res.status(400).json({
          code: 'invalid_request',
          message: 'paymentIntentId is required',
          correlationId: req.correlationId
        });
      }

      const booking = await paymentService.confirmPayment(bookingId, paymentIntentId, passengerId);

      return res.status(200).json({
        id: booking.id,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod
      });
    } catch (err) {
      console.error('[PaymentController] Error confirming payment:', err);
      console.error('[PaymentController] Error stack:', err.stack);
      
      if (err.code) {
        return res.status(err.statusCode || 500).json({
          code: err.code,
          message: err.message,
          correlationId: req.correlationId
        });
      }

      // If it's a DomainError but doesn't have code, wrap it
      if (err.message) {
        return res.status(500).json({
          code: 'internal_error',
          message: err.message || 'Error al confirmar el pago',
          correlationId: req.correlationId
        });
      }

      return next(err);
    }
  }

  /**
   * POST /api/bookings/:id/confirm-cash-payment
   * Confirm cash payment (driver confirms passenger paid in cash)
   */
  async confirmCashPayment(req, res, next) {
    try {
      const { id: bookingId } = req.params;
      const driverId = req.user.id || req.user.sub;

      console.log(`[PaymentController] Confirming cash payment | bookingId: ${bookingId} | driverId: ${driverId}`);

      const booking = await paymentService.confirmCashPayment(bookingId, driverId);

      return res.status(200).json({
        id: booking.id,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        paidAt: booking.paidAt
      });
    } catch (err) {
      console.error('[PaymentController] Error confirming cash payment:', err);
      
      if (err.code) {
        return res.status(err.statusCode || 500).json({
          code: err.code,
          message: err.message
        });
      }

      return next(err);
    }
  }

  /**
   * GET /api/bookings/pending-payments
   * Get all pending payments for the authenticated passenger
   */
  async getPendingPayments(req, res, next) {
    try {
      const passengerId = req.user.id || req.user.sub;

      console.log(`[PaymentController] Getting pending payments | passengerId: ${passengerId}`);

      const bookings = await paymentService.getPendingPayments(passengerId);

      return res.status(200).json({
        bookings: bookings.map(booking => ({
          id: booking.id,
          tripId: booking.tripId,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          paymentMethod: booking.paymentMethod,
          seats: booking.seats
        }))
      });
    } catch (err) {
      console.error('[PaymentController] Error getting pending payments:', err);
      return next(err);
    }
  }

  /**
   * POST /api/payments/webhooks/stripe
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(req, res, next) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[PaymentController] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('[PaymentController] Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
      await paymentService.handleStripeWebhook(event);
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('[PaymentController] Error handling webhook:', err);
      return next(err);
    }
  }
}

module.exports = new PaymentController();

