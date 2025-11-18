// Rutas de webhooks de pagos: maneja eventos de webhooks de Stripe
// Necesita body crudo, montado antes del parser de body
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// POST /api/payments/webhooks/stripe: manejar eventos de webhook de Stripe
// Nota: esta ruta debe usar rawBodyMiddleware para preservar el body crudo para verificación de firma
router.post(
  '/payments/webhooks/stripe',
  paymentController.handleStripeWebhook
);

module.exports = router;

