import type { Request, Response } from 'express';
import { db } from '../../db/client.js';
import { alertas } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  try {
    const { ativo } = req.query;
    let rows;
    if (ativo === 'true') {
      rows = await db.select().from(alertas).where(eq(alertas.ativo, true)).orderBy(desc(alertas.criadoEm));
    } else {
      rows = await db.select().from(alertas).orderBy(desc(alertas.criadoEm));
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar alertas', message: String(error) });
  }
}
