import type { Express, Request, Response } from 'express';

interface WhatsAppConfig {
  token: string;
  phoneId: string;
  version: string;
}

interface Recipient {
  name: string;
  phone: string;
}

interface DispatchRecord {
  timestamp: number;
}

// In-memory idempotency cache: event key -> dispatch timestamp (1 hour TTL)
const idempotencyCache = new Map<string, DispatchRecord>();
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;

function cleanExpiredIdempotencyKeys() {
  const now = Date.now();
  for (const [key, record] of idempotencyCache.entries()) {
    if (now - record.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}

function getWhatsAppConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v19.0';
  if (!token || !phoneId) return null;
  return { token, phoneId, version };
}

export function normalizePhoneNumber(rawPhone: string): string | null {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return null;

  // Add Brazil country code (55) if standard DDD + phone is passed (10 or 11 digits)
  const phone = (digits.length === 10 || digits.length === 11) && !digits.startsWith('55')
    ? `55${digits}`
    : digits;

  // Standard E.164 without leading plus must have between 10 and 15 digits
  if (!/^\d{10,15}$/.test(phone)) return null;
  return phone;
}

async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  to: string,
  bodyText: string
): Promise<{ success: boolean; messageId?: string; error?: string; status?: number }> {
  try {
    const url = `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: bodyText,
        },
      }),
    });

    const result = (await response.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string; code: number };
    };

    if (response.ok && result.messages?.[0]?.id) {
      return { success: true, messageId: result.messages[0].id, status: response.status };
    }

    return {
      success: false,
      error: result.error?.message || `WhatsApp API error HTTP ${response.status}`,
      status: response.status,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Timeout or network failure connecting to WhatsApp API',
    };
  }
}

export function registerWhatsAppRoutes(app: Express) {
  // Service configuration status endpoint
  app.get('/api/notifications/whatsapp/status', (_req: Request, res: Response) => {
    const config = getWhatsAppConfig();
    res.json({
      configured: Boolean(config),
      phoneIdAvailable: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
      graphVersion: config?.version || process.env.WHATSAPP_GRAPH_VERSION || 'v19.0',
    });
  });

  // Direct single WhatsApp message dispatch endpoint
  app.post('/api/notifications/whatsapp/send', async (req: Request, res: Response) => {
    const { to, message, idempotencyKey } = req.body || {};

    if (!to || typeof to !== 'string' || !message || typeof message !== 'string') {
      res.status(400).json({ error: 'Os campos "to" e "message" são obrigatórios.' });
      return;
    }

    const cleanPhone = normalizePhoneNumber(to);
    if (!cleanPhone) {
      res.status(400).json({ error: 'Número de telefone inválido (deve conter DDI e DDD válidos).' });
      return;
    }

    cleanExpiredIdempotencyKeys();
    if (idempotencyKey) {
      const existing = idempotencyCache.get(idempotencyKey);
      if (existing) {
        res.status(200).json({ ok: true, skipped: true, reason: 'Mensagem já enviada anteriormente (idempotente).' });
        return;
      }
      idempotencyCache.set(idempotencyKey, { timestamp: Date.now() });
    }

    const config = getWhatsAppConfig();
    if (!config) {
      res.status(200).json({
        ok: true,
        simulated: true,
        to: cleanPhone,
        message,
        info: 'Credenciais de WhatsApp não configuradas no servidor; alerta registrado em modo simulação.',
      });
      return;
    }

    const dispatchResult = await sendWhatsAppMessage(config, cleanPhone, message.trim());
    if (dispatchResult.success) {
      res.status(200).json({ ok: true, messageId: dispatchResult.messageId });
    } else {
      res.status(dispatchResult.status && dispatchResult.status >= 500 ? 502 : 400).json({
        ok: false,
        error: dispatchResult.error,
      });
    }
  });

  // Tournament Start WhatsApp Alert: dispatches official bracket kickoff notifications to all participants
  app.post('/api/notifications/whatsapp/tournament-start', async (req: Request, res: Response) => {
    const { tournamentId, tournamentName, arenaName, pairsCount, recipients } = req.body || {};

    if (!tournamentId || !tournamentName) {
      res.status(400).json({ error: 'tournamentId e tournamentName são obrigatórios.' });
      return;
    }

    const recipientList: Recipient[] = Array.isArray(recipients) ? recipients : [];
    const config = getWhatsAppConfig();

    cleanExpiredIdempotencyKeys();

    const dispatched: string[] = [];
    const skipped: string[] = [];
    const failures: Array<{ phone: string; error: string }> = [];

    const venue = arenaName ? ` (${arenaName})` : '';
    const duplasTotal = pairsCount ? `\n👥 *Duplas Confirmadas:* ${pairsCount}` : '';

    for (const r of recipientList) {
      const cleanPhone = normalizePhoneNumber(r.phone);
      if (!cleanPhone) continue;

      const idempotencyKey = `tourn-start:${tournamentId}:${cleanPhone}`;
      if (idempotencyCache.get(idempotencyKey)) {
        skipped.push(cleanPhone);
        continue;
      }

      const bodyText = [
        `🏆 *TORNEIO INICIADO · TABELA OFICIAL LIBERADA!* 🦈🏖️`,
        `--------------------------------------`,
        `🏟️ *Torneio:* ${tournamentName}${venue}${duplasTotal}`,
        `--------------------------------------`,
        `Olá *${r.name || 'Atleta'}*, a tabela oficial de jogos já foi gerada e as partidas da 1ª rodada foram liberadas!`,
        `Acompanhe a chave e os placares em tempo real no SHARK SET:`,
        `https://sharkset.web.app`,
      ].join('\n');

      idempotencyCache.set(idempotencyKey, { timestamp: Date.now() });

      if (!config) {
        dispatched.push(cleanPhone);
        continue;
      }

      const sendRes = await sendWhatsAppMessage(config, cleanPhone, bodyText);
      if (sendRes.success) {
        dispatched.push(cleanPhone);
      } else {
        failures.push({ phone: cleanPhone, error: sendRes.error || 'Falha no envio' });
      }
    }

    res.status(200).json({
      success: true,
      simulated: !config,
      totalRecipients: recipientList.length,
      dispatchedCount: dispatched.length,
      skippedCount: skipped.length,
      failures,
    });
  });

  // Match Result Published WhatsApp Alert: dispatches official set/score results to match players
  app.post('/api/notifications/whatsapp/match-result', async (req: Request, res: Response) => {
    const {
      tournamentId,
      tournamentName,
      matchId,
      matchNumber,
      stageName,
      winnerName,
      loserName,
      scoreSummary,
      recipients,
    } = req.body || {};

    if (!tournamentName || !winnerName || !scoreSummary) {
      res.status(400).json({ error: 'tournamentName, winnerName e scoreSummary são obrigatórios.' });
      return;
    }

    const recipientList: Recipient[] = Array.isArray(recipients) ? recipients : [];
    const config = getWhatsAppConfig();

    cleanExpiredIdempotencyKeys();

    const dispatched: string[] = [];
    const skipped: string[] = [];
    const failures: Array<{ phone: string; error: string }> = [];

    const matchLabel = matchNumber ? `Jogo #${matchNumber}` : 'Partida';
    const stageLabel = stageName ? ` (${stageName})` : '';

    for (const r of recipientList) {
      const cleanPhone = normalizePhoneNumber(r.phone);
      if (!cleanPhone) continue;

      const idempotencyKey = `match-result:${tournamentId || 'tourn'}:${matchId || matchNumber}:${cleanPhone}`;
      if (idempotencyCache.get(idempotencyKey)) {
        skipped.push(cleanPhone);
        continue;
      }

      const bodyText = [
        `⚡ *RESULTADO OFICIAL DE JOGO · SHARK SET* 🦈🏆`,
        `--------------------------------------`,
        `🏆 *Torneio:* ${tournamentName}`,
        `⚔️ *Fase:* ${matchLabel}${stageLabel}`,
        `🥇 *Vencedor:* ${winnerName}`,
        loserName ? `🆚 *Adversário:* ${loserName}` : '',
        `📊 *Placar:* ${scoreSummary}`,
        `--------------------------------------`,
        `A chave do campeonato foi atualizada com o avanço de fase. Acompanhe os próximos jogos:`,
        `https://sharkset.web.app`,
      ].filter(Boolean).join('\n');

      idempotencyCache.set(idempotencyKey, { timestamp: Date.now() });

      if (!config) {
        dispatched.push(cleanPhone);
        continue;
      }

      const sendRes = await sendWhatsAppMessage(config, cleanPhone, bodyText);
      if (sendRes.success) {
        dispatched.push(cleanPhone);
      } else {
        failures.push({ phone: cleanPhone, error: sendRes.error || 'Falha no envio' });
      }
    }

    res.status(200).json({
      success: true,
      simulated: !config,
      totalRecipients: recipientList.length,
      dispatchedCount: dispatched.length,
      skippedCount: skipped.length,
      failures,
    });
  });
}
