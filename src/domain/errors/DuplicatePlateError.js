/**
 * Error de placa duplicada: se lanza cuando se intenta registrar un vehículo con una placa que ya existe.
 * Las placas deben ser únicas en el sistema.
 */
const DomainError = require('./DomainError');

class DuplicatePlateError extends DomainError {
  constructor(message = 'Vehicle plate already exists', code = 'duplicate_plate', plate) {
    super(message, code, 409);
    this.plate = plate; // Placa duplicada
  }
}

module.exports = DuplicatePlateError;

