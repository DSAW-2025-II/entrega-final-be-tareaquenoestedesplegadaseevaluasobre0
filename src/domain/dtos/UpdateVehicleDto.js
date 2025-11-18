// DTO de actualización de vehículo: objeto de transferencia de datos para actualizaciones parciales de vehículo
class UpdateVehicleDto {
  constructor({
    plate,
    brand,
    model,
    capacity,
    vehiclePhotoUrl,
    soatPhotoUrl
  }) {
    if (plate !== undefined) this.plate = plate?.trim().toUpperCase();
    if (brand !== undefined) this.brand = brand?.trim();
    if (model !== undefined) this.model = model?.trim();
    if (capacity !== undefined) this.capacity = capacity;
    if (vehiclePhotoUrl !== undefined) this.vehiclePhotoUrl = vehiclePhotoUrl;
    if (soatPhotoUrl !== undefined) this.soatPhotoUrl = soatPhotoUrl;
  }

  // Crear DTO desde body de request (semántica PATCH - actualizaciones parciales)
  static fromRequest(body) {
    return new UpdateVehicleDto({
      plate: body.plate,
      brand: body.brand,
      model: body.model,
      capacity: body.capacity ? parseInt(body.capacity) : undefined,
      vehiclePhotoUrl: body.vehiclePhotoUrl,
      soatPhotoUrl: body.soatPhotoUrl
    });
  }

  // Crear DTO desde request multipart/form-data
  static fromMultipart(fields, files) {
    const vehiclePhotoUrl = files?.vehiclePhoto ? `/uploads/vehicles/${files.vehiclePhoto.filename}` : undefined;
    const soatPhotoUrl = files?.soatPhoto ? `/uploads/vehicles/${files.soatPhoto.filename}` : undefined;

    return new UpdateVehicleDto({
      plate: fields.plate,
      brand: fields.brand,
      model: fields.model,
      capacity: fields.capacity ? parseInt(fields.capacity) : undefined,
      vehiclePhotoUrl,
      soatPhotoUrl
    });
  }

  // Validar datos del DTO: lanza ValidationError si la validación falla
  validate() {
    const errors = [];

    // Validación de placa (si está presente)
    if (this.plate !== undefined) {
      if (!/^[A-Z]{3}[0-9]{3}$/.test(this.plate)) {
        errors.push({ field: 'plate', issue: 'Plate must be in format ABC123 (3 letters, 3 numbers)' });
      }
    }

    // Validación de marca (si está presente)
    if (this.brand !== undefined && (this.brand.length < 2 || this.brand.length > 60)) {
      errors.push({ field: 'brand', issue: 'Brand must be between 2 and 60 characters' });
    }

    // Validación de modelo (si está presente)
    if (this.model !== undefined && (this.model.length < 1 || this.model.length > 60)) {
      errors.push({ field: 'model', issue: 'Model must be between 1 and 60 characters' });
    }

    // Validación de capacidad (si está presente)
    if (this.capacity !== undefined && (this.capacity < 1 || this.capacity > 20)) {
      errors.push({ field: 'capacity', issue: 'Capacity must be between 1 and 20 passengers' });
    }

    if (errors.length > 0) {
      const ValidationError = require('../errors/ValidationError');
      throw new ValidationError('Vehicle update validation failed', 'invalid_vehicle_data', errors);
    }
  }

  /**
   * Convert to plain object for database update
   * @returns {Object} - Plain object with only defined fields
   */
  toObject() {
    const obj = {};
    if (this.plate !== undefined) obj.plate = this.plate;
    if (this.brand !== undefined) obj.brand = this.brand;
    if (this.model !== undefined) obj.model = this.model;
    if (this.capacity !== undefined) obj.capacity = this.capacity;
    if (this.vehiclePhotoUrl !== undefined) obj.vehiclePhotoUrl = this.vehiclePhotoUrl;
    if (this.soatPhotoUrl !== undefined) obj.soatPhotoUrl = this.soatPhotoUrl;
    return obj;
  }
}

module.exports = UpdateVehicleDto;

