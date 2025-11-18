/**
 * Error de dominio: clase base para todos los errores de dominio del sistema.
 * Proporciona estructura consistente con código de error, código de estado HTTP y detalles adicionales.
 */
class DomainError extends Error {
  constructor(message, statusCode = 500, code = 'domain_error', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code; // Código de error para identificación programática
    this.statusCode = statusCode; // Código de estado HTTP para respuestas API
    this.details = details; // Detalles adicionales del error
  }
}

module.exports = DomainError;

