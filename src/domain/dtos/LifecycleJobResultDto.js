// DTO de resultado de trabajo de ciclo de vida: objeto de transferencia de datos para resultados de ejecución de trabajos de ciclo de vida
// Proporciona métricas para monitoreo y visibilidad de admin
class LifecycleJobResultDto {
  constructor({ ok, completedTrips, expiredPendings }) {
    this.ok = ok;
    this.completedTrips = completedTrips || 0;
    this.expiredPendings = expiredPendings || 0;
  }

  // Crear DTO desde resultado de ejecución de trabajo
  static fromJobResult(jobResult) {
    return new LifecycleJobResultDto({
      ok: jobResult.ok,
      completedTrips: jobResult.completedTrips,
      expiredPendings: jobResult.expiredPendings
    });
  }
}

module.exports = LifecycleJobResultDto;
