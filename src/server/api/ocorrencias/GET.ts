import type { Request, Response } from 'express';
import { db } from '../../db/client.js';
import { ocorrencias } from '../../db/schema.js';
import { desc } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  try {
    const rows = await db.select().from(ocorrencias).orderBy(desc(ocorrencias.inicio));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar ocorrências', message: String(error) });
  }
}
