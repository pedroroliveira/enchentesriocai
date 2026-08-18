import type { Request, Response } from 'express';
import { getEstacoes } from '../../services/ana.js';

export default async function handler(req: Request, res: Response) {
  try {
    const dados = await getEstacoes();
    res.json({
      estacoes: dados,
      atualizadoEm: dados[0]?.atualizadoEm ?? null,
      total: dados.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estações', message: String(error) });
  }
}
