// Middleware para asegurar que el perfil del conductor esté verificado antes de permitir ciertas acciones
// (ej: publicar viajes)
const DriverVerification = require('../../infrastructure/database/models/DriverVerificationModel');

module.exports = async function requireDriverVerified(req, res, next) {
  try {
    const userId = (req.user && (req.user.sub || req.user.id)) || null;
    const correlationId = req.correlationId;

    if (!userId) {
      return res.status(401).json({ code: 'unauthorized', message: 'Not authenticated', correlationId });
    }

    const profile = await DriverVerification.findOne({ userId });

    // Si no hay perfil o no está verificado, rechazar con mensaje accionable
    if (!profile || profile.status !== 'verified') {
      let message = 'Your driver verification is not complete. Please submit required documents to publish trips.';
      if (profile && profile.status === 'expired') {
        message = 'Your driver verification is expired. Please renew your documents to publish trips.';
      } else if (profile && profile.status === 'pending_review') {
        message = 'Your driver verification is pending review. Please wait for admin approval.';
      } else if (profile && profile.status === 'rejected') {
        message = 'Your driver verification was rejected. Please update and resubmit your documents.';
      }

      return res.status(403).json({ code: 'verification_required', message, correlationId });
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
