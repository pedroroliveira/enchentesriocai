import type { Request, Response } from 'express';
import {
  getHistoricoEstacao,
  HORAS_HISTORICO_PERMITIDAS,
  type HorasHistorico,
} from '../../../../services/ana.js';

export default async function handler(req: Request, res: Response) {
  const codAna = String(req.params.codAna ?? '');
  if (!/^\d{8}$/.test(codAna)) {
    res.status(400).json({ error: 'Código de estação inválido' });
    return;
  }

  const horas = Number(req.query.horas ?? 48);
  if (!HORAS_HISTORICO_PERMITIDAS.includes(horas as HorasHistorico)) {
    res.status(400).json({ error: `horas deve ser ${HORAS_HISTORICO_PERMITIDAS.join(', ')}` });
    return;
  }

  try {
    const historico = await getHistoricoEstacao(codAna, horas as HorasHistorico);
    if (!historico) {
      res.status(404).json({ error: 'Estação não encontrada' });
      return;
    }
    // As leituras entram a cada ~5 min; 2 min de cache no navegador bastam.
    res.set('Cache-Control', 'public, max-age=120');
    res.json(historico);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar leituras', message: String(error) });
  }
}
