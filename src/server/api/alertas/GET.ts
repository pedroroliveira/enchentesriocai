import type { Request, Response } from 'express';
import { getAlertasAtivos } from '../../services/alertas.js';

/**
 * Alertas ativos agora — derivados das leituras das estações e somados aos
 * avisos manuais em aberto. Sempre retorna apenas o que está ativo: alerta
 * que não corresponde mais ao nível do rio simplesmente deixa de existir.
 */
export default async function handler(_req: Request, res: Response) {
  try {
    const alertas = await getAlertasAtivos();
    res.json(alertas);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar alertas', message: String(error) });
  }
}
