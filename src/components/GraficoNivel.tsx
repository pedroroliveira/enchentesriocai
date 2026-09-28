import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Info } from 'lucide-react';
import { projetarNivel, HORIZONTE_PROJECAO_MS, type PontoNivel } from '@/lib/projecao';

// ─── tipos ──────────────────────────────────────────────────────────────────

interface HistoricoAPI {
  codAna: string;
  nomeExibicao: string;
  cotaAtencao: number | null;
  cotaAlerta: number | null;
  cotaEmergencia: number | null;
  leituras: Array<{ dataHora: string; nivelM: number }>;
}

interface Props {
  codAna: string;
  /** Muda a cada atualização das estações — dispara um novo fetch. */
  versao?: string | null;
}

const PERIODOS = [
  { horas: 24, label: '24 h' },
  { horas: 48, label: '48 h' },
  { horas: 168, label: '7 dias' },
] as const;
type Horas = typeof PERIODOS[number]['horas'];

// ─── aparência ──────────────────────────────────────────────────────────────

const COR_SERIE = '#4A90D9';
const COR_GRADE = '#1a2e42';
const COR_EIXO = '#294667';
const COR_TEXTO = '#6b8fad';
const COR_TEXTO_FORTE = '#c9dcef';
const COR_SUPERFICIE = '#0A1420';

const COTAS = [
  { chave: 'cotaAtencao', label: 'Atenção', cor: '#fbbf24' },
  { chave: 'cotaAlerta', label: 'Alerta', cor: '#fb923c' },
  { chave: 'cotaEmergencia', label: 'Emergência', cor: '#f87171' },
] as const;

const ALTURA = 280;
const MARGEM = { top: 20, right: 96, bottom: 28, left: 44 };

const HORA = 60 * 60 * 1000;
/** Leitura mais velha que isto não gera projeção — seria extrapolar demais. */
const IDADE_MAX_PROJECAO_MS = 3 * HORA;
/** São Paulo não tem horário de verão desde 2019: UTC−3 fixo. */
const OFFSET_SP = -3 * HORA;

// ─── formatação ─────────────────────────────────────────────────────────────

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
});
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

function fmtNivel(m: number, casas = 2): string {
  return m.toFixed(casas).replace('.', ',');
}

// ─── escalas ────────────────────────────────────────────────────────────────

function ticksY(min: number, max: number, alvo = 5): { min: number; max: number; ticks: number[] } {
  const passos = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
  const bruto = (max - min) / alvo;
  const passo = passos.find(p => p >= bruto) ?? passos[passos.length - 1];
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) ticks.push(Math.round(v * 1000) / 1000);
  return { min: ini, max: fim, ticks };
}

function ticksX(t0: number, t1: number, maxTicks: number): { ticks: number[]; passo: number } {
  const passos = [1, 2, 3, 6, 12, 24, 48].map(h => h * HORA);
  const passo = passos.find(p => (t1 - t0) / p <= maxTicks) ?? passos[passos.length - 1];
  // Alinha as marcas ao relógio local (00:00, 06:00, …), não ao UTC.
  const primeiro = Math.ceil((t0 + OFFSET_SP) / passo) * passo - OFFSET_SP;
  const ticks: number[] = [];
  for (let t = primeiro; t <= t1; t += passo) ticks.push(t);
  return { ticks, passo };
}

function rotuloX(t: number, passo: number): string {
  const meiaNoite = (t + OFFSET_SP) % (24 * HORA) === 0;
  return passo >= 24 * HORA || meiaNoite ? fmtDia.format(t) : fmtHora.format(t);
}

/** Monta o `d` do path, interrompendo a linha em lacunas de leitura. */
function caminho(pontos: PontoNivel[], x: (t: number) => number, y: (v: number) => number, lacunaMs: number): string {
  let d = '';
  pontos.forEach((p, i) => {
    const quebra = i === 0 || p.t - pontos[i - 1].t > lacunaMs;
    d += `${quebra ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.nivelM).toFixed(1)}`;
  });
  return d;
}

/** Lacuna a partir da qual a linha é interrompida: 3× o intervalo típico, no mínimo 90 min. */
function limiteLacuna(pontos: PontoNivel[]): number {
  if (pontos.length < 3) return 90 * 60 * 1000;
  const difs = pontos.slice(1).map((p, i) => p.t - pontos[i].t).sort((a, b) => a - b);
  return Math.max(90 * 60 * 1000, 3 * difs[Math.floor(difs.length / 2)]);
}

/** Uma linha por hora (a última leitura de cada hora) para a tabela. */
function amostraHoraria(pontos: PontoNivel[]): PontoNivel[] {
  const porHora = new Map<number, PontoNivel>();
  for (const p of pontos) porHora.set(Math.floor(p.t / HORA), p);
  return [...porHora.values()];
}

// ─── componente ─────────────────────────────────────────────────────────────

export default function GraficoNivel({ codAna, versao }: Props) {
  const [horas, setHoras] = useState<Horas>(48);
  const [dados, setDados] = useState<HistoricoAPI | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [largura, setLargura] = useState(0);
  const [hover, setHover] = useState<{ p: PontoNivel; projetado: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/estacoes/${codAna}/leituras?horas=${horas}`, { signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setDados(await res.json() as HistoricoAPI);
      setErro(false);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setErro(true);
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, [codAna, horas]);

  useEffect(() => {
    const ctrl = new AbortController();
    void carregar(ctrl.signal);
    return () => ctrl.abort();
  }, [carregar, versao]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setLargura(entry.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Dados de outra estação não podem aparecer enquanto a nova carrega.
  const dadosAtuais = dados?.codAna === codAna ? dados : null;

  const leituras = useMemo<PontoNivel[]>(
    () => (dadosAtuais?.leituras ?? []).map(l => ({ t: new Date(l.dataHora).getTime(), nivelM: l.nivelM })),
    [dadosAtuais],
  );
  // A projeção vai da última leitura até agora + 6 h. `versao` muda a cada
  // atualização da página e mantém o "agora" em dia.
  const agora = useMemo(() => Date.now(), [leituras, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const ultimaT = leituras.length > 0 ? leituras[leituras.length - 1].t : null;
  const leituraAntiga = ultimaT !== null && agora - ultimaT > IDADE_MAX_PROJECAO_MS;
  const projecao = useMemo(
    () => (ultimaT === null || leituraAntiga
      ? null
      : projetarNivel(leituras, { horizonteMs: agora + HORIZONTE_PROJECAO_MS - ultimaT })),
    [leituras, agora, ultimaT, leituraAntiga],
  );

  const grafico = useMemo(() => {
    if (!dadosAtuais || leituras.length === 0 || largura === 0) return null;

    const margem = MARGEM;
    const w = largura - margem.left - margem.right;
    const h = ALTURA - margem.top - margem.bottom;

    const t0 = agora - horas * HORA;
    const t1 = Math.max(agora, leituras[leituras.length - 1].t) + HORIZONTE_PROJECAO_MS;

    // Eixo Y: dados + projeção + a próxima cota acima do nível máximo, para
    // mostrar quanto falta até ela. Cotas mais altas ficam fora de escala.
    const valores = [...leituras, ...(projecao ?? [])].map(p => p.nivelM);
    let yMin = Math.min(...valores);
    let yMax = Math.max(...valores);
    const cotas = COTAS
      .map(c => ({ ...c, valor: dadosAtuais[c.chave] }))
      .filter((c): c is typeof c & { valor: number } => c.valor !== null)
      .sort((a, b) => a.valor - b.valor);
    const proxima = cotas.find(c => c.valor > yMax);
    if (proxima) yMax = proxima.valor;
    for (const c of cotas) if (c.valor <= yMax) yMin = Math.min(yMin, c.valor);
    const folga = Math.max((yMax - yMin) * 0.08, 0.1);
    const escalaY = ticksY(yMin - folga, yMax + folga);

    const x = (t: number) => margem.left + ((t - t0) / (t1 - t0)) * w;
    const y = (v: number) => margem.top + (1 - (v - escalaY.min) / (escalaY.max - escalaY.min)) * h;

    const lacuna = limiteLacuna(leituras);
    const visiveis = cotas.filter(c => c.valor >= escalaY.min && c.valor <= escalaY.max);

    // Rótulos das cotas na margem direita, afastados quando ficam próximos.
    const rotulos = visiveis.map(c => ({ ...c, yLinha: y(c.valor), yTexto: y(c.valor) }));
    for (let i = rotulos.length - 2; i >= 0; i--) {
      if (rotulos[i].yTexto - rotulos[i + 1].yTexto < 13) rotulos[i].yTexto = rotulos[i + 1].yTexto + 13;
    }

    return {
      margem, w, h, x, y, t0, t1, agora, escalaY, rotulos,
      eixoX: ticksX(t0, t1, Math.max(3, Math.floor(w / 72))),
      dLeituras: caminho(leituras, x, y, lacuna),
      dProjecao: projecao ? caminho(projecao, x, y, Infinity) : null,
    };
  }, [dadosAtuais, leituras, projecao, largura, horas, agora]);

  const ultima = leituras[leituras.length - 1];
  const fimProjecao = projecao?.[projecao.length - 1];

  function aoMoverPonteiro(e: React.PointerEvent<SVGRectElement>) {
    if (!grafico) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = grafico.t0 + ((e.clientX - rect.left) / rect.width) * (grafico.t1 - grafico.t0);
    const candidatos = [
      ...leituras.map(p => ({ p, projetado: false })),
      ...(projecao ?? []).slice(1).map(p => ({ p, projetado: true })),
    ];
    let melhor = candidatos[0];
    for (const c of candidatos) if (Math.abs(c.p.t - t) < Math.abs(melhor.p.t - t)) melhor = c;
    setHover(melhor ?? null);
  }

  const periodoLabel = PERIODOS.find(p => p.horas === horas)!.label;

  return (
    <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-4 py-3 border-b border-[#294667] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Nível do rio — {dadosAtuais?.nomeExibicao ?? '…'}
          </h2>
          <p className="text-[11px] text-[#6b8fad] mt-0.5">
            Últimas {periodoLabel} e projeção para as próximas 6 horas
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Período do gráfico">
          {PERIODOS.map(p => (
            <button
              key={p.horas}
              type="button"
              onClick={() => setHoras(p.horas)}
              aria-pressed={horas === p.horas}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                horas === p.horas
                  ? 'bg-primary/15 border-primary/50 text-white'
                  : 'border-[#294667] text-[#6b8fad] hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="px-4 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#8aabcc]">
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden="true"><line x1="0" y1="3" x2="20" y2="3" stroke={COR_SERIE} strokeWidth="2" /></svg>
          Nível medido
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden="true"><line x1="0" y1="3" x2="20" y2="3" stroke={COR_SERIE} strokeWidth="2" strokeDasharray="4 3" /></svg>
          Projeção (6 h)
        </span>
      </div>

      {/* Gráfico */}
      <div ref={containerRef} className="relative px-2 pb-1" style={{ height: ALTURA }}>
        {carregando && !dadosAtuais && (
          <div className="absolute inset-3 rounded-lg bg-[#0d1a27] animate-pulse flex items-center justify-center">
            <RefreshCw size={16} className="text-[#294667] animate-spin" />
          </div>
        )}
        {erro && !dadosAtuais && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-[#4a6a85]">Não foi possível carregar as leituras.</p>
            <button type="button" onClick={() => void carregar()} className="text-xs text-primary hover:underline">
              Tentar novamente
            </button>
          </div>
        )}
        {dadosAtuais && leituras.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[#4a6a85]">
            Sem leituras registradas nas últimas {periodoLabel}.
          </div>
        )}

        {grafico && (
          <svg
            width={largura}
            height={ALTURA}
            className="block"
            role="img"
            aria-label={
              `Nível de ${dadosAtuais!.nomeExibicao} nas últimas ${periodoLabel}: ` +
              `${fmtNivel(ultima.nivelM)} m na última leitura` +
              (fimProjecao ? `, projeção de ${fmtNivel(fimProjecao.nivelM)} m em 6 horas.` : '.')
            }
          >
            {/* Região das próximas horas */}
            <rect
              x={grafico.x(grafico.agora)}
              y={grafico.margem.top}
              width={grafico.x(grafico.t1) - grafico.x(grafico.agora)}
              height={grafico.h}
              fill={COR_SERIE}
              opacity={0.05}
            />

            {/* Grade e eixo Y */}
            {grafico.escalaY.ticks.map(v => (
              <g key={v}>
                <line x1={grafico.margem.left} x2={grafico.margem.left + grafico.w} y1={grafico.y(v)} y2={grafico.y(v)} stroke={COR_GRADE} strokeWidth={1} />
                <text x={grafico.margem.left - 6} y={grafico.y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={COR_TEXTO} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtNivel(v, v % 1 === 0 ? 0 : 2)}
                </text>
              </g>
            ))}
            <text x={4} y={grafico.margem.top - 8} fontSize={10} fill={COR_TEXTO}>m</text>

            {/* Eixo X */}
            <line x1={grafico.margem.left} x2={grafico.margem.left + grafico.w} y1={grafico.margem.top + grafico.h} y2={grafico.margem.top + grafico.h} stroke={COR_EIXO} strokeWidth={1} />
            {grafico.eixoX.ticks.map(t => (
              <text key={t} x={grafico.x(t)} y={ALTURA - 8} textAnchor="middle" fontSize={10} fill={COR_TEXTO}>
                {rotuloX(t, grafico.eixoX.passo)}
              </text>
            ))}

            {/* Marcador de "agora" */}
            <line x1={grafico.x(grafico.agora)} x2={grafico.x(grafico.agora)} y1={grafico.margem.top} y2={grafico.margem.top + grafico.h} stroke={COR_EIXO} strokeWidth={1} />
            <text x={grafico.x(grafico.agora) + 4} y={grafico.margem.top + 10} fontSize={10} fill={COR_TEXTO}>agora</text>

            {/* Cotas de referência */}
            {grafico.rotulos.map(c => (
              <g key={c.chave}>
                <line x1={grafico.margem.left} x2={grafico.margem.left + grafico.w + 4} y1={c.yLinha} y2={c.yLinha} stroke={c.cor} strokeWidth={1.5} opacity={0.85} />
                <text x={grafico.margem.left + grafico.w + 8} y={c.yTexto} dy="0.32em" fontSize={10} fill={COR_TEXTO_FORTE}>
                  {c.label} {fmtNivel(c.valor)}
                </text>
              </g>
            ))}

            {/* Série medida e projeção */}
            <path d={grafico.dLeituras} fill="none" stroke={COR_SERIE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {grafico.dProjecao && (
              <path d={grafico.dProjecao} fill="none" stroke={COR_SERIE} strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" opacity={0.9} />
            )}

            {/* Última leitura */}
            <circle cx={grafico.x(ultima.t)} cy={grafico.y(ultima.nivelM)} r={4} fill={COR_SERIE} stroke={COR_SUPERFICIE} strokeWidth={2} />
            <text x={grafico.x(ultima.t) - 6} y={grafico.y(ultima.nivelM) - 10} textAnchor="end" fontSize={11} fontWeight={600} fill="#ffffff">
              {fmtNivel(ultima.nivelM)} m
            </text>

            {/* Fim da projeção — só quando cabe sem encostar no rótulo da última leitura */}
            {fimProjecao && grafico.x(fimProjecao.t) - grafico.x(ultima.t) >= 120 && (
              <text
                x={grafico.x(fimProjecao.t)}
                y={grafico.y(fimProjecao.nivelM) + (fimProjecao.nivelM >= ultima.nivelM ? -10 : 16)}
                textAnchor="end"
                fontSize={10}
                fill={COR_TEXTO_FORTE}
              >
                +6 h: {fmtNivel(fimProjecao.nivelM)} m
              </text>
            )}

            {/* Crosshair */}
            {hover && (
              <g pointerEvents="none">
                <line x1={grafico.x(hover.p.t)} x2={grafico.x(hover.p.t)} y1={grafico.margem.top} y2={grafico.margem.top + grafico.h} stroke={COR_TEXTO} strokeWidth={1} />
                <circle cx={grafico.x(hover.p.t)} cy={grafico.y(hover.p.nivelM)} r={4.5} fill={COR_SERIE} stroke={COR_SUPERFICIE} strokeWidth={2} />
              </g>
            )}

            {/* Área de captura do ponteiro — maior que a linha */}
            <rect
              x={grafico.margem.left}
              y={grafico.margem.top}
              width={grafico.w}
              height={grafico.h}
              fill="transparent"
              onPointerMove={aoMoverPonteiro}
              onPointerDown={aoMoverPonteiro}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}

        {/* Tooltip */}
        {grafico && hover && (
          <div
            className="absolute pointer-events-none bg-[#0d1a27] border border-[#294667] rounded-md px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
            style={{
              left: Math.min(grafico.x(hover.p.t) + 16, largura - 140),
              top: Math.max(4, grafico.y(hover.p.nivelM) - 48),
            }}
          >
            <div className="text-[#6b8fad]">{fmtDataHora.format(hover.p.t)}</div>
            <div className="text-white font-semibold tabular-nums">
              {fmtNivel(hover.p.nivelM)} m
              {hover.projetado && <span className="ml-1.5 font-normal text-[#8aabcc]">projeção</span>}
            </div>
          </div>
        )}
      </div>

      {/* Nota + tabela */}
      <div className="px-4 py-3 border-t border-[#1a2e42] space-y-2">
        <p className="text-[11px] text-[#4a6a85] flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            {projecao
              ? 'A projeção segue a tendência recente do nível, que perde força com o tempo. Ela não considera a chuva nem a água que vem de montante e, por isso, tende a subestimar subidas: em cheias passadas, errou em média 40 cm em 6 horas. Use como indicação, não como previsão oficial — siga sempre as orientações da Defesa Civil.'
              : leituraAntiga
                ? 'Projeção indisponível: a última leitura desta estação tem mais de 3 horas.'
                : leituras.length > 0
                ? 'Projeção indisponível: não há leituras suficientes nas últimas 3 horas.'
                : 'Os níveis são registrados a cada leitura da DCRS ou da ANA.'}
          </span>
        </p>

        {leituras.length > 0 && (
          <details className="text-xs text-[#8aabcc]">
            <summary className="cursor-pointer text-[#6b8fad] hover:text-white w-fit">Ver dados em tabela</summary>
            <div className="mt-2 max-h-64 overflow-y-auto border border-[#1a2e42] rounded-md">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[#0d1a27] text-[#6b8fad]">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Data e hora</th>
                    <th className="px-3 py-1.5 font-medium text-right">Nível (m)</th>
                    <th className="px-3 py-1.5 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2e42] tabular-nums">
                  {(projecao ?? []).slice(1).reverse().map(p => (
                    <tr key={`p${p.t}`} className="text-[#6b8fad]">
                      <td className="px-3 py-1">{fmtDataHora.format(p.t)}</td>
                      <td className="px-3 py-1 text-right">{fmtNivel(p.nivelM)}</td>
                      <td className="px-3 py-1">Projeção</td>
                    </tr>
                  ))}
                  {amostraHoraria(leituras).reverse().map(p => (
                    <tr key={p.t}>
                      <td className="px-3 py-1">{fmtDataHora.format(p.t)}</td>
                      <td className="px-3 py-1 text-right">{fmtNivel(p.nivelM)}</td>
                      <td className="px-3 py-1">Medido</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
