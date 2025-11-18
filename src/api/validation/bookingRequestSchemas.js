// Esquemas de validación de solicitudes de reserva (Joi): validan creación, listado y cancelación de reservas
const Joi = require('joi');

// Esquema para crear solicitud de reserva: tripId (ObjectId), note (opcional, máx 300 caracteres), seats (>=1, por defecto 1)
const createBookingRequestSchema = Joi.object({
  tripId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'tripId must be a valid MongoDB ObjectId',
      'any.required': 'tripId is required',
      'string.empty': 'tripId cannot be empty'
    }),
  note: Joi.string()
    .max(300)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': 'note must not exceed 300 characters'
    }),
  seats: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional()
    .messages({
      'number.base': 'seats must be a number',
      'number.integer': 'seats must be an integer',
      'number.min': 'seats must be at least 1'
    })
}).options({
  abortEarly: false,
  stripUnknown: true
});

// Esquema para listar solicitudes de reserva (parámetros de consulta): status (pending/canceled_by_passenger/accepted/declined/expired), fromDate, toDate (después de fromDate), page (>=1), pageSize (1-50)
const listBookingRequestsQuerySchema = Joi.object({
  status: Joi.alternatives()
    .try(
      Joi.string().valid('pending', 'canceled_by_passenger', 'accepted', 'declined', 'expired'),
      Joi.array().items(Joi.string().valid('pending', 'canceled_by_passenger', 'accepted', 'declined', 'expired'))
    )
    .optional()
    .messages({
      'any.only': 'status must be one of: pending, canceled_by_passenger, accepted, declined, expired'
    }),
  fromDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'fromDate must be a valid ISO 8601 date',
      'date.base': 'fromDate must be a valid date'
    }),
  toDate: Joi.date()
    .iso()
    .optional()
    .when('fromDate', {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref('fromDate')).messages({
        'date.min': 'toDate must be after fromDate'
      })
    })
    .messages({
      'date.format': 'toDate must be a valid ISO 8601 date',
      'date.base': 'toDate must be a valid date'
    }),
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional()
    .messages({
      'number.base': 'page must be a number',
      'number.integer': 'page must be an integer',
      'number.min': 'page must be at least 1'
    }),
  pageSize: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .messages({
      'number.base': 'pageSize must be a number',
      'number.integer': 'pageSize must be an integer',
      'number.min': 'pageSize must be at least 1',
      'number.max': 'pageSize must not exceed 50'
    })
}).options({
  abortEarly: false,
  stripUnknown: true
});

// Esquema para parámetro de ID de reserva: bookingId (ObjectId MongoDB)
const bookingIdParamSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'bookingId must be a valid MongoDB ObjectId',
      'any.required': 'bookingId is required'
    })
}).options({
  abortEarly: false
});

// Esquema para consulta de solicitudes de reserva de viaje del conductor: status (pending/accepted/declined/canceled_by_passenger/expired), page (>=1), pageSize (1-50)
const driverTripBookingRequestsQuerySchema = Joi.object({
  status: Joi.alternatives()
    .try(
      Joi.string().valid('pending', 'accepted', 'declined', 'canceled_by_passenger', 'expired'),
      Joi.array().items(Joi.string().valid('pending', 'accepted', 'declined', 'canceled_by_passenger', 'expired'))
    )
    .optional()
    .messages({
      'any.only': 'status must be one of: pending, accepted, declined, canceled_by_passenger, expired'
    }),
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional()
    .messages({
      'number.base': 'page must be a number',
      'number.integer': 'page must be an integer',
      'number.min': 'page must be at least 1'
    }),
  pageSize: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .messages({
      'number.base': 'pageSize must be a number',
      'number.integer': 'pageSize must be an integer',
      'number.min': 'pageSize must be at least 1',
      'number.max': 'pageSize must not exceed 50'
    })
}).options({
  abortEarly: false,
  stripUnknown: true
});

// Esquema para parámetro de ID de viaje: tripId (ObjectId MongoDB)
const tripIdParamSchema = Joi.object({
  tripId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'tripId must be a valid MongoDB ObjectId',
      'any.required': 'tripId is required'
    })
}).options({
  abortEarly: false
});

// Esquema para cancelar solicitud de reserva: reason (opcional, máx 500 caracteres)
const cancelBookingRequestSchema = Joi.object({
  reason: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Cancellation reason cannot exceed 500 characters'
    })
}).options({
  abortEarly: false
});

module.exports = {
  createBookingRequestSchema,
  listBookingRequestsQuerySchema,
  bookingIdParamSchema,
  driverTripBookingRequestsQuerySchema,
  tripIdParamSchema,
  cancelBookingRequestSchema
};

