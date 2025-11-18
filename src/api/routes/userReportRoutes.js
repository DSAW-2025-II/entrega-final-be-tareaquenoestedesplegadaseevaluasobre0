// Rutas de reportes de usuarios: reportar usuarios y obtener reportes recibidos
const express = require('express');
const router = express.Router();
const userReportController = require('../controllers/userReportController');
const authenticate = require('../middlewares/authenticate');
const requireCsrf = require('../middlewares/requireCsrf');
const { generalRateLimiter } = require('../middlewares/rateLimiter');
const validateRequest = require('../middlewares/validateRequest');
const { reportUserSchema } = require('../validation/userReportSchemas');
const Joi = require('joi');

const userIdParamSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'userId must be a valid MongoDB ObjectId',
      'any.required': 'userId is required'
    })
}).options({ abortEarly: false });

// GET /users/me/reports-received: obtener todos los reportes hechos sobre el usuario actual
router.get(
  '/me/reports-received',
  authenticate,
  userReportController.getMyReportsReceived.bind(userReportController)
);

// POST /users/:userId/report: reportar usuario desde un viaje específico
router.post(
  '/:userId/report',
  generalRateLimiter,
  authenticate,
  requireCsrf,
  validateRequest(userIdParamSchema, 'params'),
  validateRequest(reportUserSchema, 'body'),
  userReportController.reportUser.bind(userReportController)
);

module.exports = router;

