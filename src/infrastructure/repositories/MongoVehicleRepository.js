// Repositorio de vehículos MongoDB: implementación de VehicleRepository para MongoDB
// Aplica regla de negocio: un vehículo por conductor
const VehicleRepository = require('../../domain/repositories/VehicleRepository');
const VehicleModel = require('../database/models/VehicleModel');
const Vehicle = require('../../domain/entities/Vehicle');
const OneVehicleRuleError = require('../../domain/errors/OneVehicleRuleError');
const DuplicatePlateError = require('../../domain/errors/DuplicatePlateError');
const ValidationError = require('../../domain/errors/ValidationError');

class MongoVehicleRepository extends VehicleRepository {
  // Crear nuevo vehículo con control de concurrencia: valida regla de un vehículo por conductor y placa única usando transacciones
  async create(vehicleData) {
    const session = await VehicleModel.startSession();
    
    try {
      let createdVehicle = null;
      
      await session.withTransaction(async () => {
        // Verificar si el conductor ya tiene un vehículo
        const existingVehicle = await VehicleModel.findOne({ driverId: vehicleData.driverId }).session(session);
        if (existingVehicle) {
          throw new OneVehicleRuleError(
            'Driver can only have one vehicle',
            'one_vehicle_rule',
            { driverId: vehicleData.driverId, existingVehicleId: existingVehicle._id.toString() }
          );
        }

        // Verificar si la placa ya existe
        const plateExists = await VehicleModel.findOne({ plate: vehicleData.plate }).session(session);
        if (plateExists) {
          throw new DuplicatePlateError(
            'Vehicle plate already exists',
            'duplicate_plate',
            { plate: vehicleData.plate, existingVehicleId: plateExists._id.toString() }
          );
        }

        // Crear vehículo
        const vehicle = new VehicleModel(vehicleData);
        await vehicle.save({ session });
        createdVehicle = vehicle;
      });
      
      return createdVehicle ? Vehicle.fromDocument(createdVehicle) : null;
    } catch (error) {
      if (error instanceof OneVehicleRuleError || error instanceof DuplicatePlateError) {
        throw error;
      }
      
      // Manejar violaciones de restricción única de MongoDB (E11000)
      if (error.code === 11000 || error.name === 'MongoServerError') {
        const keyPattern = error.keyPattern || {};
        const keyValue = error.keyValue || {};
        
        // Verificar qué restricción única fue violada
        if (keyPattern.driverId) {
          throw new OneVehicleRuleError(
            'Driver can only have one vehicle',
            'one_vehicle_rule',
            { driverId: keyValue.driverId }
          );
        }
        
        if (keyPattern.plate) {
          throw new DuplicatePlateError(
            'Vehicle plate already exists',
            'duplicate_plate',
            { plate: keyValue.plate }
          );
        }
        
        // Generic duplicate error
        throw new DuplicatePlateError(
          'Duplicate vehicle data',
          'duplicate_vehicle',
          { keys: Object.keys(keyPattern) }
        );
      }
      
      if (error.name === 'ValidationError') {
        throw new ValidationError('Invalid vehicle data', 'invalid_schema', this._formatValidationErrors(error));
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Find vehicle by ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Vehicle|null>} - Vehicle or null
   */
  async findById(vehicleId) {
    try {
      const vehicle = await VehicleModel.findById(vehicleId);
      return vehicle ? Vehicle.fromDocument(vehicle) : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find vehicle by driver ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<Vehicle|null>} - Vehicle or null
   */
  async findByDriverId(driverId) {
    try {
      const vehicle = await VehicleModel.findOne({ driverId });
      return vehicle ? Vehicle.fromDocument(vehicle) : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find vehicle by plate
   * @param {string} plate - Vehicle plate
   * @returns {Promise<Vehicle|null>} - Vehicle or null
   */
  async findByPlate(plate) {
    try {
      const vehicle = await VehicleModel.findByPlate(plate);
      return vehicle ? Vehicle.fromDocument(vehicle) : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update vehicle by driver ID
   * @param {string} driverId - Driver ID
   * @param {Object} updates - Update data
   * @returns {Promise<Vehicle|null>} - Updated vehicle or null
   */
  async updateByDriverId(driverId, updates) {
    try {
      const vehicle = await VehicleModel.findOneAndUpdate(
        { driverId },
        { $set: updates },
        { new: true, runValidators: true }
      );
      return vehicle ? Vehicle.fromDocument(vehicle) : null;
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError('Invalid vehicle update data', 'invalid_schema', this._formatValidationErrors(error));
      }
      throw error;
    }
  }

  /**
   * Check if driver has a vehicle
   * @param {string} driverId - Driver ID
   * @returns {Promise<boolean>} - True if driver has vehicle
   */
  async driverHasVehicle(driverId) {
    try {
      return await VehicleModel.driverHasVehicle(driverId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if plate exists
   * @param {string} plate - Vehicle plate
   * @param {string} excludeId - Vehicle ID to exclude from check
   * @returns {Promise<boolean>} - True if plate exists
   */
  async plateExists(plate, excludeId = null) {
    try {
      return await VehicleModel.plateExists(plate, excludeId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete vehicle by driver ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteByDriverId(driverId) {
    try {
      const result = await VehicleModel.deleteOne({ driverId });
      return result.deletedCount > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get vehicle count by driver ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<number>} - Vehicle count
   */
  async countByDriverId(driverId) {
    try {
      return await VehicleModel.countDocuments({ driverId });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Format Mongoose validation errors
   * @param {Error} error - Mongoose validation error
   * @returns {Array} - Formatted error details
   */
  _formatValidationErrors(error) {
    const details = [];
    if (error.errors) {
      for (const field in error.errors) {
        details.push({
          field,
          issue: error.errors[field].message
        });
      }
    }
    return details;
  }
}

module.exports = MongoVehicleRepository;

