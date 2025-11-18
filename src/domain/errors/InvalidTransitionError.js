/**
 * Error de transición inválida: se lanza al intentar una transición de estado ilegal.
 * Usado para validaciones de ciclo de vida tanto de TripOffer como de BookingRequest.
 * 
 * Ejemplo:
 *   throw new InvalidTransitionError(
 *     'No se puede cancelar un viaje completado',
 *     'completed',
 *     'canceled'
 *   );
 */

const DomainError = require('./DomainError');

class InvalidTransitionError extends DomainError {
  /**
   * @param {string} message - Mensaje de error legible por humanos
   * @param {string} currentState - Estado actual de la entidad
   * @param {string} attemptedState - Estado que se intentó
   * @param {number} statusCode - Código de estado HTTP (por defecto: 409 Conflict)
   */
  constructor(message, currentState, attemptedState, statusCode = 409) {
    super(message, 'invalid_transition', statusCode);
    this.currentState = currentState;
    this.attemptedState = attemptedState;
    this.name = 'InvalidTransitionError';
  }

  /**
   * Obtiene objeto de detalles para respuesta de API.
   * @returns {Object} Detalles de la transición
   */
  getDetails() {
    return {
      currentState: this.currentState,
      attemptedState: this.attemptedState
    };
  }
}

module.exports = InvalidTransitionError;
