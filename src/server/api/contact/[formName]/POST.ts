import type { Request, Response } from 'express';
import nodemailer from 'nodemailer';

interface RateBucket {
  count: number;
  resetAt: number;
}

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, RateBucket>();

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

function getVisitorIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!);
}

function asString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const formName = req.params.formName;
  if (formName !== 'contato' && formName !== 'sobre') {
    res.status(404).json({ success: false, error: 'Formulário não encontrado' });
    return;
  }

  const body = req.body;
  if (body?._gotcha) {
    res.status(200).json({ success: true });
    return;
  }

  const ip = getVisitorIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ success: false, error: 'Muitas tentativas. Aguarde um minuto.' });
    return;
  }

  const name = asString(body?.user?.name, 120) || (formName === 'sobre' ? 'Contato pela página Sobre' : '');
  const email = asString(body?.user?.email, 254).toLowerCase();
  const message = asString(body?.conversation?.messages_attributes?.[0]?.body, 5_000);
  const subjectInput = asString(body?.conversation?.data?.Assunto, 120);
  const subjectLabel = subjectInput || 'Contato pelo site';

  if (!name || !email || !message || (formName === 'sobre' && !subjectInput) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, error: 'Preencha corretamente todos os campos obrigatórios.' });
    return;
  }

  try {
    const port = Number(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host: requiredEnv('SMTP_HOST'),
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    const to = process.env.CONTACT_TO?.trim() || 'contato@enchentesvaledocai.com.br';
    const from = process.env.SMTP_FROM?.trim() || user || to;
    const subject = `[Enchentes Vale do Caí] ${subjectLabel}`;

    await transporter.sendMail({
      from,
      to,
      replyTo: { name, address: email },
      subject,
      text: `Nome: ${name}\nE-mail: ${email}\nAssunto: ${subjectLabel}\n\n${message}`,
      html: `<p><strong>Nome:</strong> ${escapeHtml(name)}</p>` +
        `<p><strong>E-mail:</strong> ${escapeHtml(email)}</p>` +
        `<p><strong>Assunto:</strong> ${escapeHtml(subjectLabel)}</p>` +
        `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[contact] SMTP delivery failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ success: false, error: 'Não foi possível enviar a mensagem agora.' });
  }
}
