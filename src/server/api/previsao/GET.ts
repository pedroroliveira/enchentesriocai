import type { Request, Response } from 'express';
import { fetchEstacoesDefesaCivil } from '../../services/defesacivil.js';

// Coordenadas do Vale do Caí (São Sebastião do Caí, RS)
const LAT = -29.5833;
const LON = -51.3667;

// Cache em memória: 1 hora
let cache: { data: PrevisaoData; ts: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface HoraPrevisao {
  hora: string;
  temp: number;
  chuva_mm: number;
  prob: number;
  condicao: string;
  vento_kmh: number;
}

export interface DiaPrevisao {
  dia: string;
  data: string;
  tempMax: number;
  tempMin: number;
  chuva_mm: number;
  prob: number;
  condicao: string;
  descricao: string;
  impactoRios: 'baixo' | 'moderado' | 'alto';
}

export interface PrevisaoData {
  atualizadoEm: string;
  temperaturaAtual: number;
  condicaoAtual: string;
  umidade: number;
  vento: number;
  direcaoVento: string;
  pressao: number;
  visibilidade: number;
  chuvaUltimaHora: number;
  acumulado24h: number;
  acumulado48h: number;
  acumulado7d: number;
  previsaoHoraria: HoraPrevisao[];
  previsaoDiaria: DiaPrevisao[];
  fonte: string;
  /** Dados das estações DC para condições atuais locais (quando disponíveis) */
  condicoesLocais?: {
    temperatura: number | null;
    umidade: number | null;
    pressao: number | null;
    ventoVel: number | null;
    chuva1h: number | null;
    chuva24h: number | null;
    chuva7d: number | null;
    estacao: string;
  } | null;
}

// Converte código WMO do Open-Meteo para condição interna
function wmoToCondicao(code: number, isDay: number): string {
  if (code === 0) return isDay ? 'ensolarado' : 'ensolarado';
  if (code <= 2) return 'parcialmente_nublado';
  if (code === 3) return 'nublado';
  if (code <= 49) return 'nublado'; // névoa/neblina
  if (code <= 57) return 'chuva_fraca'; // garoa
  if (code <= 65) {
    if (code >= 63) return 'chuva_forte';
    return 'chuva';
  }
  if (code <= 77) return 'chuva_fraca'; // neve/granizo leve
  if (code <= 82) {
    if (code === 82) return 'chuva_forte';
    return 'chuva';
  }
  if (code <= 86) return 'chuva_forte';
  if (code <= 99) return 'chuva_forte'; // trovoada
  return 'nublado';
}

function wmoToDescricao(code: number): string {
  if (code === 0) return 'Céu limpo';
  if (code === 1) return 'Predominantemente limpo';
  if (code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code <= 49) return 'Névoa ou neblina';
  if (code <= 55) return 'Garoa leve';
  if (code <= 57) return 'Garoa intensa';
  if (code === 61) return 'Chuva leve';
  if (code === 63) return 'Chuva moderada';
  if (code === 65) return 'Chuva forte';
  if (code <= 77) return 'Precipitação de neve/granizo';
  if (code === 80) return 'Pancadas de chuva leves';
  if (code === 81) return 'Pancadas de chuva moderadas';
  if (code === 82) return 'Pancadas de chuva violentas';
  if (code <= 86) return 'Pancadas de neve';
  if (code === 95) return 'Trovoada';
  if (code >= 96) return 'Trovoada com granizo';
  return 'Condição variável';
}

function direcaoVento(graus: number): string {
  const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(graus / 45) % 8];
}

function impactoRios(chuva_mm: number, prob: number): 'baixo' | 'moderado' | 'alto' {
  if (chuva_mm >= 30 || (chuva_mm >= 15 && prob >= 70)) return 'alto';
  if (chuva_mm >= 10 || (chuva_mm >= 5 && prob >= 60)) return 'moderado';
  return 'baixo';
}

function nomeDia(dateStr: string, index: number): string {
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const d = new Date(dateStr + 'T12:00:00');
  if (index === 0) return 'Hoje';
  if (index === 1) return 'Amanhã';
  return dias[d.getDay()];
}

function formatData(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function formatHora(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}h`;
}

async function fetchOpenMeteo(): Promise<PrevisaoData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(LAT));
  url.searchParams.set('longitude', String(LON));
  url.searchParams.set('current', [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'weather_code',
    'wind_speed_10m',
    'wind_direction_10m',
    'surface_pressure',
    'precipitation',
    'is_day',
    'visibility',
  ].join(','));
  url.searchParams.set('hourly', [
    'temperature_2m',
    'precipitation',
    'precipitation_probability',
    'weather_code',
    'wind_speed_10m',
    'is_day',
  ].join(','));
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'wind_speed_10m_max',
  ].join(','));
  url.searchParams.set('timezone', 'America/Sao_Paulo');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('wind_speed_unit', 'kmh');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let resp: globalThis.Response;
  try {
    resp = await fetch(url.toString(), { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
  const json = await resp.json() as {
    current: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
      surface_pressure: number;
      precipitation: number;
      is_day: number;
      visibility: number;
    };
    hourly: {
      time: string[];
      temperature_2m: number[];
      precipitation: number[];
      precipitation_probability: number[];
      weather_code: number[];
      wind_speed_10m: number[];
      is_day: number[];
    };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      precipitation_probability_max: number[];
    };
  };

  const cur = json.current;
  const now = new Date(cur.time);

  // Acumulados: soma das próximas horas/dias
  const hourly = json.hourly;
  const nowIdx = hourly.time.findIndex((t) => new Date(t) >= now);
  const safeIdx = nowIdx >= 0 ? nowIdx : 0;

  const acum24 = hourly.precipitation.slice(safeIdx, safeIdx + 24).reduce((a, b) => a + (b ?? 0), 0);
  const acum48 = hourly.precipitation.slice(safeIdx, safeIdx + 48).reduce((a, b) => a + (b ?? 0), 0);
  const acum7d = json.daily.precipitation_sum.reduce((a, b) => a + (b ?? 0), 0);

  // Próximas 12 horas
  const previsaoHoraria: HoraPrevisao[] = hourly.time
    .slice(safeIdx, safeIdx + 12)
    .map((t, i) => ({
      hora: formatHora(t),
      temp: Math.round(hourly.temperature_2m[safeIdx + i] ?? 0),
      chuva_mm: Math.round((hourly.precipitation[safeIdx + i] ?? 0) * 10) / 10,
      prob: hourly.precipitation_probability[safeIdx + i] ?? 0,
      condicao: wmoToCondicao(hourly.weather_code[safeIdx + i] ?? 0, hourly.is_day[safeIdx + i] ?? 1),
      vento_kmh: Math.round(hourly.wind_speed_10m[safeIdx + i] ?? 0),
    }));

  // 7 dias
  const previsaoDiaria: DiaPrevisao[] = json.daily.time.map((dateStr, i) => {
    const code = json.daily.weather_code[i] ?? 0;
    const chuva = Math.round((json.daily.precipitation_sum[i] ?? 0) * 10) / 10;
    const prob = json.daily.precipitation_probability_max[i] ?? 0;
    return {
      dia: nomeDia(dateStr, i),
      data: formatData(dateStr),
      tempMax: Math.round(json.daily.temperature_2m_max[i] ?? 0),
      tempMin: Math.round(json.daily.temperature_2m_min[i] ?? 0),
      chuva_mm: chuva,
      prob,
      condicao: wmoToCondicao(code, 1),
      descricao: wmoToDescricao(code),
      impactoRios: impactoRios(chuva, prob),
    };
  });

  const atualizadoEm = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  return {
    atualizadoEm,
    temperaturaAtual: Math.round(cur.temperature_2m),
    condicaoAtual: wmoToDescricao(cur.weather_code),
    umidade: cur.relative_humidity_2m,
    vento: Math.round(cur.wind_speed_10m),
    direcaoVento: direcaoVento(cur.wind_direction_10m),
    pressao: Math.round(cur.surface_pressure),
    visibilidade: Math.round((cur.visibility ?? 10000) / 1000),
    chuvaUltimaHora: Math.round(cur.precipitation * 10) / 10,
    acumulado24h: Math.round(acum24 * 10) / 10,
    acumulado48h: Math.round(acum48 * 10) / 10,
    acumulado7d: Math.round(acum7d * 10) / 10,
    previsaoHoraria,
    previsaoDiaria,
    fonte: 'Open-Meteo',
  };
}

export default async function handler(_req: Request, res: Response) {
  try {
    const now = Date.now();
    if (cache && now - cache.ts < CACHE_TTL_MS) {
      return res.json({ ok: true, data: cache.data, cached: true });
    }

    // Busca Open-Meteo e Defesa Civil em paralelo
    const [openMeteoData, dcEstacoes] = await Promise.allSettled([
      fetchOpenMeteo(),
      fetchEstacoesDefesaCivil(),
    ]);

    if (openMeteoData.status === 'rejected') throw openMeteoData.reason;
    const data = openMeteoData.value;

    // Enriquece com dados locais das estações DC (usa Montenegro como referência central)
    if (dcEstacoes.status === 'fulfilled' && dcEstacoes.value.length > 0) {
      // Prefere Montenegro (DCRS-00012) por ser a estação mais central do vale
      const ref = dcEstacoes.value.find(e => e.codDcrs === 'DCRS-00012')
        ?? dcEstacoes.value.find(e => e.temperatura !== null)
        ?? dcEstacoes.value[0];

      if (ref) {
        data.condicoesLocais = {
          temperatura: ref.temperatura !== null ? Math.round(ref.temperatura * 10) / 10 : null,
          umidade:     ref.umidade     !== null ? Math.round(ref.umidade)               : null,
          pressao:     ref.pressao     !== null ? Math.round(ref.pressao)               : null,
          ventoVel:    ref.ventoVel    !== null ? Math.round(ref.ventoVel)              : null,
          chuva1h:     ref.chuva1h     !== null ? Math.round(ref.chuva1h * 10) / 10    : null,
          chuva24h:    ref.chuva24h    !== null ? Math.round(ref.chuva24h * 10) / 10   : null,
          chuva7d:     ref.chuva7d     !== null ? Math.round(ref.chuva7d * 10) / 10    : null,
          estacao:     ref.nomeGeral,
        };

        // Substitui condições atuais pelos dados reais da estação local quando disponíveis
        if (ref.temperatura !== null) data.temperaturaAtual = Math.round(ref.temperatura);
        if (ref.umidade     !== null) data.umidade          = Math.round(ref.umidade);
        if (ref.pressao     !== null) data.pressao          = Math.round(ref.pressao);
        if (ref.ventoVel    !== null) data.vento            = Math.round(ref.ventoVel);
        if (ref.chuva1h     !== null) data.chuvaUltimaHora  = Math.round(ref.chuva1h * 10) / 10;
        if (ref.chuva24h    !== null) data.acumulado24h     = Math.round(ref.chuva24h * 10) / 10;
        if (ref.chuva7d     !== null) data.acumulado7d      = Math.round(ref.chuva7d * 10) / 10;

        data.fonte = 'Defesa Civil RS + Open-Meteo';
      }
    }

    cache = { data, ts: now };
    return res.json({ ok: true, data, cached: false });
  } catch (err) {
    console.error('previsao.api.error', err instanceof Error ? err.message : String(err));
    if (cache) {
      return res.json({ ok: true, data: cache.data, cached: true, stale: true });
    }
    return res.status(503).json({ ok: false, error: 'Serviço meteorológico indisponível' });
  }
}
