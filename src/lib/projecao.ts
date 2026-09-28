/**
 * Projeção de curto prazo do nível do rio por tendência amortecida (Holt).
 *
 * As leituras das últimas 24 h passam por uma suavização exponencial dupla:
 * o nível e a taxa de variação são atualizados a cada 15 minutos, com mais
 * peso para o que é recente. A taxa assim estimada reage a acelerações e
 * desacelerações da cheia; na projeção ela perde força aos poucos (`phi`),
 * o que curva a linha em vez de estender uma reta.
 *
 * Parâmetros escolhidos por backtest no histórico da bacia (jul–set/2026):
 * ajustados nos dados até 15/09 e validados depois, incluindo a cheia de
 * 21/09. Em momentos de subida ou descida de 25 cm ou mais, o erro médio em
 * 6 h caiu de 41 cm (reta dos últimos 3 h) para 36 cm. Ainda assim a
 * projeção tende a SUBESTIMAR subidas — ela não sabe da chuva que já caiu
 * nem da água que vem de montante.
 */

export interface PontoNivel {
  /** Instante da leitura em milissegundos (epoch). */
  t: number;
  nivelM: number;
}

export interface OpcoesProjecao {
  /** Quanto à frente projetar a partir da última leitura. */
  horizonteMs?: number;
  /** Intervalo entre os pontos projetados. */
  passoMs?: number;
}

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

export const HORIZONTE_PROJECAO_MS = 6 * HORA;

/** Passo da suavização. A telemetria chega a cada 5–60 min. */
const PASSO_MS = 15 * MINUTO;
/** Histórico usado para aquecer a suavização. */
const JANELA_MS = 24 * HORA;
/** Peso da leitura nova no nível suavizado. */
const ALPHA = 0.5;
/** Peso da variação nova na taxa suavizada. */
const BETA = 0.3;
/** Fração da taxa mantida a cada passo projetado (0,99⁴ ≈ 0,96 por hora). */
const PHI = 0.99;

/** Salto que, isolado e revertido logo em seguida, indica leitura espúria. */
const SALTO_ESPURIO_M = 1;

/**
 * Remove leituras isoladas absurdas (ex.: −30 m no meio de uma série em 1 m),
 * comuns em falhas de telemetria. Um salto que se mantém não é removido.
 */
export function removerPicosIsolados(leituras: PontoNivel[]): PontoNivel[] {
  return leituras.filter((p, i, a) => {
    if (i === 0 || i === a.length - 1) return true;
    return !(Math.abs(p.nivelM - a[i - 1].nivelM) > SALTO_ESPURIO_M
      && Math.abs(p.nivelM - a[i + 1].nivelM) > SALTO_ESPURIO_M);
  });
}

/**
 * Devolve os pontos projetados, começando pela última leitura (para a linha
 * tracejada partir exatamente do fim da série) — ou `null` quando não há
 * leituras recentes suficientes para estimar a tendência.
 *
 * `leituras` deve estar em ordem cronológica.
 */
export function projetarNivel(
  leituras: PontoNivel[],
  { horizonteMs = HORIZONTE_PROJECAO_MS, passoMs = 30 * MINUTO }: OpcoesProjecao = {},
): PontoNivel[] | null {
  const limpas = removerPicosIsolados(leituras);
  if (limpas.length === 0) return null;

  const ultima = limpas[limpas.length - 1];
  // Tendência exige pelo menos 3 leituras cobrindo 1 h dentro das últimas 3 h.
  const recentes = limpas.filter(p => p.t >= ultima.t - 3 * HORA);
  if (recentes.length < 3 || ultima.t - recentes[0].t < HORA) return null;

  // Suavização sobre uma grade regular: em cada passo vale a última leitura
  // disponível, o que acomoda estações de 5 min e de 1 h do mesmo jeito.
  const janela = limpas.filter(p => p.t > ultima.t - JANELA_MS);
  let nivel = janela[0].nivelM;
  let taxa = 0; // m por passo
  let j = 0;
  for (let t = janela[0].t + PASSO_MS; t <= ultima.t; t += PASSO_MS) {
    while (j + 1 < janela.length && janela[j + 1].t <= t) j++;
    const anterior = nivel;
    nivel = ALPHA * janela[j].nivelM + (1 - ALPHA) * (anterior + PHI * taxa);
    taxa = BETA * (nivel - anterior) + (1 - BETA) * PHI * taxa;
  }

  // A projeção parte da última leitura medida, não do nível suavizado, para
  // não "saltar" no ponto de junção; o que vem da suavização é a taxa.
  const ponto = (dt: number): PontoNivel => {
    const passos = dt / PASSO_MS;
    // Soma de PHI¹ … PHIⁿ, contínua em n para horizontes fora da grade.
    const acumulado = (PHI * (1 - PHI ** passos)) / (1 - PHI);
    const valor = ultima.nivelM + taxa * acumulado;
    return { t: ultima.t + dt, nivelM: Math.max(0, Math.round(valor * 1000) / 1000) };
  };

  const pontos: PontoNivel[] = [{ t: ultima.t, nivelM: ultima.nivelM }];
  for (let dt = passoMs; dt < horizonteMs; dt += passoMs) pontos.push(ponto(dt));
  // O último ponto cai exatamente no fim do horizonte, mesmo fora do passo.
  if (horizonteMs > 0) pontos.push(ponto(horizonteMs));
  return pontos;
}
