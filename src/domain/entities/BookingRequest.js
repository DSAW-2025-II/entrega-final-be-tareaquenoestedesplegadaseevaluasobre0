// Entidad de dominio BookingRequest: representa solicitud de pasajero para reservar asientos en oferta de viaje
// Encapsula lógica de negocio e invariantes para solicitudes de reserva
const InvalidTransitionError = require('../errors/InvalidTransitionError');

class BookingRequest {
  constructor({
    id,
    tripId,
    passengerId,
    status = 'pending',
    seats = 1,
    note = '',
    acceptedAt = null,
    acceptedBy = null,
    declinedAt = null,
    declinedBy = null,
    canceledAt = null,
    cancellationReason = '', // Pista de auditoría opcional para cancelaciones de pasajero
    refundNeeded = false, // Bandera interna para hooks de política de reembolso
    paymentMethod = null, // 'card' o 'cash'
    paymentStatus = null, // 'pending' o 'completed'
    stripePaymentIntentId = null,
    paidAt = null,
    isPaid = false, // Estado de pago (sincronización de modelo de lectura)
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.tripId = tripId;
    this.passengerId = passengerId;
    this.status = status;
    this.seats = seats;
    this.note = note;
    this.acceptedAt = acceptedAt;
    this.acceptedBy = acceptedBy;
    this.declinedAt = declinedAt;
    this.declinedBy = declinedBy;
    this.canceledAt = canceledAt;
    this.cancellationReason = cancellationReason; // Pista de auditoría
    this.refundNeeded = refundNeeded; // Bandera interna, nunca expuesta en DTOs
    this.paymentMethod = paymentMethod;
    this.paymentStatus = paymentStatus;
    this.stripePaymentIntentId = stripePaymentIntentId;
    this.paidAt = paidAt;
    this.isPaid = isPaid; // Estado de pago
    this.createdAt = createdAt;
    this.updatedAt = new Date();

    this.validate();
  }

  // Validar invariantes de solicitud de reserva
  validate() {
    if (!this.tripId) {
      throw new Error('Trip ID is required');
    }

    if (!this.passengerId) {
      throw new Error('Passenger ID is required');
    }

    // Valores de estado extendidos
    const validStatuses = [
      'pending',
      'accepted',
      'declined',
      'declined_auto', // Conductor cancela viaje
      'canceled_by_passenger',
      'canceled_by_platform', // Conductor cancela viaje
      'expired'
    ];
    
    if (!validStatuses.includes(this.status)) {
      throw new Error(`Invalid status: ${this.status}`);
    }

    if (!Number.isInteger(this.seats) || this.seats < 1) {
      throw new Error('Seats must be a positive integer');
    }

    if (this.note && this.note.length > 300) {
      throw new Error('Note cannot exceed 300 characters');
    }
  }

  // Verificar si esta reserva está activa (no cancelada/expirada): activa significa pending o accepted
  isActive() {
    return this.status === 'pending' || this.status === 'accepted';
  }

  // Verificar si esta reserva está pendiente (esperando acción del conductor)
  isPending() {
    return this.status === 'pending';
  }

  // Verificar si esta reserva ha sido aceptada por el conductor
  isAccepted() {
    return this.status === 'accepted';
  }

  // Verificar si esta reserva ha sido rechazada por el conductor
  isDeclined() {
    return this.status === 'declined';
  }

  // Verificar si esta reserva ha sido cancelada por el pasajero
  isCanceledByPassenger() {
    return this.status === 'canceled_by_passenger';
  }

  // Verificar si esta reserva es cancelable por pasajero: estados legales para cancelación son pending, accepted
  // No se puede cancelar: ya cancelada, rechazada, expirada
  isCancelableByPassenger() {
    return this.status === 'pending' || this.status === 'accepted';
  }

  // Verificar si cancelar esta reserva requiere desasignación de asientos: solo reservas aceptadas tienen asientos asignados en el ledger
  needsSeatDeallocation() {
    return this.status === 'accepted';
  }

  // Verificar si esta reserva puede ser cancelada por pasajero (legacy)
  // @deprecated Usar isCancelableByPassenger() para guard de máquina de estados
  canBeCanceledByPassenger() {
    return this.status === 'pending';
  }

  // Verificar si esta reserva puede ser aceptada por conductor: solo solicitudes pending pueden ser aceptadas
  canBeAccepted() {
    return this.status === 'pending';
  }

  // Verificar si esta reserva puede ser rechazada por conductor: solo solicitudes pending pueden ser rechazadas
  canBeDeclined() {
    return this.status === 'pending';
  }

  // Cancelar esta solicitud de reserva (iniciada por pasajero): transiciones legales son pending|accepted → canceled_by_passenger
  // Idempotente: si ya está cancelada, retorna sin error
  cancelByPassenger(isPaid = false, policyEligible = true, reason = '') {
    // Idempotente: si ya está cancelada, solo retornar
    if (this.status === 'canceled_by_passenger') {
      return this;
    }

    // Guard de estado: solo pending o accepted pueden ser canceladas
    if (!this.isCancelableByPassenger()) {
      throw new InvalidTransitionError(
        `Cannot cancel booking with status: ${this.status}. Only pending or accepted bookings can be canceled.`,
        this.status,
        'canceled_by_passenger'
      );
    }

    // Transición a estado cancelado
    this.status = 'canceled_by_passenger';
    this.canceledAt = new Date();
    this.cancellationReason = reason?.trim() || ''; // Almacenar razón para auditoría
    this.updatedAt = new Date();

    // Establecer bandera de reembolso si la reserva fue pagada y la política lo permite
    // Esta bandera es verificada por el servicio de reembolso pero no expuesta en DTOs
    if (isPaid && policyEligible) {
      this.refundNeeded = true;
    }

    return this;
  }

  // Rechazar automáticamente esta reserva (conductor canceló viaje): transición legal es pending → declined_auto
  // Usado cuando el conductor cancela todo el viaje (operación en cascada)
  declineAuto() {
    // Idempotente: si ya está declined_auto, solo retornar
    if (this.status === 'declined_auto') {
      return this;
    }

    // Guard de estado: solo reservas pending pueden ser auto-rechazadas
    if (this.status !== 'pending') {
      throw new InvalidTransitionError(
        `Cannot auto-decline booking with status: ${this.status}. Only pending bookings can be auto-declined.`,
        this.status,
        'declined_auto'
      );
    }

    // Transición a estado declined_auto
    this.status = 'declined_auto';
    this.declinedAt = new Date();
    this.declinedBy = 'system'; // Rechazo iniciado por sistema
    this.updatedAt = new Date();

    return this;
  }

  // Cancelar esta reserva por plataforma (conductor canceló viaje): transición legal es accepted → canceled_by_platform
  // Usado cuando el conductor cancela todo el viaje (operación en cascada)
  // Para reservas pagadas: establece bandera refundNeeded (siempre true para cancelaciones de plataforma)
  cancelByPlatform(isPaid = false) {
    // Idempotente: si ya está canceled_by_platform, solo retornar
    if (this.status === 'canceled_by_platform') {
      return this;
    }

    // Guard de estado: solo reservas accepted pueden ser canceladas por plataforma
    if (this.status !== 'accepted') {
      throw new InvalidTransitionError(
        `Cannot platform-cancel booking with status: ${this.status}. Only accepted bookings can be platform-canceled.`,
        this.status,
        'canceled_by_platform'
      );
    }

    // Transición a estado canceled_by_platform
    this.status = 'canceled_by_platform';
    this.canceledAt = new Date();
    this.updatedAt = new Date();

    // Las cancelaciones de plataforma siempre activan reembolsos si la reserva fue pagada
    // (Política es 100% de reembolso para cancelaciones iniciadas por conductor)
    if (isPaid) {
      this.refundNeeded = true;
    }

    return this;
  }

  // Verificar si el pasajero es dueño de esta reserva
  belongsToPassenger(passengerId) {
    return this.passengerId === passengerId;
  }

  // Marcar pago como completado
  markPaymentCompleted(paymentMethod) {
    this.paymentMethod = paymentMethod;
    this.paymentStatus = 'completed';
    this.isPaid = true;
    this.paidAt = new Date();
    this.updatedAt = new Date();
  }

  // Inicializar pago (cuando la reserva es aceptada - el pago se vuelve requerido)
  // El método de pago se establecerá cuando el pasajero elija cómo pagar
  initializePayment() {
    this.paymentStatus = 'pending';
    this.updatedAt = new Date();
  }

  // Establecer método de pago (cuando el pasajero elige cómo pagar)
  setPaymentMethod(paymentMethod, stripePaymentIntentId = null) {
    this.paymentMethod = paymentMethod;
    if (stripePaymentIntentId) {
      this.stripePaymentIntentId = stripePaymentIntentId;
    }
    this.updatedAt = new Date();
  }

  // Verificar si el pago está pendiente
  hasPendingPayment() {
    return this.paymentStatus === 'pending';
  }

  // Verificar si el pago está completado
  isPaymentCompleted() {
    return this.paymentStatus === 'completed' && this.isPaid === true;
  }

  // Crear representación de objeto plano (para persistencia en base de datos)
  toObject() {
    return {
      id: this.id,
      tripId: this.tripId,
      passengerId: this.passengerId,
      status: this.status,
      seats: this.seats,
      note: this.note,
      acceptedAt: this.acceptedAt,
      acceptedBy: this.acceptedBy,
      declinedAt: this.declinedAt,
      declinedBy: this.declinedBy,
      canceledAt: this.canceledAt,
      cancellationReason: this.cancellationReason, // Pista de auditoría
      refundNeeded: this.refundNeeded, // Persistido pero nunca expuesto en DTOs
      paymentMethod: this.paymentMethod,
      paymentStatus: this.paymentStatus,
      stripePaymentIntentId: this.stripePaymentIntentId,
      paidAt: this.paidAt,
      isPaid: this.isPaid,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = BookingRequest;

