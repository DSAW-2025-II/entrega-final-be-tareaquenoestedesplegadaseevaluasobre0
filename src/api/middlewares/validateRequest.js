// Middleware para validar request body/query/params con Joi
const Joi = require('joi');

// Validar propiedad del request (body, query o params) con esquema Joi
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    // Usar opciones del esquema si están definidas, de lo contrario usar valores por defecto
    const { error, value } = schema.validate(req[property]);

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        issue: detail.message
      }));

      return res.status(400).json({
        code: 'invalid_schema',
        message: 'Validation failed',
        details,
        correlationId: req.correlationId
      });
    }

    // Reemplazar el request con los datos validados y sanitizados
    req[property] = value;
    next();
  };
};

module.exports = validateRequest;

