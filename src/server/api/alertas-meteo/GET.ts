import type { Request, Response } from 'express';

// Cache em memória: 30 minutos
let cache: { data: AlertaMeteo[]; ts: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface AlertaMeteo {
  id: string;
  tipo: string;
  severidade: 'Moderado' | 'Severo' | 'Extremo';
  descricao: string;
  inicio: string;
  fim: string;
  orgao: string;
  recomendacoes: string[];
}

// Bounding box do Vale do Caí / Serra Gaúcha (RS)
// lat: -30.0 a -28.8 | lon: -52.0 a -50.8
const LAT_MIN = -30.0;
const LAT_MAX = -28.8;
const LON_MIN = -52.0;
const LON_MAX = -50.8;

function formatDataBR(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).replace(',', ' às');
  } catch {
    return iso;
  }
}

// Tenta buscar alertas do INMET via API CAP (GeoJSON público)
async function fetchInmetAlertas(): Promise<AlertaMeteo[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let resp: globalThis.Response;
  try {
    // API pública do INMET — alertas ativos em formato GeoJSON
    resp = await fetch(
      'https://apiprevmet3.inmet.gov.br/avisos/ativos',
      {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) throw new Error(`INMET HTTP ${resp.status}`);

  const json = await resp.json() as {
    features?: Array<{
      geometry?: { coordinates?: number[][][] };
      properties?: {
        id_aviso?: string;
        ds_tipo_aviso?: string;
        ds_severidade?: string;
        ds_descricao?: string;
        dt_inicio?: string;
        dt_fim?: string;
        ds_orgao?: string;
        ds_instrucoes?: string;
      };
    }>;
  };

  if (!json.features || !Array.isArray(json.features)) return [];

  const alertas: AlertaMeteo[] = [];

  for (const feat of json.features) {
    const props = feat.properties;
    if (!props) continue;

    // Filtra por bounding box (polígono do alerta deve ter ao menos um ponto na região)
    const coords = feat.geometry?.coordinates?.[0] ?? [];
    const naRegiao = coords.some(([lon, lat]) =>
      lon >= LON_MIN && lon <= LON_MAX && lat >= LAT_MIN && lat <= LAT_MAX
    );
    if (!naRegiao) continue;

    const sev = props.ds_severidade ?? '';
    let severidade: AlertaMeteo['severidade'] = 'Moderado';
    if (/extremo/i.test(sev)) severidade = 'Extremo';
    else if (/severo|forte/i.test(sev)) severidade = 'Severo';

    // Recomendações: split por ponto-e-vírgula ou nova linha
    const instrucoes = props.ds_instrucoes ?? '';
    const recomendacoes = instrucoes
      .split(/[;\n]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 10)
      .slice(0, 6);

    if (recomendacoes.length === 0) {
      recomendacoes.push('Fique atento aos alertas da Defesa Civil');
      recomendacoes.push('Evite áreas de risco e margens de rios');
    }

    alertas.push({
      id: props.id_aviso ?? `inmet-${Date.now()}`,
      tipo: props.ds_tipo_aviso ?? 'Aviso Meteorológico',
      severidade,
      descricao: props.ds_descricao ?? '',
      inicio: formatDataBR(props.dt_inicio ?? ''),
      fim: formatDataBR(props.dt_fim ?? ''),
      orgao: props.ds_orgao ?? 'INMET',
      recomendacoes,
    });
  }

  return alertas;
}

export default async function handler(_req: Request, res: Response) {
  try {
    const now = Date.now();
    if (cache && now - cache.ts < CACHE_TTL_MS) {
      return res.json({ ok: true, data: cache.data, cached: true });
    }

    const data = await fetchInmetAlertas();
    cache = { data, ts: now };
    return res.json({ ok: true, data, cached: false });
  } catch (err) {
    console.error('alertas-meteo.api.error', err instanceof Error ? err.message : String(err));
    // Retorna cache expirado se disponível
    if (cache) {
      return res.json({ ok: true, data: cache.data, cached: true, stale: true });
    }
    // Se a API do INMET falhar, retorna lista vazia (sem alertas falsos)
    return res.json({ ok: true, data: [], cached: false, unavailable: true });
  }
}
