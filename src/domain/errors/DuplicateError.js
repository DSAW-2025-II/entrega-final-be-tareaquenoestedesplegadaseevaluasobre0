/**
 * Error de duplicado: se lanza cuando se intenta crear una entidad con un valor único que ya existe.
 * Incluye información sobre el campo y valor duplicado.
 */
const DomainError = require('./DomainError');

class DuplicateError extends DomainError {
    constructor(message, code, metadata = {}) {
        super(message, code, 409);
        this.field = metadata.field; // Campo que causó el duplicado
        this.value = metadata.value; // Valor duplicado
    }
}

module.exports = DuplicateError;

