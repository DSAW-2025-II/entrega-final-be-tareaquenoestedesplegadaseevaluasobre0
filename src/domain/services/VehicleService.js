// Servicio de vehículos: lógica de negocio para operaciones de vehículos
// Aplica regla de negocio: un vehículo por conductor
const MongoVehicleRepository = require('../../infrastructure/repositories/MongoVehicleRepository');
const CreateVehicleDto = require('../dtos/CreateVehicleDto');
const UpdateVehicleDto = require('../dtos/UpdateVehicleDto');
const VehicleResponseDto = require('../dtos/VehicleResponseDto');
const OneVehicleRuleError = require('../errors/OneVehicleRuleError');
const DuplicatePlateError = require('../errors/DuplicatePlateError');

class VehicleService {
  constructor() {
    this.vehicleRepository = new MongoVehicleRepository();
  }

  // Crear nuevo vehículo para un conductor: valida regla de un vehículo por conductor y placa única
  async createVehicle(createVehicleDto) {
    // Verificar si el conductor ya tiene un vehículo
    const hasVehicle = await this.vehicleRepository.driverHasVehicle(createVehicleDto.driverId);
    if (hasVehicle) {
      throw new OneVehicleRuleError(
        'Driver can only have one vehicle',
        'one_vehicle_rule',
        { driverId: createVehicleDto.driverId }
      );
    }

    // Verificar si la placa ya existe
    const plateExists = await this.vehicleRepository.plateExists(createVehicleDto.plate);
    if (plateExists) {
      throw new DuplicatePlateError(
        'Vehicle plate already exists',
        'duplicate_plate',
        { plate: createVehicleDto.plate }
      );
    }

    // Crear vehículo en el repositorio
    const vehicleData = createVehicleDto.toObject();
    const vehicle = await this.vehicleRepository.create(vehicleData);
    
    const responseDto = VehicleResponseDto.fromEntity(vehicle);
    return responseDto;
  }

  // Obtener vehículo por ID de conductor
  async getVehicleByDriverId(driverId) {
    const vehicle = await this.vehicleRepository.findByDriverId(driverId);
    return vehicle ? VehicleResponseDto.fromEntity(vehicle) : null;
  }

  // Actualizar vehículo por ID de conductor: elimina fotos antiguas si se proporcionan nuevas, valida placa duplicada
  async updateVehicle(driverId, updateVehicleDto) {
    // Verificar si el vehículo existe
    const existingVehicle = await this.vehicleRepository.findByDriverId(driverId);
    if (!existingVehicle) {
      return null;
    }

    // Obtener datos de actualización
    const updateData = updateVehicleDto.toObject();

    // Si se está actualizando la placa, validar que no sea la misma y que no esté duplicada
    if (updateData.plate) {
      // Validar que la nueva placa no sea la misma que la actual
      if (updateData.plate === existingVehicle.plate) {
        throw new DuplicatePlateError(
          'New plate must be different from current plate',
          'same_plate',
          { plate: updateData.plate }
        );
      }
      
      // Validar que la nueva placa no esté registrada por otro conductor
      const plateExists = await this.vehicleRepository.plateExists(updateData.plate, existingVehicle.id);
      if (plateExists) {
        throw new DuplicatePlateError(
          'Vehicle plate already exists',
          'duplicate_plate',
          { plate: updateData.plate }
        );
      }
    }

    // Eliminar fotos antiguas si se proporcionan nuevas
    if (updateData.vehiclePhotoUrl && existingVehicle.vehiclePhotoUrl) {
      const fs = require('fs').promises;
      const path = require('path');
      const oldPath = path.join(__dirname, '../../../', existingVehicle.vehiclePhotoUrl);
      try {
        await fs.unlink(oldPath);
      } catch (err) {
        console.error('Error deleting old vehicle photo:', err);
      }
    }

    if (updateData.soatPhotoUrl && existingVehicle.soatPhotoUrl) {
      const fs = require('fs').promises;
      const path = require('path');
      const oldPath = path.join(__dirname, '../../../', existingVehicle.soatPhotoUrl);
      try {
        await fs.unlink(oldPath);
      } catch (err) {
        console.error('Error deleting old SOAT photo:', err);
      }
    }

    // Actualizar vehículo
    const updatedVehicle = await this.vehicleRepository.updateByDriverId(driverId, updateData);
    return updatedVehicle ? VehicleResponseDto.fromEntity(updatedVehicle) : null;
  }

  // Eliminar vehículo por ID de conductor: limpia imágenes después de la eliminación
  async deleteVehicle(driverId) {
    try {
      // Obtener vehículo para limpiar imágenes
      const vehicle = await this.vehicleRepository.findByDriverId(driverId);
      if (!vehicle) {
        return false;
      }

      // Eliminar vehículo
      const deleted = await this.vehicleRepository.deleteByDriverId(driverId);

      // Limpiar imágenes después de la eliminación exitosa
      if (deleted) {
        const fs = require('fs').promises;
        const path = require('path');

        if (vehicle.vehiclePhotoUrl) {
          const photoPath = path.join(__dirname, '../../../', vehicle.vehiclePhotoUrl);
          try {
            await fs.unlink(photoPath);
          } catch (err) {
            console.error('Error deleting vehicle photo:', err);
          }
        }

        if (vehicle.soatPhotoUrl) {
          const soatPath = path.join(__dirname, '../../../', vehicle.soatPhotoUrl);
          try {
            await fs.unlink(soatPath);
          } catch (err) {
            console.error('Error deleting SOAT photo:', err);
          }
        }
      }

      return deleted;
    } catch (error) {
      throw error;
    }
  }

  // Verificar si el conductor tiene un vehículo
  async driverHasVehicle(driverId) {
    return await this.vehicleRepository.driverHasVehicle(driverId);
  }
}

module.exports = VehicleService;

