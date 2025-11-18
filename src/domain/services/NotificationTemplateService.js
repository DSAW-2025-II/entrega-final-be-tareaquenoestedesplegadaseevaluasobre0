// Servicio de plantillas de notificaciones: renderizador simple de plantillas para previsualizaciones de notificaciones
// - Solo lectura: no envía ni persiste nada
// - Retorna { subject, html, text }
// Este es un renderizador mínimo usado por endpoints de previsualización de admin

const sanitizeHtml = require('sanitize-html');
const { htmlToText } = require('html-to-text');
let inlineCss;
try {
  // optional dependency at runtime
  inlineCss = require('inline-css');
} catch (e) {
  inlineCss = null;
}

class NotificationTemplateService {
  constructor() {
    // Metadatos que describen variables requeridas por plantilla
    this.templateMeta = {
      'payment.succeeded': {
        required: ['firstName', 'amount', 'currency']
      }
    };
    // Lista de permitidos para sanitize-html
    this.sanitizeOptions = {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
      allowedAttributes: Object.assign({}, sanitizeHtml.defaults.allowedAttributes, {
        a: [ 'href', 'name', 'target', 'rel' ],
        img: [ 'src', 'alt', 'title', 'width', 'height' ]
      }),
      // No permitir manejadores de eventos inline, scripts, iframes por defecto
      nonTextTags: [ 'script', 'style', 'iframe', 'noscript' ]
    };
  }

  // Renderizar plantilla: genera HTML, texto y asunto para una notificación
  async render(channel, type, variables = {}, locale = 'en', options = { sanitize: true, inlineCss: false }) {
    // Normalizar
    const ch = (channel || '').toLowerCase();
    const t = type;

    // Asegurar que las variables requeridas estén presentes para la plantilla
    const meta = this.templateMeta[t];
    if (meta && Array.isArray(meta.required)) {
      const missing = meta.required.filter(k => variables[k] === undefined || variables[k] === null || variables[k] === '');
      if (missing.length) {
        throw { code: 'invalid_schema', message: `Variables missing: ${missing.join(', ')}` };
      }
    }

    switch (t) {
      case 'payment.succeeded': {
        const out = this._renderPaymentSucceeded(ch, variables, locale);
        // Post-procesamiento: sanitizar, CSS inline (opcional), y asegurar texto alternativo
        let html = out.html || '';
        let text = out.text || '';

        if (options && options.sanitize) {
          html = sanitizeHtml(html, this.sanitizeOptions);
        }

        if (options && options.inlineCss && inlineCss) {
          try {
            // inlineCss espera una promesa; proporcionar un placeholder de URL base
            // eslint-disable-next-line no-await-in-loop
            html = await inlineCss(html, { url: ' ' });
          } catch (e) {
            // Si el inline falla, continuar con HTML sanitizado
            // registrar silenciosamente en tests; el llamador puede habilitar logs de debug si lo desea
          }
        }

        // Siempre generar texto plano desde HTML sanitizado para evitar filtrar entrada cruda
        try {
          text = htmlToText(html, { wordwrap: 130 });
        } catch (e) {
          text = out.text || '';
        }

        return { subject: out.subject, html, text };
      }

      default:
        // Tipo de plantilla no soportado
        return null;
    }
  }

  _safeFirstName(v) {
    if (!v || typeof v !== 'string') return 'Customer';
    return v;
  }

  // Formatear moneda: convierte cantidad numérica a formato de moneda localizado
  _formatCurrency(amount, currency, locale) {
    try {
      const code = (currency || 'COP').toUpperCase();
      const nf = new Intl.NumberFormat(locale === 'es' ? 'es-CO' : 'en-US', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0
      });
      // Usar cantidad como unidades enteras (la app parece pasar 6000 -> "6,000")
      return nf.format(amount);
    } catch (e) {
      if (typeof amount === 'number') return `${currency || ''} ${amount}`;
      return `${currency || ''} ${amount || ''}`;
    }
  }

  // Formatear tiempo: convierte string ISO a formato de hora localizado
  _formatTime(isoString, locale) {
    if (!isoString) return 'an unknown time';
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return 'an unknown time';
      // HH:MM en formato 24 horas para muchos locales; elegir un formateador consciente del locale
      const opts = { hour: '2-digit', minute: '2-digit' };
      return d.toLocaleTimeString(locale === 'es' ? 'es-CO' : 'en-GB', opts);
    } catch (e) {
      return 'an unknown time';
    }
  }

  // Renderizar plantilla de pago exitoso: genera HTML y texto para notificación de pago completado
  _renderPaymentSucceeded(channel, vars, locale) {
    const firstName = this._safeFirstName(vars.firstName);
    const amount = typeof vars.amount === 'number' ? vars.amount : Number(vars.amount || 0);
    const currency = vars.currency || 'COP';

    const formattedAmount = this._formatCurrency(amount, currency, locale);
    const timeStr = this._formatTime(vars.tripTime, locale);

    // Construir plantillas por locale
    if (locale === 'es') {
      const subject = '¡Tu pago fue exitoso!';
  const html = `<h1>Gracias, ${firstName}!</h1><p>Tu pago de ${formattedAmount} fue exitoso para el viaje a las ${timeStr}.</p>`;
  const text = `Gracias, ${firstName}! Tu pago de ${formattedAmount} fue exitoso para el viaje a las ${timeStr}.`;

      if (channel === 'in-app') {
        return {
          subject: 'Pago recibido',
          html: `<strong>Gracias, ${firstName}!</strong> Tu pago de ${formattedAmount} fue registrado para el viaje a las ${timeStr}.`,
          text: `Gracias, ${firstName}! Pago de ${formattedAmount} registrado para el viaje a las ${timeStr}.`
        };
      }

    return { subject, html, text };
    }

    // Por defecto: Inglés
    const subject = 'Your payment was successful';
    const html = `<h1>Thanks, ${firstName}!</h1><p>Your payment of ${formattedAmount} was successful for the trip at ${timeStr}.</p>`;
    const text = `Thanks, ${firstName}! Your payment of ${formattedAmount} was successful for the trip at ${timeStr}.`;

    if (channel === 'in-app') {
      return {
        subject: 'Payment received',
        html: `<strong>Thanks, ${firstName}!</strong> Your payment of ${formattedAmount} was recorded for the trip at ${timeStr}.`,
        text: `Thanks, ${firstName}! Payment of ${formattedAmount} recorded for the trip at ${timeStr}.`
      };
    }

    return { subject, html, text };
  }
}

module.exports = NotificationTemplateService;
