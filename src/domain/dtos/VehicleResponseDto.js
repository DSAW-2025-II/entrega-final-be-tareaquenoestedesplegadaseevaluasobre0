// DTO de respuesta de vehículo: objeto de transferencia de datos para respuestas de vehículos
// Oculta campos internos y proporciona forma consistente de API
class VehicleResponseDto {
  constructor({
    id,
    plate,
    brand,
    model,
    capacity,
    vehiclePhotoUrl = null,
    soatPhotoUrl = null,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.plate = plate;
    this.brand = brand;
    this.model = model;
    this.capacity = capacity;
    this.vehiclePhotoUrl = vehiclePhotoUrl;
    this.soatPhotoUrl = soatPhotoUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Crear DTO desde entidad Vehicle
  static fromEntity(vehicle) {
    return new VehicleResponseDto({
      id: vehicle.id,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      capacity: vehicle.capacity,
      vehiclePhotoUrl: vehicle.vehiclePhotoUrl,
      soatPhotoUrl: vehicle.soatPhotoUrl,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt
    });
  }

  // Crear DTO desde documento MongoDB
  static fromDocument(doc) {
    return new VehicleResponseDto({
      id: doc._id.toString(),
      plate: doc.plate,
      brand: doc.brand,
      model: doc.model,
      capacity: doc.capacity,
      vehiclePhotoUrl: doc.vehiclePhotoUrl,
      soatPhotoUrl: doc.soatPhotoUrl,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  /**
   * Get vehicle display name
   * @returns {string} - Formatted vehicle name
   */
  getDisplayName() {
    return `${this.brand} ${this.model}`;
  }

  /**
   * Check if vehicle has photos
   * @returns {boolean} - True if vehicle has photos
   */
  hasPhotos() {
    return !!(this.vehiclePhotoUrl || this.soatPhotoUrl);
  }
}

module.exports = VehicleResponseDto;

