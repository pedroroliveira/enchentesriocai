import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  const hoje = new Date().toISOString().split('T')[0];
  const ontem = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0];

  // Testa estação 87480000 = Montenegro/Rio Caí
  const url = `https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=87480000&dataInicio=${ontem}&dataFim=${hoje}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const xml = await r.text();
    res.type('text/xml').send(xml);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
