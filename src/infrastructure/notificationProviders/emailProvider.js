const crypto = require('crypto');

/**
 * Proveedor de email: verificador y parser simple de webhooks de proveedor de email.
 * Espera formato de header similar a: t=timestamp,v1=signature
 * La firma es HMAC-SHA256 de `${timestamp}.${rawBody}` usando EMAIL_WEBHOOK_SECRET
 */
class EmailProvider {
  constructor() {
    this.secret = process.env.EMAIL_WEBHOOK_SECRET;
    if (!this.secret) {
      // Permitir operación en entornos sin secret para no producción, pero la verificación fallará
      // Lanzar error rompería el require de la app; mantener undefined y verificar después
    }
  }

  /**
   * Calcula la firma esperada usando HMAC-SHA256.
   */
  _computeSignature(timestamp, raw) {
    return crypto.createHmac('sha256', this.secret).update(`${timestamp}.${raw}`).digest('hex');
  }

  /**
   * Parsea el header de firma en objeto con timestamp y firma.
   */
  _parseSignatureHeader(sigHeader) {
    if (!sigHeader || typeof sigHeader !== 'string') return null;
    const parts = sigHeader.split(',').map(p => p.trim());
    const out = {};
    for (const part of parts) {
      const [k, v] = part.split('=');
      out[k] = v;
    }
    return out;
  }

  /**
   * Verifica la firma del webhook y parsea el payload.
   * Retorna evento normalizado con tipo de evento y metadatos.
   */
  verifyAndParse(raw, sigHeader) {
    // raw: string del body crudo
    // sigHeader: valor del header (string)
    const parsed = this._parseSignatureHeader(sigHeader);
    if (!parsed || !parsed.t || !parsed.v1) {
      const err = new Error('Invalid signature header');
      err.code = 'invalid_signature';
      throw err;
    }

    if (!this.secret) {
      const err = new Error('Email webhook secret not configured');
      err.code = 'invalid_signature';
      throw err;
    }

    const expected = this._computeSignature(parsed.t, raw);

    // Comparación segura ante timing attacks
    if (process.env.DEBUG_EMAIL_WEBHOOK) {
      console.debug('[EmailProvider] parsed.v1=', parsed.v1);
      console.debug('[EmailProvider] expected=', expected);
      try {
        console.debug('[EmailProvider] raw (first 200 chars)=', typeof raw === 'string' ? raw.slice(0,200) : JSON.stringify(raw).slice(0,200));
      } catch (e) {
        console.debug('[EmailProvider] raw debug error', e.message);
      }
    }
    const sigBuf = Buffer.from(parsed.v1, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      const err = new Error('Webhook signature verification failed');
      err.code = 'invalid_signature';
      throw err;
    }

    // Parsear JSON
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      const err = new Error('Invalid JSON payload');
      err.code = 'invalid_payload';
      throw err;
    }

    // Normalizar evento (soporta diferentes formatos de proveedores)
    const providerMessageId = payload.MessageID || payload.messageId || payload.message_id;
    const recordType = payload.RecordType || payload.recordType || payload.event || '';
    let eventType = null;
    switch ((recordType || '').toLowerCase()) {
      case 'delivery':
        eventType = 'delivered';
        break;
      case 'bounce':
        eventType = 'bounced';
        break;
      case 'complaint':
        eventType = 'complained';
        break;
      case 'dropped':
        eventType = 'dropped';
        break;
      default:
        eventType = (payload.EventType || payload.eventType || payload.type || '').toLowerCase() || recordType;
    }

    return {
      providerMessageId: providerMessageId,
      eventType,
      recipient: payload.Recipient || payload.recipient || null,
      metadata: payload.Metadata || payload.metadata || {},
      raw: payload,
      providerEventId: payload.EventID || payload.id || payload.eventId || null
    };
  }
}

module.exports = new EmailProvider();
