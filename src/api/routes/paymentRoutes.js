// Rutas de pagos: procesamiento de pagos (Stripe y efectivo)
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/authenticate');
const requireCsrf = require('../middlewares/requireCsrf');
const rawBodyMiddleware = require('../middlewares/rawBody');

// POST /api/bookings/:id/payment-intent: crear intento de pago Stripe para una reserva (solo pasajeros)
router.post(
  '/bookings/:id/payment-intent',
  authenticate,
  requireRole('passenger'),
  requireCsrf,
  paymentController.createPaymentIntent
);

// POST /api/bookings/:id/set-cash-payment: establecer método de pago en efectivo (solo pasajeros)
router.post(
  '/bookings/:id/set-cash-payment',
  authenticate,
  requireRole('passenger'),
  requireCsrf,
  paymentController.setCashPayment
);

// POST /api/bookings/:id/confirm-payment: confirmar pago después de que Stripe procese el pago exitosamente (solo pasajeros)
router.post(
  '/bookings/:id/confirm-payment',
  authenticate,
  requireRole('passenger'),
  requireCsrf,
  paymentController.confirmPayment
);

/**
 * @route   POST /api/bookings/:id/confirm-cash-payment
 * @desc    Confirm cash payment (driver confirms passenger paid in cash)
 * @access  Private (Driver only)
 */
router.post(
  '/bookings/:id/confirm-cash-payment',
  authenticate,
  requireRole('driver'),
  requireCsrf,
  paymentController.confirmCashPayment
);

/**
 * @route   GET /api/bookings/pending-payments
 * @desc    Get all pending payments for the authenticated passenger
 * @access  Private (Passenger only)
 */
router.get(
  '/bookings/pending-payments',
  authenticate,
  requireRole('passenger'),
  paymentController.getPendingPayments
);

module.exports = router;

