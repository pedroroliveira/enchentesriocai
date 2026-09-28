/**
 * Serviço de monitoramento fluviométrico do Rio Caí
 *
 * Fonte primária:  Defesa Civil RS — API GraphQL (nowcasting, ~1s latência)
 * Fonte fallback:  ANA HidroWeb — XML (lento, 15s+, dados históricos)
 *
 * Estratégia:
 *  1. Tenta buscar dados da Defesa Civil RS para todas as estações com cod_dcrs
 *  2. Para estações sem cod_dcrs (ou se a DC falhar), usa ANA como fallback
 *  3. Salva leituras no banco com fonte='DCRS' ou 'ANA'
 *  4. Cache em memória de 2 minutos (DC é rápida, podemos atualizar mais frequente)
 */

import { db } from '../db/client.js';
import { leituras, estacoes } from '../db/schema.js';
import { eq, asc, desc, and, gte, inArray, sql } from 'drizzle-orm';
import { fetchEstacoesDefesaCivil, type DcrsLeitura } from './defesacivil.js';
import { aplicarRedutorTelemetria, metrosParaCentimetros } from './nivel.js';

const ANA_BASE    = 'https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos (DC é rápida)

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface LeituraEstacao {
  codAna:        string;
  codDcrs:       string | null;
  nomeExibicao:  string;
  rio:           string;
  cidade:        string;
  lat:           string | null;
  lng:           string | null;
  posX:          string | null;
  posY:          string | null;
  /** Ordem crescente de exibição dos cards (null = sem ordem definida). */
  ordem:         number | null;
  nivelM:        number | null;
  nivelCm:       number | null;
  dataHora:      string | null;
  situacao:      'normal' | 'atencao' | 'alerta' | 'emergencia';
  tendencia:     'subindo' | 'descendo' | 'estavel';
  cotaAtencao:   number | null;
  cotaAlerta:    number | null;
  cotaEmergencia: number | null;
  /** Dados meteorológicos extras da Defesa Civil (quando disponíveis) */
  temperatura:   number | null;
  umidade:       number | null;
  pressao:       number | null;
  ventoVel:      number | null;
  chuva1h:       number | null;
  chuva24h:      number | null;
  chuva7d:       number | null;
  fonte:         'DCRS' | 'ANA' | 'cache' | 'fallback';
  atualizadoEm:  string | null;
}

// ─── Parser XML da ANA ──────────────────────────────────────────────────────

/**
 * A ANA publica `DataHora` no horário de Brasília, sem indicar o fuso
 * (ex.: "2026-09-28 16:45:00"). O fuso precisa ser explícito: interpretada
 * no fuso do servidor (UTC), a leitura ficaria 3 horas mais antiga do que é.
 * Brasília não tem horário de verão desde 2019, então o offset é fixo.
 */
export function parseDataHoraAna(texto: string): Date {
  return new Date(`${texto.trim().replace(' ', 'T')}-03:00`);
}

export function parseAnaXml(xml: string): Array<{ dataHora: Date; nivelCm: number }> {
  if (xml.includes('<Error>')) return [];
  const blocos = xml.split(/<DadosHidrometere[oo]logicos[^>]*>/).slice(1);
  const resultados: Array<{ dataHora: Date; nivelCm: number }> = [];

  for (const bloco of blocos) {
    const dataMatch  = bloco.match(/<DataHora>([^<]+)<\/DataHora>/);
    const nivelMatch = bloco.match(/<Nivel>([^<]+)<\/Nivel>/);
    if (!dataMatch || !nivelMatch) continue;
    const nivelStr = nivelMatch[1].trim();
    if (!nivelStr) continue;
    const nivel = parseFloat(nivelStr.replace(',', '.'));
    if (isNaN(nivel) || nivel <= 0) continue;
    const data = parseDataHoraAna(dataMatch[1]);
    if (isNaN(data.getTime())) continue;
    resultados.push({ dataHora: data, nivelCm: nivel });
  }

  return resultados.sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime());
}

async function fetchAna(codAna: string): Promise<Array<{ dataHora: Date; nivelCm: number }>> {
  const hoje    = new Date().toISOString().split('T')[0];
  const seteDias = new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0];
  const url = `${ANA_BASE}?codEstacao=${codAna}&dataInicio=${seteDias}&dataFim=${hoje}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`ANA HTTP ${res.status}`);
  return parseAnaXml(await res.text());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcSituacao(
  nivelM: number,
  cotaAtencao: number | null,
  cotaAlerta: number | null,
  cotaEmergencia: number | null,
): 'normal' | 'atencao' | 'alerta' | 'emergencia' {
  if (cotaEmergencia && nivelM >= cotaEmergencia) return 'emergencia';
  if (cotaAlerta     && nivelM >= cotaAlerta)     return 'alerta';
  if (cotaAtencao    && nivelM >= cotaAtencao)    return 'atencao';
  return 'normal';
}

function calcTendenciaFromRaw(tendenciaRaw: number | null): 'subindo' | 'descendo' | 'estavel' {
  if (tendenciaRaw === null) return 'estavel';
  // tendenciaRaw é variação de nível por minuto em metros
  if (tendenciaRaw > 0.001)  return 'subindo';
  if (tendenciaRaw < -0.001) return 'descendo';
  return 'estavel';
}

function calcTendenciaFromHistorico(
  lista: Array<{ dataHora: Date; nivelCm: number }>,
): 'subindo' | 'descendo' | 'estavel' {
  if (lista.length < 2) return 'estavel';
  const ultimas  = lista.slice(-6);
  const primeira = ultimas[0].nivelCm;
  const ultima   = ultimas[ultimas.length - 1].nivelCm;
  const diff = ultima - primeira;
  if (diff > 5)  return 'subindo';
  if (diff < -5) return 'descendo';
  return 'estavel';
}

interface LeituraCache {
  nivelCm:  number;
  nivelM:   number;
  dataHora: Date;
  fonte:    string;
}

async function salvarLeitura(
  codAna: string,
  nivelM: number,
  dataHora: Date,
  fonte: string,
  /**
   * Data da última leitura já gravada para esta estação. Quando o chamador já
   * a conhece (mapa carregado em lote), evita um SELECT por estação.
   */
  ultimaConhecida?: Date | null,
): Promise<void> {
  const nivelCm = Math.round(nivelM * 100 * 100) / 100;

  // Evita duplicatas: só insere se mais recente que a última salva
  const corte = ultimaConhecida !== undefined
    ? (ultimaConhecida ?? new Date(0))
    : (await buscarUltimaLeitura(codAna))?.dataHora ?? new Date(0);
  if (dataHora <= corte) return;

  await db.insert(leituras).values({
    codAna,
    nivelCm: String(nivelCm),
    nivelM:  String(nivelM.toFixed(3)),
    dataHora,
    fonte,
  });
}

/**
 * Grava todas as leituras da ANA mais recentes que a última já salva. A ANA
 * devolve dias de histórico por consulta; salvar só a última deixaria
 * lacunas sempre que o site ficasse um tempo sem acessos.
 */
async function salvarLeiturasAna(
  codAna: string,
  lista: Array<{ dataHora: Date; nivelCm: number }>,
): Promise<void> {
  const corte = (await buscarUltimaLeitura(codAna))?.dataHora ?? new Date(0);
  const novas = lista.filter(l => l.dataHora > corte);
  if (novas.length === 0) return;

  await db.insert(leituras).values(novas.map(l => {
    const nivelM = l.nivelCm / 100;
    return {
      codAna,
      nivelCm: String(Math.round(nivelM * 100 * 100) / 100),
      nivelM:  String(nivelM.toFixed(3)),
      dataHora: l.dataHora,
      fonte: 'ANA',
    };
  }));
}

async function buscarUltimaLeitura(codAna: string): Promise<LeituraCache | null> {
  const rows = await db
    .select()
    .from(leituras)
    .where(eq(leituras.codAna, codAna))
    .orderBy(desc(leituras.dataHora))
    .limit(1);

  if (rows.length === 0) return null;
  return {
    nivelCm:  Number(rows[0].nivelCm),
    nivelM:   Number(rows[0].nivelM),
    dataHora: rows[0].dataHora!,
    fonte:    rows[0].fonte ?? 'ANA',
  };
}

/**
 * Última leitura de cada estação em uma única query. `DISTINCT ON` percorre o
 * índice (cod_ana, data_hora) uma vez, substituindo um SELECT por estação.
 */
async function buscarUltimasLeituras(codigos: string[]): Promise<Map<string, LeituraCache>> {
  const mapa = new Map<string, LeituraCache>();
  if (codigos.length === 0) return mapa;

  const { rows } = await db.execute<{
    cod_ana:   string;
    nivel_cm:  string | null;
    nivel_m:   string | null;
    data_hora: Date;
    fonte:     string | null;
  }>(sql`
    select distinct on (${leituras.codAna})
      ${leituras.codAna}   as cod_ana,
      ${leituras.nivelCm}  as nivel_cm,
      ${leituras.nivelM}   as nivel_m,
      ${leituras.dataHora} as data_hora,
      ${leituras.fonte}    as fonte
    from ${leituras}
    where ${inArray(leituras.codAna, codigos)}
    order by ${leituras.codAna}, ${leituras.dataHora} desc
  `);

  for (const row of rows) {
    mapa.set(row.cod_ana, {
      nivelCm:  Number(row.nivel_cm),
      nivelM:   Number(row.nivel_m),
      dataHora: row.data_hora instanceof Date ? row.data_hora : new Date(row.data_hora),
      fonte:    row.fonte ?? 'ANA',
    });
  }
  return mapa;
}

/**
 * Histórico de 2 dias de todas as estações em uma única query, agrupado por
 * código. Substitui um SELECT por estação no caminho de leitura.
 */
async function buscarLeiturasTendencia(
  codigos: string[],
): Promise<Map<string, Array<{ dataHora: Date; nivelCm: number }>>> {
  const mapa = new Map<string, Array<{ dataHora: Date; nivelCm: number }>>();
  if (codigos.length === 0) return mapa;

  const corte = new Date(Date.now() - 86400000 * 2);
  const rows = await db
    .select({ codAna: leituras.codAna, dataHora: leituras.dataHora, nivelCm: leituras.nivelCm })
    .from(leituras)
    .where(and(inArray(leituras.codAna, codigos), gte(leituras.dataHora, corte)))
    .orderBy(leituras.codAna, leituras.dataHora);

  for (const r of rows) {
    let lista = mapa.get(r.codAna);
    if (!lista) {
      lista = [];
      mapa.set(r.codAna, lista);
    }
    lista.push({ dataHora: r.dataHora!, nivelCm: Number(r.nivelCm) });
  }
  return mapa;
}

// ─── Cache em memória ────────────────────────────────────────────────────────

let ultimaAtualizacao: Date | null = null;
let atualizacaoEmAndamento: Promise<void> | null = null;

// Mapa codAna → dados DC mais recentes (para enriquecer com meteo)
let dcrsCache: Map<string, DcrsLeitura> = new Map();

// ─── Atualização via Defesa Civil ────────────────────────────────────────────

async function atualizarComDefesaCivil(
  estacoesDB: typeof estacoes.$inferSelect[],
): Promise<void> {
  // Busca todas as estações DC de uma vez (1 request)
  const dcLeituras = await fetchEstacoesDefesaCivil();

  // Indexa por codDcrs para lookup rápido
  const dcPorCodigo = new Map<string, DcrsLeitura>();
  for (const l of dcLeituras) {
    dcPorCodigo.set(l.codDcrs, l);
  }

  // Atualiza cache interno
  dcrsCache = dcPorCodigo;

  // Salva leituras no banco para cada estação com cod_dcrs. As datas das
  // últimas leituras vêm em uma query só, em vez de um SELECT por estação.
  const comDcrs = estacoesDB.filter(e => e.codDcrs);
  const ultimas = await buscarUltimasLeituras(comDcrs.map(e => e.codAna));

  await Promise.allSettled(
    comDcrs.map(async (est) => {
      const dc = dcPorCodigo.get(est.codDcrs!);
      if (!dc || dc.nivelM === null) return;
      const dataHora = dc.timestamp ? new Date(dc.timestamp) : new Date();
      await salvarLeitura(est.codAna, dc.nivelM, dataHora, 'DCRS', ultimas.get(est.codAna)?.dataHora ?? null);
    })
  );
}

// ─── Atualização via ANA (fallback para estações sem cod_dcrs) ───────────────

async function atualizarComAna(
  estacoesDB: typeof estacoes.$inferSelect[],
): Promise<void> {
  const semDcrs = estacoesDB.filter(e => !e.codDcrs);
  if (semDcrs.length === 0) return;

  await Promise.allSettled(
    semDcrs.map(async (est) => {
      try {
        await salvarLeiturasAna(est.codAna, await fetchAna(est.codAna));
      } catch {
        // Falha silenciosa — usa cache do banco
      }
    })
  );
}

async function atualizarDados(estacoesDB: typeof estacoes.$inferSelect[]): Promise<void> {
  // Tenta Defesa Civil primeiro (rápido)
  try {
    await atualizarComDefesaCivil(estacoesDB);
  } catch (err) {
    console.warn('[estacoes] Defesa Civil falhou, usando ANA como fallback:', err instanceof Error ? err.message : String(err));
    // Se DC falhar completamente, tenta ANA para todas
    await Promise.allSettled(
      estacoesDB.map(async (est) => {
        try {
          await salvarLeiturasAna(est.codAna, await fetchAna(est.codAna));
        } catch { /* silencioso */ }
      })
    );
  }

  // Estações sem cod_dcrs sempre usam ANA
  await atualizarComAna(estacoesDB);

  ultimaAtualizacao = new Date();
}

// ─── Função principal ────────────────────────────────────────────────────────

export async function getEstacoes(): Promise<LeituraEstacao[]> {
  const agora = new Date();
  const precisaAtualizar = !ultimaAtualizacao ||
    (agora.getTime() - ultimaAtualizacao.getTime()) > CACHE_TTL_MS;

  // A ordem dos cards vem do banco: `ordem` crescente, nulos por último e
  // nome como desempate — o front-end apenas preserva esta sequência.
  const estacoesDB = await db
    .select()
    .from(estacoes)
    .where(eq(estacoes.ativo, true))
    .orderBy(sql`${estacoes.ordem} asc nulls last`, asc(estacoes.nomeExibicao));

  if (precisaAtualizar) {
    const temCache = ultimaAtualizacao !== null;
    if (!temCache) {
      // Primeira chamada: aguarda
      if (!atualizacaoEmAndamento) {
        atualizacaoEmAndamento = atualizarDados(estacoesDB).finally(() => {
          atualizacaoEmAndamento = null;
        });
      }
      await atualizacaoEmAndamento;
    } else {
      // Já tem cache: atualiza em background
      if (!atualizacaoEmAndamento) {
        atualizacaoEmAndamento = atualizarDados(estacoesDB).finally(() => {
          atualizacaoEmAndamento = null;
        });
      }
    }
  }

  // Monta resposta. As duas consultas ao histórico são feitas em lote para
  // todas as estações — antes eram 2 queries por estação a cada requisição.
  const codigos = estacoesDB.map(e => e.codAna);
  const [ultimasLeituras, historicos] = await Promise.all([
    buscarUltimasLeituras(codigos),
    buscarLeiturasTendencia(codigos),
  ]);

  const resultado: LeituraEstacao[] = estacoesDB.map((est) => {
    const cache = ultimasLeituras.get(est.codAna) ?? null;
    const historico = historicos.get(est.codAna) ?? [];

    // leituras guarda o valor bruto. O datum é descontado aqui para que a
    // correção alcance também o histórico já salvo, sem migração de dados.
    const nivelM = cache
      ? aplicarRedutorTelemetria(Number(cache.nivelM), est.redutorTelemetria, cache.fonte)
      : null;
    const nivelCm = nivelM !== null ? metrosParaCentimetros(nivelM) : null;

    const cotaAtencao    = est.cotaAtencao    ? Number(est.cotaAtencao)    : null;
    const cotaAlerta     = est.cotaAlerta     ? Number(est.cotaAlerta)     : null;
    const cotaEmergencia = est.cotaEmergencia ? Number(est.cotaEmergencia) : null;

    const situacao = nivelM !== null
      ? calcSituacao(nivelM, cotaAtencao, cotaAlerta, cotaEmergencia)
      : 'normal';

    // Tendência: usa dado raw da DC se disponível, senão calcula do histórico
    let tendencia: 'subindo' | 'descendo' | 'estavel' = 'estavel';
    if (est.codDcrs) {
      const dc = dcrsCache.get(est.codDcrs);
      tendencia = dc ? calcTendenciaFromRaw(dc.tendenciaRaw) : calcTendenciaFromHistorico(historico);
    } else {
      tendencia = calcTendenciaFromHistorico(historico);
    }

    // Dados meteorológicos da DC (se disponíveis)
    const dc = est.codDcrs ? dcrsCache.get(est.codDcrs) : undefined;

    // Determina fonte para exibição
    const fonteExibicao = cache
      ? (cache.fonte === 'DCRS' ? 'DCRS' : 'ANA')
      : 'fallback';

    return {
      codAna:        est.codAna,
      codDcrs:       est.codDcrs ?? null,
      nomeExibicao:  est.nomeExibicao,
      rio:           est.rio,
      cidade:        est.cidade,
      lat:           est.lat,
      lng:           est.lng,
      posX:          est.posX,
      posY:          est.posY,
      ordem:         est.ordem ?? null,
      nivelM,
      nivelCm,
      dataHora:      cache ? cache.dataHora.toISOString() : null,
      situacao,
      tendencia,
      cotaAtencao,
      cotaAlerta,
      cotaEmergencia,
      temperatura:   dc?.temperatura ?? null,
      umidade:       dc?.umidade ?? null,
      pressao:       dc?.pressao ?? null,
      ventoVel:      dc?.ventoVel ?? null,
      chuva1h:       dc?.chuva1h ?? null,
      chuva24h:      dc?.chuva24h ?? null,
      chuva7d:       dc?.chuva7d ?? null,
      fonte:         fonteExibicao as 'DCRS' | 'ANA' | 'cache' | 'fallback',
      atualizadoEm:  ultimaAtualizacao?.toISOString() ?? null,
    };
  });

  return resultado;
}

// ─── Histórico para o gráfico ────────────────────────────────────────────────

export const HORAS_HISTORICO_PERMITIDAS = [24, 48, 168] as const;
export type HorasHistorico = typeof HORAS_HISTORICO_PERMITIDAS[number];

export interface HistoricoEstacao {
  codAna:         string;
  nomeExibicao:   string;
  cotaAtencao:    number | null;
  cotaAlerta:     number | null;
  cotaEmergencia: number | null;
  leituras:       Array<{ dataHora: string; nivelM: number }>;
}

/**
 * Leituras gravadas de uma estação ativa nas últimas `horas`, já com o
 * redutor de telemetria descontado (mesma regra do card). `null` quando a
 * estação não existe ou está inativa.
 */
export async function getHistoricoEstacao(
  codAna: string,
  horas: HorasHistorico,
): Promise<HistoricoEstacao | null> {
  const [est] = await db
    .select()
    .from(estacoes)
    .where(and(eq(estacoes.codAna, codAna), eq(estacoes.ativo, true)))
    .limit(1);
  if (!est) return null;

  const corte = new Date(Date.now() - horas * 60 * 60 * 1000);
  const rows = await db
    .select({ dataHora: leituras.dataHora, nivelM: leituras.nivelM, fonte: leituras.fonte })
    .from(leituras)
    .where(and(eq(leituras.codAna, codAna), gte(leituras.dataHora, corte)))
    .orderBy(asc(leituras.dataHora));

  return {
    codAna:         est.codAna,
    nomeExibicao:   est.nomeExibicao,
    cotaAtencao:    est.cotaAtencao    ? Number(est.cotaAtencao)    : null,
    cotaAlerta:     est.cotaAlerta     ? Number(est.cotaAlerta)     : null,
    cotaEmergencia: est.cotaEmergencia ? Number(est.cotaEmergencia) : null,
    leituras: rows
      .filter(r => r.nivelM !== null)
      .map(r => ({
        dataHora: r.dataHora!.toISOString(),
        nivelM:   aplicarRedutorTelemetria(Number(r.nivelM), est.redutorTelemetria, r.fonte ?? 'ANA'),
      })),
  };
}
