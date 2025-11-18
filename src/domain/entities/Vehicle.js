// Entidad de dominio Vehicle: representa vehículo propiedad de un conductor
// Aplica regla de negocio: un vehículo por conductor
class Vehicle {
  constructor({
    id,
    driverId,
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
    this.driverId = driverId;
    this.plate = plate;
    this.brand = brand;
    this.model = model;
    this.capacity = capacity;
    this.vehiclePhotoUrl = vehiclePhotoUrl;
    this.soatPhotoUrl = soatPhotoUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Crear Vehicle desde documento de MongoDB
  static fromDocument(doc) {
    return new Vehicle({
      id: doc._id.toString(),
      driverId: doc.driverId.toString(),
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

  // Verificar si el vehículo tiene fotos
  hasPhotos() {
    return !!(this.vehiclePhotoUrl || this.soatPhotoUrl);
  }

  // Obtener nombre de visualización del vehículo
  getDisplayName() {
    return `${this.brand} ${this.model}`;
  }

  // Verificar si el vehículo está completo (tiene todos los datos requeridos)
  isComplete() {
    return !!(this.driverId && this.plate && this.brand && this.model && this.capacity);
  }
}

module.exports = Vehicle;

