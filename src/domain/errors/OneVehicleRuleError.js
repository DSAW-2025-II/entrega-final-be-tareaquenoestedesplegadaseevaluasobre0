/**
 * Error de regla de un vehículo: se lanza cuando un conductor intenta registrar un segundo vehículo.
 * La regla de negocio permite solo un vehículo por conductor.
 */
const DomainError = require('./DomainError');

class OneVehicleRuleError extends DomainError {
  constructor(message = 'Driver already has a vehicle', code = 'one_vehicle_rule', driverId) {
    super(message, code, 409);
    this.driverId = driverId; // ID del conductor que intentó registrar el segundo vehículo
  }
}

module.exports = OneVehicleRuleError;

