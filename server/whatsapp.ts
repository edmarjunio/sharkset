import type { Express, Request, Response } from 'express';

const WHATSAPP_UNAVAILABLE =
  'Envio automatico indisponivel: o SHARKSET ainda nao possui cadastro de contatos e consentimentos no servidor.';

export function normalizePhoneNumber(rawPhone: string): string | null {
  const trimmed = (rawPhone || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('+')) {
    return /^\d{10,15}$/.test(digits) ? digits : null;
  }

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

function unavailable(_req: Request, res: Response) {
  res.status(503).json({ ok: false, available: false, error: WHATSAPP_UNAVAILABLE });
}

export function registerWhatsAppRoutes(app: Express) {
  app.get('/api/notifications/whatsapp/status', (_req: Request, res: Response) => {
    res.json({ configured: false, available: false });
  });

  // Error reports are bounded and logged; they never trigger an external message.
  app.post('/api/notifications/whatsapp/error-report', (req: Request, res: Response) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1000) : '';
    if (!message) {
      res.status(400).json({ ok: false, error: 'Descricao do erro obrigatoria.' });
      return;
    }

    console.error('SHARKSET_ERROR_REPORT', message);
    res.status(202).json({ ok: true, recorded: true });
  });

  app.post('/api/notifications/whatsapp/send', unavailable);
  app.post('/api/notifications/whatsapp/tournament-start', unavailable);
  app.post('/api/notifications/whatsapp/match-result', unavailable);
}
