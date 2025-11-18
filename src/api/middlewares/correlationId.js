const { v4: uuidv4 } = require('uuid');

// Middleware para agregar correlation ID a cada request: útil para tracking y debugging
const correlationId = (req, res, next) => {
  // Generar o usar correlation ID existente
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  // Agregar al request para uso interno
  req.correlationId = correlationId;
  
  // Agregar al header de respuesta
  res.set('X-Correlation-ID', correlationId);
  
  next();
};

module.exports = correlationId;

