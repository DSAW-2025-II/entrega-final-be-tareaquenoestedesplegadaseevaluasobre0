// Esquemas de validación de API interna (Joi): validan endpoints internos solo para admin
// Incluye ejecución de trabajos, mantenimiento del sistema y verificaciones de salud
const Joi = require('joi');

// Esquema para ejecución de trabajos (parámetros de consulta): name (complete-trips/auto-complete-trips/expire-pendings/verification-expiry-scan/audit-anchor), pendingTtlHours (1-168 horas, por defecto 48)
const runJobQuerySchema = Joi.object({
  name: Joi.string()
    .valid('complete-trips', 'auto-complete-trips', 'expire-pendings', 'verification-expiry-scan', 'audit-anchor')
    .default('complete-trips')
    .messages({
      'any.only': 'Job name must be one of: complete-trips, auto-complete-trips, expire-pendings'
    }),
  pendingTtlHours: Joi.number()
    .integer()
    .min(1)
    .max(168) // Max 7 days
    .default(48)
    .messages({
      'number.base': 'pendingTtlHours must be a number',
      'number.integer': 'pendingTtlHours must be an integer',
      'number.min': 'pendingTtlHours must be at least 1 hour',
      'number.max': 'pendingTtlHours cannot exceed 168 hours (7 days)'
    })
}).options({
  abortEarly: false
});

// Esquema para renderizar plantilla de notificación: channel (email/in-app requerido), type (payment.succeeded requerido), locale (en/es, por defecto en), variables (objeto, por defecto {})
const renderTemplateBodySchema = Joi.object({
  channel: Joi.string().valid('email', 'in-app').required(),
  type: Joi.string().valid('payment.succeeded').required(),
  locale: Joi.string().valid('en','es').default('en'),
  variables: Joi.object().default({})
}).options({ abortEarly: false });

// Esquema para despachar notificación: channel (email/in-app/both, por defecto both), type (requerido), userId (requerido), variables (objeto, por defecto {})
const dispatchNotificationBodySchema = Joi.object({
  channel: Joi.string().valid('email', 'in-app', 'both').default('both'),
  type: Joi.string().required(),
  userId: Joi.string().required(),
  variables: Joi.object().default({})
}).options({ abortEarly: false });

// Esquema para validar plantilla de notificación: type (requerido), locale (en/es, por defecto en), subject (requerido), html (requerido), text (requerido), schema (opcional), partials (objeto opcional)
const validateTemplateBodySchema = Joi.object({
  type: Joi.string().required(),
  locale: Joi.string().valid('en','es').default('en'),
  subject: Joi.string().required(),
  html: Joi.string().allow('').required(),
  text: Joi.string().allow('').required(),
  schema: Joi.object().optional(),
  partials: Joi.object().pattern(Joi.string(), Joi.string()).optional()
}).options({ abortEarly: false });

// Esquema para revisar verificación de conductor: action (approve/reject requerido), reason (requerido si action=reject, mínimo 3 caracteres), comment (opcional)
const reviewDriverVerificationBodySchema = Joi.object({
  action: Joi.string().valid('approve','reject').required(),
  reason: Joi.when('action', {
    is: 'reject',
    then: Joi.string().min(3).required(),
    otherwise: Joi.forbidden()
  }),
  comment: Joi.string().allow('').optional()
}).options({ abortEarly: false });

module.exports = {
  runJobQuerySchema
  , renderTemplateBodySchema
  , dispatchNotificationBodySchema
  , validateTemplateBodySchema
  , reviewDriverVerificationBodySchema
};
