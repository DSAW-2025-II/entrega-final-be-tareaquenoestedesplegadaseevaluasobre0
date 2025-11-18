// DTO de creación de vehículo: objeto de transferencia de datos para creación de vehículo
// Valida y sanitiza datos de creación de vehículo
class CreateVehicleDto {
  constructor({
    driverId,
    plate,
    brand,
    model,
    capacity,
    vehiclePhotoUrl = null,
    soatPhotoUrl = null
  }) {
    this.driverId = driverId;
    this.plate = plate?.toUpperCase().trim();
    this.brand = brand?.trim();
    this.model = model?.trim();
    this.capacity = capacity;
    this.vehiclePhotoUrl = vehiclePhotoUrl;
    this.soatPhotoUrl = soatPhotoUrl;
  }

  // Crear DTO desde body de request
  static fromRequest(body, driverId) {
    return new CreateVehicleDto({
      driverId,
      plate: body.plate,
      brand: body.brand,
      model: body.model,
      capacity: parseInt(body.capacity),
      vehiclePhotoUrl: body.vehiclePhotoUrl || null,
      soatPhotoUrl: body.soatPhotoUrl || null
    });
  }

  // Crear DTO desde request multipart/form-data
  // Nota: files ahora contiene Buffers en memoria, las URLs se generarán después de guardar en GridFS
  static fromMultipart(fields, files, driverId) {
    // No establecer URLs aquí - se establecerán después de guardar en GridFS
    return new CreateVehicleDto({
      driverId,
      plate: fields.plate,
      brand: fields.brand,
      model: fields.model,
      capacity: parseInt(fields.capacity),
      vehiclePhotoUrl: undefined, // Se establecerá después de guardar en GridFS
      soatPhotoUrl: undefined // Se establecerá después de guardar en GridFS
    });
  }

  // Validar datos del DTO: lanza ValidationError si la validación falla
  validate() {
    const errors = [];

    // Campos requeridos
    if (!this.driverId) errors.push({ field: 'driverId', issue: 'Driver ID is required' });
    if (!this.plate) errors.push({ field: 'plate', issue: 'Plate is required' });
    if (!this.brand) errors.push({ field: 'brand', issue: 'Brand is required' });
    if (!this.model) errors.push({ field: 'model', issue: 'Model is required' });
    if (!this.capacity) errors.push({ field: 'capacity', issue: 'Capacity is required' });

    // Validación de formato de placa
    if (this.plate && !/^[A-Z]{3}[0-9]{3}$/.test(this.plate)) {
      errors.push({ field: 'plate', issue: 'Plate must be in format ABC123 (3 letters, 3 numbers)' });
    }

    // Brand validation
    if (this.brand && (this.brand.length < 2 || this.brand.length > 60)) {
      errors.push({ field: 'brand', issue: 'Brand must be between 2 and 60 characters' });
    }

    // Model validation
    if (this.model && (this.model.length < 1 || this.model.length > 60)) {
      errors.push({ field: 'model', issue: 'Model must be between 1 and 60 characters' });
    }

    // Capacity validation
    if (this.capacity && (this.capacity < 1 || this.capacity > 20)) {
      errors.push({ field: 'capacity', issue: 'Capacity must be between 1 and 20 passengers' });
    }

    if (errors.length > 0) {
      const ValidationError = require('../errors/ValidationError');
      throw new ValidationError('Vehicle creation validation failed', 'invalid_vehicle_data', errors);
    }
  }

  /**
   * Convert to plain object for database storage
   * @returns {Object} - Plain object
   */
  toObject() {
    return {
      driverId: this.driverId,
      plate: this.plate,
      brand: this.brand,
      model: this.model,
      capacity: this.capacity,
      vehiclePhotoUrl: this.vehiclePhotoUrl,
      soatPhotoUrl: this.soatPhotoUrl
    };
  }
}

module.exports = CreateVehicleDto;

