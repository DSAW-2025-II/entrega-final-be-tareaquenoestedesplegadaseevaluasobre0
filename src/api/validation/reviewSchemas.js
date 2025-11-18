// Esquemas de validación de reseñas (Joi): validan creación, actualización, listado y reporte de reseñas
const Joi = require('joi');

// Esquema para crear reseña: rating (1-5 requerido), text (opcional, máx 1000 caracteres), tags (opcional, máx 5 tags, cada uno máx 50 caracteres)
const createReviewBodySchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  text: Joi.string().max(1000).allow('').optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(5).optional()
});

// Esquema para listar reseñas (parámetros de consulta): page (>=1, por defecto 1), pageSize (1-50, por defecto 10)
const listReviewsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(50).default(10)
});

// Esquema para parámetro de ID de conductor: driverId (ObjectId MongoDB)
const driverIdParamSchema = Joi.object({
  driverId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'driverId must be a valid MongoDB ObjectId',
      'any.required': 'driverId is required'
    })
}).options({ abortEarly: false });

// Esquema para actualizar reseña: rating (1-5 opcional), text (opcional, máx 1000 caracteres), tags (opcional, máx 5 tags)
const updateReviewBodySchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
  text: Joi.string().max(1000).optional().allow(''),
  tags: Joi.array().items(Joi.string().max(50)).max(5).optional()
}).options({ abortEarly: false });

// Esquema para parámetro de ID de reseña: reviewId (ObjectId MongoDB)
const reviewIdParamSchema = Joi.object({
  reviewId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'reviewId must be a valid MongoDB ObjectId',
      'any.required': 'reviewId is required'
    })
}).options({ abortEarly: false });

// Esquema para parámetros de reseña: tripId (ObjectId), reviewId (ObjectId)
const reviewParamsSchema = Joi.object({
  tripId: Joi.string().pattern(/^[a-f\d]{24}$/i).required().messages({ 'string.pattern.base': 'tripId must be a valid MongoDB ObjectId' }),
  reviewId: Joi.string().pattern(/^[a-f\d]{24}$/i).required().messages({ 'string.pattern.base': 'reviewId must be a valid MongoDB ObjectId' })
}).options({ abortEarly: false });

// Esquema para reportar reseña: category (abuse/spam/fraud/other requerido), reason (opcional, máx 500 caracteres)
const reportReviewBodySchema = Joi.object({
  category: Joi.string().valid('abuse', 'spam', 'fraud', 'other').required(),
  reason: Joi.string().trim().max(500).optional().allow('').messages({
    'string.max': 'Reason cannot exceed 500 characters'
  })
}).options({ abortEarly: false });

// Esquema para acción de visibilidad de admin: action (hide/unhide requerido), reason (requerido, máx 500 caracteres)
const adminVisibilityBodySchema = Joi.object({
  action: Joi.string().valid('hide', 'unhide').required(),
  reason: Joi.string().trim().max(500).required().messages({
    'any.required': 'Reason is required for moderation actions',
    'string.max': 'Reason cannot exceed 500 characters'
  })
}).options({ abortEarly: false });

module.exports = { createReviewBodySchema, listReviewsQuerySchema, reviewIdParamSchema, reportReviewBodySchema, adminVisibilityBodySchema, updateReviewBodySchema, reviewParamsSchema, driverIdParamSchema };
