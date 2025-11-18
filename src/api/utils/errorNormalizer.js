/**
 * Normalizador de errores: asegura que todos los errores tengan un código de estado HTTP y un código de error estable.
 * Esto es defensivo: algunos lugares del código lanzan Error plano o establecen formas inconsistentes.
 */
const DomainError = require('../../domain/errors/DomainError');

// Mapeo de códigos de error a códigos de estado HTTP
const codeToStatus = {
  invalid_booking_state: 409, // Conflict
  duplicate_payment: 409, // Conflict
  booking_already_paid: 409, // Conflict
  forbidden_owner: 403, // Forbidden
  forbidden: 403, // Forbidden
  unauthorized: 401, // Unauthorized
  invalid_signature: 400, // Bad Request
  invalid_schema: 400, // Bad Request
  csrf_mismatch: 403, // Forbidden
  payload_too_large: 413 // Payload Too Large
};

/**
 * Convierte nombre de clase de error de camelCase a snake_case.
 * Ejemplo: 'InvalidBookingStateError' -> 'invalid_booking_state'
 */
function camelToSnake(str) {
  return str
    .replace(/Error$/, '') // Eliminar sufijo 'Error'
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // Insertar guion bajo antes de mayúsculas
    .toLowerCase();
}

/**
 * Normaliza un error para asegurar que tenga statusCode y code consistentes.
 * Maneja diferentes formas de errores: DomainError, Error plano, errores con código, etc.
 */
function normalizeError(err) {
  if (!err || typeof err !== 'object') return err;

  // Si ya tiene ambas propiedades, dejarlo como está
  if (typeof err.statusCode === 'number' && typeof err.code === 'string') {
    return err;
  }

  // Si es una instancia de DomainError, asegurar que los campos existan
  if (err instanceof DomainError) {
    err.statusCode = err.statusCode || 400;
    err.code = err.code || camelToSnake(err.name || 'domain_error');
    return err;
  }

  // Si el nombre parece una subclase de DomainError (pero instanceof falló por duplicación de módulos), derivar valores
  if (typeof err.name === 'string' && err.name.endsWith('Error')) {
    err.code = err.code || camelToSnake(err.name);
    // Si es uno de los errores de conflicto conocidos, marcar como 409
    if (['InvalidBookingStateError', 'DuplicatePaymentError', 'BookingAlreadyPaidError'].includes(err.name)) {
      err.statusCode = err.statusCode || 409;
    } else {
      err.statusCode = err.statusCode || 400;
    }
    return err;
  }

  // Si hay un código string presente, mapear a estado si es posible
  if (typeof err.code === 'string') {
    err.statusCode = err.statusCode || codeToStatus[err.code] || 400;
    return err;
  }

  // Si código numérico usado erróneamente como estado HTTP, respetarlo
  if (typeof err.code === 'number' && err.code >= 400 && err.code < 600) {
    err.statusCode = err.statusCode || err.code;
    // También establecer un código string genérico
    err.code = String(err.code);
    return err;
  }

  // Fallback: marcar como 500 (error del servidor) pero mantener mensaje
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'internal_server_error';
  return err;
}

module.exports = normalizeError;
