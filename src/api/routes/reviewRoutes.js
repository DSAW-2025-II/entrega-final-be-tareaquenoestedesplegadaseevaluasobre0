// Rutas de reseñas: creación y reporte de reseñas de viajes
const express = require('express');
const router = express.Router();

const ReviewController = require('../controllers/reviewController');
const validateRequest = require('../middlewares/validateRequest');
const authenticate = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/authenticate');
const requireCsrf = require('../middlewares/requireCsrf');
const { createReviewBodySchema } = require('../validation/reviewSchemas');

const controller = new ReviewController();

// POST /trips/:tripId/reviews: pasajero escribe reseña para un viaje completado
router.post(
  '/:tripId/reviews',
  authenticate,
  requireRole('passenger'),
  requireCsrf,
  validateRequest(createReviewBodySchema, 'body'),
  controller.createReview.bind(controller)
);

// POST /reviews/:reviewId/report: reportar una reseña
router.post(
  '/reviews/:reviewId/report',
  authenticate,
  requireCsrf,
  validateRequest(require('../validation/reviewSchemas').reviewIdParamSchema, 'params'),
  validateRequest(require('../validation/reviewSchemas').reportReviewBodySchema, 'body'),
  controller.reportReview.bind(controller)
);

module.exports = router;
