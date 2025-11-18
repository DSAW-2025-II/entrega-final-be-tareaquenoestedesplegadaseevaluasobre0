// Controlador de vehículos: maneja peticiones HTTP para gestión de vehículos
// Todos los endpoints requieren autenticación (driverId desde JWT)
const VehicleService = require('../../domain/services/VehicleService');
const CreateVehicleDto = require('../../domain/dtos/CreateVehicleDto');
const UpdateVehicleDto = require('../../domain/dtos/UpdateVehicleDto');

class VehicleController {
  constructor() {
    this.vehicleService = new VehicleService();
  }

  // POST /api/vehicles: crear nuevo vehículo para el conductor autenticado
  // Soporta multipart/form-data para fotos de vehículo y SOAT
  async createVehicle(req, res, next) {
    try {
      const driverId = req.user?.sub; // Desde JWT

      if (!driverId) {
        return res.status(401).json({
          code: 'unauthorized',
          message: 'Authentication required'
        });
      }

      // Extraer archivos si es petición multipart
      const files = {
        vehiclePhoto: req.files?.vehiclePhoto?.[0],
        soatPhoto: req.files?.soatPhoto?.[0]
      };

      console.log('[VehicleController] Creating vehicle - Request data:', {
        body: req.body,
        files: files ? {
          vehiclePhoto: files.vehiclePhoto ? 'present' : 'missing',
          soatPhoto: files.soatPhoto ? 'present' : 'missing'
        } : 'no files',
        driverId: driverId
      });

      // Crear DTO de vehículo desde la petición (sin URLs de fotos)
      const createVehicleDto = CreateVehicleDto.fromMultipart(req.body, files, driverId);
      
      console.log('[VehicleController] DTO created:', {
        plate: createVehicleDto.plate,
        brand: createVehicleDto.brand,
        model: createVehicleDto.model,
        capacity: createVehicleDto.capacity
      });
      
      // Validar DTO
      createVehicleDto.validate();

      // Crear vehículo mediante servicio (pasar archivos para guardar en GridFS)
      const vehicle = await this.vehicleService.createVehicle(createVehicleDto, files);

      console.log('[VehicleController] Vehicle created successfully:', {
        id: vehicle.id,
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        capacity: vehicle.capacity,
        driverId: driverId
      });

      res.status(201).json(vehicle);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/vehicles/my-vehicle
   * Get the authenticated driver's vehicle
   * 
   * @param {Request} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next middleware
   */
  async getMyVehicle(req, res, next) {
    try {
      // Get driverId from authenticated user (req.user.sub from JWT)
      const driverId = req.user?.sub;

      if (!driverId) {
        return res.status(401).json({
          code: 'unauthorized',
          message: 'Authentication required'
        });
      }

      const vehicle = await this.vehicleService.getVehicleByDriverId(driverId);

      if (!vehicle) {
        console.log('[VehicleController] Vehicle not found for driver:', driverId);
        return res.status(404).json({
          code: 'vehicle_not_found',
          message: 'Vehicle not found for this driver'
        });
      }

      console.log('[VehicleController] Vehicle retrieved:', {
        id: vehicle.id,
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        capacity: vehicle.capacity,
        driverId: driverId
      });

      res.status(200).json(vehicle);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/vehicles/my-vehicle
   * Update the authenticated driver's vehicle
   * Supports partial updates and photo replacement
   * 
   * @param {Request} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next middleware
   */
  async updateMyVehicle(req, res, next) {
    try {
      console.log('[VehicleController] updateMyVehicle called');
      
      // Get driverId from authenticated user (req.user.sub from JWT)
      const driverId = req.user?.sub;
      console.log('[VehicleController] driverId:', driverId);

      if (!driverId) {
        return res.status(401).json({
          code: 'unauthorized',
          message: 'Authentication required'
        });
      }

      // Extract files if multipart request
      const files = {
        vehiclePhoto: req.files?.vehiclePhoto?.[0],
        soatPhoto: req.files?.soatPhoto?.[0]
      };
      
      console.log('[VehicleController] Files received:', {
        vehiclePhoto: files.vehiclePhoto ? {
          fieldname: files.vehiclePhoto.fieldname,
          originalname: files.vehiclePhoto.originalname,
          mimetype: files.vehiclePhoto.mimetype,
          size: files.vehiclePhoto.size,
          hasBuffer: !!files.vehiclePhoto.buffer,
          bufferLength: files.vehiclePhoto.buffer?.length
        } : null,
        soatPhoto: files.soatPhoto ? {
          fieldname: files.soatPhoto.fieldname,
          originalname: files.soatPhoto.originalname,
          mimetype: files.soatPhoto.mimetype,
          size: files.soatPhoto.size,
          hasBuffer: !!files.soatPhoto.buffer,
          bufferLength: files.soatPhoto.buffer?.length
        } : null
      });
      
      console.log('[VehicleController] Request body:', req.body);

      // Create update DTO from request
      const updateVehicleDto = UpdateVehicleDto.fromMultipart(req.body, files);
      console.log('[VehicleController] DTO created:', {
        plate: updateVehicleDto.plate,
        brand: updateVehicleDto.brand,
        model: updateVehicleDto.model,
        capacity: updateVehicleDto.capacity
      });
      
      // Validate DTO
      updateVehicleDto.validate();
      console.log('[VehicleController] DTO validated successfully');

      // Update vehicle through service (pasar archivos para guardar en GridFS)
      console.log('[VehicleController] Calling vehicleService.updateVehicle...');
      const vehicle = await this.vehicleService.updateVehicle(driverId, updateVehicleDto, files);
      console.log('[VehicleController] Vehicle updated successfully:', vehicle?.id);

      if (!vehicle) {
        return res.status(404).json({
          code: 'vehicle_not_found',
          message: 'Driver has no vehicle'
        });
      }

      res.status(200).json(vehicle);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/vehicles/my-vehicle
   * Delete the authenticated driver's vehicle
   * 
   * @param {Request} req - Express request with authenticated user
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next middleware
   */
  async deleteMyVehicle(req, res, next) {
    try {
      // Get driverId from authenticated user (req.user.sub from JWT)
      const driverId = req.user?.sub;

      if (!driverId) {
        return res.status(401).json({
          code: 'unauthorized',
          message: 'Authentication required'
        });
      }

      await this.vehicleService.deleteVehicle(driverId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/vehicles/:driverId/has-vehicle
   * Check if a driver has a vehicle (public endpoint for validation)
   * 
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   * @param {NextFunction} next - Express next middleware
   */
  async checkDriverHasVehicle(req, res, next) {
    try {
      const { driverId } = req.params;

      if (!driverId) {
        return res.status(400).json({
          code: 'invalid_request',
          message: 'Driver ID is required'
        });
      }

      const hasVehicle = await this.vehicleService.driverHasVehicle(driverId);

      res.status(200).json({
        driverId,
        hasVehicle
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = VehicleController;

