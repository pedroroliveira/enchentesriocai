import type { Request, Response } from 'express';
import { db } from '../../db/client.js';
import { notificacoes } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10;

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (bucket.count >= RATE_LIMIT) return true;
  bucket.count += 1;
  return false;
}

export default async function handler(req: Request, res: Response) {
  try {
    const { tipo, cidades, nivelMinimo } = req.body;
    const rawContato = typeof req.body?.contato === 'string' ? req.body.contato.trim() : '';

    if (isRateLimited(req.ip || req.socket.remoteAddress || 'unknown')) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
    }

    if (!rawContato || !tipo || !cidades || !Array.isArray(cidades) || cidades.length === 0) {
      return res.status(400).json({ error: 'Campos obrigatórios: contato, tipo, cidades (array)' });
    }

    if (!['email', 'whatsapp'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo deve ser "email" ou "whatsapp"' });
    }

    const contato = tipo === 'email'
      ? rawContato.toLowerCase().slice(0, 254)
      : rawContato.replace(/\D/g, '').slice(0, 15);

    if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contato)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (tipo === 'whatsapp' && !/^\d{10,15}$/.test(contato)) {
      return res.status(400).json({ error: 'Número de WhatsApp inválido.' });
    }

    const cidadesValidas = cidades
      .filter((cidade): cidade is string => typeof cidade === 'string')
      .map((cidade) => cidade.trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 30);
    if (cidadesValidas.length === 0) {
      return res.status(400).json({ error: 'Informe pelo menos uma cidade válida.' });
    }

    const nivel = nivelMinimo && ['atencao', 'alerta', 'emergencia'].includes(nivelMinimo)
      ? nivelMinimo as 'atencao' | 'alerta' | 'emergencia'
      : 'atencao';

    // Verifica se já existe cadastro ativo para este contato
    const existing = await db
      .select()
      .from(notificacoes)
      .where(and(eq(notificacoes.contato, contato), eq(notificacoes.ativo, true)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Este contato já está cadastrado para receber alertas.' });
    }

    const [novo] = await db.insert(notificacoes).values({
      contato,
      tipo: tipo as 'email' | 'whatsapp',
      cidades: JSON.stringify(cidadesValidas),
      nivelMinimo: nivel,
      ativo: true,
    }).returning();

    res.status(201).json({ success: true, data: novo });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar notificação', message: String(error) });
  }
}
