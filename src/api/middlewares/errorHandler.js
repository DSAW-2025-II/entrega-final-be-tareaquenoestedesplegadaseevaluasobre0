// Middleware global de manejo de errores: convierte errores de dominio a respuestas HTTP apropiadas
// Maneja DomainError, errores de Multer (carga de archivos) y errores genéricos del servidor
const DomainError = require('../../domain/errors/DomainError');

const errorHandler = (err, req, res, next) => {
  // Registrar error para debugging con información de contexto
  console.error('Error caught by errorHandler:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    url: req.url,
    method: req.method,
    correlationId: req.correlationId
  });

  // Si es un DomainError (preferido) o tiene statusCode/code explícito, usarlos
  // Ser defensivo: algunos caminos de código lanzan Error plano con un `code` string pero sin
  // statusCode numérico. Normalizar esos casos a estados HTTP sensatos para que
  // las pruebas de integración que esperan 4xx obtengan la respuesta correcta en lugar de 500
  if (err instanceof DomainError || err.code || typeof err.statusCode === 'number') {
    // Mapeo conocido para códigos de error de dominio comunes (fallbacks)
    const codeToStatus = {
      invalid_booking_state: 409,
      duplicate_payment: 409,
      forbidden_owner: 403,
      forbidden: 403,
      unauthorized: 401,
      invalid_signature: 400,
      invalid_schema: 400,
      csrf_mismatch: 403,
      payload_too_large: 413
    };

    let status = 500;
    // Preferir statusCode explícito
    if (typeof err.statusCode === 'number') {
      status = err.statusCode;
    } else if (typeof err.code === 'number' && err.code >= 400 && err.code < 600) {
      // Algunos caminos de código establecen incorrectamente `code` numérico (ej. 409) en lugar de
      // `statusCode`. Si detectamos eso, honrarlo como el estado HTTP
      status = err.code;
    } else if (err instanceof DomainError && typeof err.statusCode === 'number') {
      status = err.statusCode;
    } else if (err.code && codeToStatus[err.code]) {
      status = codeToStatus[err.code];
    } else if (err instanceof DomainError) {
      // Errores de dominio sin statusCode por defecto a 400 (error del cliente)
      status = 400;
    } else if (err.code) {
      // Error genérico con code pero mapeo desconocido -> tratar como 400
      status = 400;
    }
    // Determinar un código string estable para el cuerpo de la respuesta. Preferir un string
    // `err.code` cuando esté disponible; de lo contrario derivar del nombre de la subclase DomainError
    // (ej. InvalidBookingStateError -> invalid_booking_state)
    let responseCode = 'error';
    if (typeof err.code === 'string') {
      responseCode = err.code;
    } else if (err instanceof DomainError && err.name) {
      // Convert CamelCaseErrorName to snake_case without the trailing 'Error'
      responseCode = err.name.replace(/Error$/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase();
    }

    return res.status(status).json({
      code: responseCode,
      message: err.message || (status >= 500 ? 'Internal server error' : 'Bad request'),
      ...(err.details && { details: err.details }),
      ...(err.field && { field: err.field }),
      ...(err.value && { value: err.value }),
      correlationId: req.correlationId
    });
  }

  // Errores de Multer: manejo específico para errores de carga de archivos
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      code: 'payload_too_large',
      message: 'File exceeds limit',
      correlationId: req.correlationId
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      code: 'invalid_file_type',
      message: 'Unexpected file field',
      correlationId: req.correlationId
    });
  }

  // Error genérico del servidor: captura cualquier error no manejado anteriormente
  console.error('Unhandled error:', err);
  res.status(500).json({
    code: 'internal_server_error',
    message: 'Internal server error',
    correlationId: req.correlationId
  });
};

module.exports = errorHandler;

