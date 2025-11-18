// Servicio de vehículos: lógica de negocio para operaciones de vehículos
// Aplica regla de negocio: un vehículo por conductor
const MongoVehicleRepository = require('../../infrastructure/repositories/MongoVehicleRepository');
const CreateVehicleDto = require('../dtos/CreateVehicleDto');
const UpdateVehicleDto = require('../dtos/UpdateVehicleDto');
const VehicleResponseDto = require('../dtos/VehicleResponseDto');
const OneVehicleRuleError = require('../errors/OneVehicleRuleError');
const DuplicatePlateError = require('../errors/DuplicatePlateError');
const gridfsStorage = require('../../infrastructure/storage/gridfsStorage');
const path = require('path');

class VehicleService {
  constructor() {
    this.vehicleRepository = new MongoVehicleRepository();
  }

  // Crear nuevo vehículo para un conductor: valida regla de un vehículo por conductor y placa única
  async createVehicle(createVehicleDto, files = {}) {
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

    // Guardar fotos en GridFS si están presentes
    const vehicleData = createVehicleDto.toObject();
    
    if (files.vehiclePhoto && files.vehiclePhoto.buffer) {
      const ext = path.extname(files.vehiclePhoto.originalname);
      const filename = `vehicle-${createVehicleDto.driverId}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      const fileId = await gridfsStorage.saveFile(files.vehiclePhoto.buffer, {
        filename,
        contentType: files.vehiclePhoto.mimetype,
        category: 'vehicles',
        userId: createVehicleDto.driverId
      });
      vehicleData.vehiclePhotoUrl = `/api/files/${fileId}`;
    }
    
    if (files.soatPhoto && files.soatPhoto.buffer) {
      const ext = path.extname(files.soatPhoto.originalname);
      const filename = `soat-${createVehicleDto.driverId}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      const fileId = await gridfsStorage.saveFile(files.soatPhoto.buffer, {
        filename,
        contentType: files.soatPhoto.mimetype,
        category: 'vehicles',
        userId: createVehicleDto.driverId
      });
      vehicleData.soatPhotoUrl = `/api/files/${fileId}`;
    }

    // Crear vehículo en el repositorio
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

    // Guardar nuevas fotos en GridFS si están presentes
    if (files && files.vehiclePhoto && files.vehiclePhoto.buffer) {
      const ext = path.extname(files.vehiclePhoto.originalname);
      const filename = `vehicle-${driverId}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      const fileId = await gridfsStorage.saveFile(files.vehiclePhoto.buffer, {
        filename,
        contentType: files.vehiclePhoto.mimetype,
        category: 'vehicles',
        userId: driverId
      });
      updateData.vehiclePhotoUrl = `/api/files/${fileId}`;
      
      // Eliminar foto antigua de GridFS si existe
      if (existingVehicle.vehiclePhotoUrl) {
        const oldPhotoIdMatch = existingVehicle.vehiclePhotoUrl.match(/\/api\/files\/([a-f\d]{24})/i);
        if (oldPhotoIdMatch) {
          try {
            await gridfsStorage.deleteFile(oldPhotoIdMatch[1]);
            console.log(`[VehicleService] Deleted old vehicle photo from GridFS: ${oldPhotoIdMatch[1]}`);
          } catch (err) {
            console.error('Error deleting old vehicle photo from GridFS:', err);
          }
        }
      }
    }

    if (files && files.soatPhoto && files.soatPhoto.buffer) {
      const ext = path.extname(files.soatPhoto.originalname);
      const filename = `soat-${driverId}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      const fileId = await gridfsStorage.saveFile(files.soatPhoto.buffer, {
        filename,
        contentType: files.soatPhoto.mimetype,
        category: 'vehicles',
        userId: driverId
      });
      updateData.soatPhotoUrl = `/api/files/${fileId}`;
      
      // Eliminar foto antigua de GridFS si existe
      if (existingVehicle.soatPhotoUrl) {
        const oldPhotoIdMatch = existingVehicle.soatPhotoUrl.match(/\/api\/files\/([a-f\d]{24})/i);
        if (oldPhotoIdMatch) {
          try {
            await gridfsStorage.deleteFile(oldPhotoIdMatch[1]);
            console.log(`[VehicleService] Deleted old SOAT photo from GridFS: ${oldPhotoIdMatch[1]}`);
          } catch (err) {
            console.error('Error deleting old SOAT photo from GridFS:', err);
          }
        }
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

