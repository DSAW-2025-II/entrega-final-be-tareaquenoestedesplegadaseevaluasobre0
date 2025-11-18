/**
 * Error de validación: se lanza cuando los datos de entrada no cumplen con el esquema esperado.
 * Incluye detalles de los campos que fallaron la validación.
 */
const DomainError = require('./DomainError');

class ValidationError extends DomainError {
    constructor(message, code = 'invalid_schema', details = []) {
        super(message, code, 400);
        this.details = details; // Array de detalles de validación (campos con errores)
    }
}

module.exports = ValidationError;

