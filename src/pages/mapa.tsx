import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Waves,
  AlertTriangle,
  Info,
  Video,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { mapa } from 'virtual:content';
import StationLocationLink from '@/components/StationLocationLink';

const SITE = 'https://enchentesvaledocai.com.br';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutos

// ─── Dados locais ───────────────────────────────────────────────────────────

const hero = {
  titulo: 'Mapa da Bacia do Caí',
  subtitulo: 'Monitoramento em tempo real dos níveis dos rios e áreas de risco na bacia hidrográfica do Rio Caí, RS.',
};

const legenda = {
  titulo: 'Situação',
  situacoes: [
    { id: 'normal', cor: 'emerald', label: 'Normal' },
    { id: 'atencao', cor: 'amber', label: 'Atenção' },
    { id: 'alerta', cor: 'orange', label: 'Alerta' },
    { id: 'emergencia', cor: 'red', label: 'Emergência' },
  ],
};

// Rede hidrográfica esquemática baseada no desenho da bacia. O primeiro
// caminho é o eixo monitorado do Rio Caí e continua passando pelas posições
// cadastradas das estações; os demais representam seus principais braços.
const riverPaths = [
  {
    id: 'rio-cai',
    d: 'M 58 6 C 55 9 54 12 52 15 C 50 18 48 20 46 22 C 43 25 39 27 36 28 C 33 30 32 31 30 33 C 28 35 26 37 24 40 C 21 44 20 47 18 50 C 16 54 14 58 12 62 C 10 69 8 78 6 90',
    strokeWidth: 1.8,
    opacity: 0.75,
  },
  {
    id: 'afluente-noroeste',
    d: 'M 36 28 C 32 25 29 23 25 23 C 20 23 15 20 11 17 C 7 14 7 10 6 6',
    strokeWidth: 1.15,
    opacity: 0.58,
  },
  {
    id: 'afluente-leste',
    d: 'M 12 62 C 17 58 21 57 25 54 C 28 51 29 47 32 45 C 37 41 43 42 49 43 C 54 44 58 45 62 45',
    strokeWidth: 1.15,
    opacity: 0.58,
  },
  {
    id: 'afluente-nordeste',
    d: 'M 62 45 C 66 41 68 37 69 32 C 70 26 70 21 74 15',
    strokeWidth: 0.95,
    opacity: 0.52,
  },
  {
    id: 'afluente-leste-baixo',
    d: 'M 62 45 C 68 45 72 47 77 45 C 84 45 89 42 94 38',
    strokeWidth: 0.95,
    opacity: 0.52,
  },
] as const;

// Áreas de risco derivadas dinamicamente das estações com situação crítica
// (não há lista estática — o painel é construído a partir dos dados reais da ANA)

// ─── Tipos ──────────────────────────────────────────────────────────────────

type Situacao = 'normal' | 'atencao' | 'alerta' | 'emergencia';

interface EstacaoAPI {
  codAna: string;
  nomeExibicao: string;
  rio: string;
  cidade: string;
  lat: string | null;
  lng: string | null;
  posX: string | null;
  posY: string | null;
  nivelM: number | null;
  nivelCm: number | null;
  dataHora: string | null;
  situacao: Situacao;
  tendencia: 'subindo' | 'descendo' | 'estavel';
  cotaAtencao: number | null;
  cotaAlerta: number | null;
  cotaEmergencia: number | null;
  /** Ordem crescente de exibição dos cards (null = sem ordem definida). */
  ordem: number | null;
  fonte: string;
  atualizadoEm: string | null;
}

// ─── Helpers visuais ─────────────────────────────────────────────────────────

/**
 * Ordena os cards pelo campo `ordem` cadastrado no banco. Estações sem ordem
 * definida vão para o fim, com o nome como desempate.
 */
function ordenarEstacoes(lista: EstacaoAPI[]): EstacaoAPI[] {
  return [...lista].sort((a, b) => {
    const ordemA = a.ordem ?? Number.MAX_SAFE_INTEGER;
    const ordemB = b.ordem ?? Number.MAX_SAFE_INTEGER;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return a.nomeExibicao.localeCompare(b.nomeExibicao, 'pt-BR');
  });
}


const SITUACAO_CONFIG = {
  normal:     { label: 'Normal',     dot: 'bg-emerald-400', ring: 'ring-emerald-400/40', text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/15', svgFill: '#10b981' },
  atencao:    { label: 'Atenção',    dot: 'bg-amber-400',   ring: 'ring-amber-400/40',   text: 'text-amber-400',   border: 'border-amber-500/40',   bg: 'bg-amber-500/15',   svgFill: '#f59e0b' },
  alerta:     { label: 'Alerta',     dot: 'bg-orange-400',  ring: 'ring-orange-400/40',  text: 'text-orange-400',  border: 'border-orange-500/40',  bg: 'bg-orange-500/15',  svgFill: '#f97316' },
  emergencia: { label: 'Emergência', dot: 'bg-red-400',     ring: 'ring-red-400/40',     text: 'text-red-400',     border: 'border-red-500/40',     bg: 'bg-red-500/15',     svgFill: '#ef4444' },
} as const;

function situacaoConfig(s: Situacao) {
  return SITUACAO_CONFIG[s] ?? SITUACAO_CONFIG.normal;
}

function formatNivel(nivelM: number | null): string {
  if (nivelM === null) return '—';
  return nivelM.toFixed(2).replace('.', ',');
}

function formatDataHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function formatAtualizacao(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

const FONTE_LEITURA_CONFIG = {
  DCRS:         { label: 'DCRS',           className: 'text-sky-300 bg-sky-500/10 border-sky-500/25' },
  ANA:          { label: 'ANA (fallback)', className: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
  indisponivel: { label: 'Indisponível',   className: 'text-[#6b8fad] bg-[#1a2e42] border-[#294667]' },
} as const;

function fonteLeituraConfig(fonte: string) {
  if (fonte === 'DCRS') return FONTE_LEITURA_CONFIG.DCRS;
  if (fonte === 'ANA') return FONTE_LEITURA_CONFIG.ANA;
  return FONTE_LEITURA_CONFIG.indisponivel;
}

// Documento JSON-LD estático: não depende de estado, fica fora do render.
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${SITE}/mapa#webpage`,
  name: 'Mapa da Bacia do Caí — Enchentes Vale do Caí',
  url: `${SITE}/mapa`,
  isPartOf: { '@id': `${SITE}/#website` },
  about: { '@id': `${SITE}/#organization` },
});

// ─── Componente principal ────────────────────────────────────────────────────

export default function MapaPage() {
  const [estacoes, setEstacoes] = useState<EstacaoAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [selected, setSelected] = useState<EstacaoAPI | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const fetchEstacoes = useCallback(async (manual = false) => {
    if (manual) setAtualizando(true);
    try {
      const res = await fetch('/api/estacoes');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const novas: EstacaoAPI[] = ordenarEstacoes(data.estacoes ?? []);
      setEstacoes(novas);
      setAtualizadoEm(data.atualizadoEm ?? null);
      setErro(false);
      // Atualiza estação selecionada com dados frescos. A forma funcional lê o
      // estado atual sem entrar nas dependências — assim o callback permanece
      // estável e o setInterval abaixo não fica preso a um `selected` antigo.
      setSelected(prev => (prev ? novas.find(e => e.codAna === prev.codAna) ?? prev : prev));
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void fetchEstacoes();
    const timer = setInterval(() => void fetchEstacoes(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchEstacoes]);

  const estacoesEmAlerta = useMemo(
    () => estacoes.filter(e => e.situacao !== 'normal'),
    [estacoes],
  );

  return (
    <>
      <Helmet>
        <title>Mapa da Bacia do Caí — Enchentes Vale do Caí</title>
        <meta name="description" content="Mapa interativo com pontos de monitoramento, níveis dos rios e áreas de risco ao longo da bacia hidrográfica do Rio Caí, RS." />
        <link rel="canonical" href={`${SITE}/mapa`} />
        <meta property="og:title" content="Mapa da Bacia do Caí" />
        <meta property="og:description" content="Pontos de monitoramento, níveis dos rios e áreas de risco na bacia do Caí." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE}/mapa`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta property="og:image" content={`${SITE}/og-image.svg`} />
        <meta name="twitter:image" content={`${SITE}/og-image.svg`} />
        <script type="application/ld+json">{JSON_LD}</script>
      </Helmet>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="bg-[#0A1420] border-b border-[#294667] py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 mb-2">
              <Waves size={16} className="text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">Bacia Hidrográfica</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{hero.titulo}</h1>
                <p className="text-[#8aabcc] text-sm max-w-2xl">{hero.subtitulo}</p>
              </div>
              {/* Status de atualização */}
              <div className="flex items-center gap-2 shrink-0">
                {erro ? (
                  <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full">
                    <WifiOff size={11} />
                    Sem conexão
                  </span>
                ) : loading ? (
                  <span className="flex items-center gap-1.5 text-xs text-[#6b8fad] bg-[#1E3A5F] border border-[#294667] px-2.5 py-1 rounded-full">
                    <RefreshCw size={11} className="animate-spin" />
                    Carregando...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    <Wifi size={11} />
                    Atualizado {formatAtualizacao(atualizadoEm)}
                  </span>
                )}
                <button
                  onClick={() => fetchEstacoes(true)}
                  disabled={atualizando || loading}
                  className="p-1.5 rounded-lg border border-[#294667] text-[#6b8fad] hover:text-white hover:border-[#4A90D9] transition-colors disabled:opacity-40"
                  aria-label="Atualizar dados"
                  title="Atualizar dados"
                >
                  <RefreshCw size={13} className={atualizando ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Mapa + Painel ─────────────────────────────────────────────── */}
        <section className="bg-[#0d1a27] py-10">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Mapa SVG */}
              <div className="lg:col-span-2">
                <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#294667] flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Bacia do Rio Caí — RS</span>
                    <span className="text-xs text-[#6b8fad] bg-[#1E3A5F] px-2 py-0.5 rounded-full border border-[#294667]">
                      {loading ? '...' : estacoes.length} estações
                    </span>
                  </div>

                  {/* SVG Map */}
                  <div className="relative" style={{ paddingBottom: '75%' }}>
                    <svg
                      viewBox="0 0 100 100"
                      className="absolute inset-0 w-full h-full"
                      style={{ background: 'linear-gradient(160deg, #0d1a27 0%, #0A1420 100%)' }}
                      aria-label="Mapa da bacia do Rio Caí"
                      role="img"
                    >
                      {/* Grid lines */}
                      {[10,20,30,40,50,60,70,80,90].map(v => (
                        <g key={v}>
                          <line x1={v} y1="0" x2={v} y2="100" stroke="#1a2e42" strokeWidth="0.3" />
                          <line x1="0" y1={v} x2="100" y2={v} stroke="#1a2e42" strokeWidth="0.3" />
                        </g>
                      ))}

                      {/* Rede hidrográfica — Rio Caí e afluentes */}
                      <g aria-label="Rede hidrográfica esquemática do Rio Caí">
                        {riverPaths.map(river => (
                          <path
                            key={river.id}
                            d={river.d}
                            fill="none"
                            stroke="#4A90D9"
                            strokeWidth={river.strokeWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={river.opacity}
                          />
                        ))}
                      </g>

                      {/* Labels */}
                      <text x="60" y="12" fill="#2a4a6a" fontSize="3" fontFamily="sans-serif">Serra Gaúcha</text>
                      <text x="4" y="95" fill="#2a4a6a" fontSize="3" fontFamily="sans-serif">Guaíba</text>
                      <text x="20" y="46" fill="#1f4a70" fontSize="2.5" fontFamily="sans-serif" transform="rotate(-54 20 46)">Rio Caí</text>
                      <text x="13" y="19" fill="#1a3a5a" fontSize="2.2" fontFamily="sans-serif" transform="rotate(18 13 19)">Rio Fão</text>

                      {/* Áreas de risco */}
                      <ellipse cx="22" cy="50" rx="5" ry="3" fill="#f59e0b" opacity="0.08" />
                      <ellipse cx="28" cy="40" rx="4" ry="2.5" fill="#f59e0b" opacity="0.08" />
                      <ellipse cx="14" cy="65" rx="6" ry="3.5" fill="#ef4444" opacity="0.08" />

                      {/* Skeleton enquanto carrega */}
                      {loading && [
                        { x: 52, y: 15 }, { x: 46, y: 22 }, { x: 36, y: 28 },
                        { x: 30, y: 33 }, { x: 24, y: 40 }, { x: 18, y: 50 }, { x: 12, y: 62 },
                      ].map((pos, i) => (
                        <circle key={i} cx={pos.x} cy={pos.y} r="2.5" fill="#1a2e42" opacity="0.6">
                          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
                        </circle>
                      ))}

                      {/* Station markers — dados reais */}
                      {!loading && estacoes.map((est) => {
                        const cfg = situacaoConfig(est.situacao);
                        const px = Number(est.posX);
                        const py = Number(est.posY);
                        const isHovered  = hoveredId === est.codAna;
                        const isSelected = selected?.codAna === est.codAna;
                        if (isNaN(px) || isNaN(py)) return null;
                        return (
                          <g
                            key={est.codAna}
                            transform={`translate(${px}, ${py})`}
                            onClick={() => setSelected(est)}
                            onMouseEnter={() => setHoveredId(est.codAna)}
                            onMouseLeave={() => setHoveredId(null)}
                            style={{ cursor: 'pointer' }}
                            role="button"
                            aria-label={`Estação ${est.nomeExibicao}: ${formatNivel(est.nivelM)}m — ${cfg.label}`}
                          >
                            {/* Pulse ring para situações críticas */}
                            {est.situacao !== 'normal' && (
                              <circle r="4" fill="none" stroke={cfg.svgFill} strokeWidth="0.5" opacity="0.4">
                                <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                              </circle>
                            )}
                            {/* Anel de seleção */}
                            {(isHovered || isSelected) && (
                              <circle r="4.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6" />
                            )}
                            {/* Ponto principal */}
                            <circle
                              r="2.5"
                              fill={cfg.svgFill}
                              stroke="white"
                              strokeWidth="0.4"
                            />
                            {/* Label ao hover */}
                            {(isHovered || isSelected) && (
                              <text
                                x="4"
                                y="-3"
                                fill="white"
                                fontSize="2.8"
                                fontFamily="sans-serif"
                                fontWeight="bold"
                                style={{ pointerEvents: 'none' }}
                              >
                                {est.nomeExibicao}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Legenda */}
                  <div className="px-4 py-3 border-t border-[#294667] flex flex-wrap gap-4">
                    <span className="text-xs text-[#6b8fad] font-semibold">{legenda.titulo}:</span>
                    {legenda.situacoes.map((s) => {
                      const dotColor =
                        s.cor === 'emerald' ? 'bg-emerald-400' :
                        s.cor === 'amber'   ? 'bg-amber-400' :
                        s.cor === 'orange'  ? 'bg-orange-400' : 'bg-red-400';
                      return (
                        <div key={s.id} className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span className="text-xs text-[#8aabcc]">{s.label}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="inline-block w-6 h-0.5 bg-primary opacity-70" />
                      <span className="text-xs text-[#8aabcc]">Rio Caí</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-6 h-0.5 bg-primary opacity-40" style={{ borderTop: '1px dashed #4A90D9' }} />
                      <span className="text-xs text-[#8aabcc]">Afluente</span>
                    </div>
                  </div>
                </div>

                {/* Nota de fonte */}
                <div className="flex items-start gap-2 mt-3 px-1">
                  <Info size={13} className="text-[#4a6a85] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#4a6a85]">
                    Dados de nível fornecidos pela Defesa Civil do RS (DCRS), com a ANA como fonte alternativa quando necessário. Posições no mapa são aproximadas. Atualização automática a cada 5 minutos.
                  </p>
                </div>
              </div>

              {/* Painel lateral */}
              <div className="flex flex-col gap-4">

                {/* Detalhe da estação selecionada */}
                <AnimatePresence mode="wait">
                  {selected ? (
                    <motion.div
                      key={selected.codAna}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className={`bg-[#0A1420] border ${situacaoConfig(selected.situacao).border} rounded-xl p-5`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-1.5 text-[#6b8fad] text-xs mb-1">
                            <MapPin size={11} />
                            <span>{selected.rio}</span>
                          </div>
                          <h2 className="font-bold text-white text-lg">{selected.nomeExibicao}</h2>
                          <div className="text-[10px] text-[#4a6a85] mt-0.5">{selected.cidade}</div>
                        </div>
                        <button
                          onClick={() => setSelected(null)}
                          className="text-[#4a6a85] hover:text-white transition-colors p-1"
                          aria-label="Fechar detalhe"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Nível */}
                      <div className="flex items-end gap-2 mb-1">
                        <span className="text-5xl font-bold text-white tabular-nums">
                          {formatNivel(selected.nivelM)}
                        </span>
                        <span className="text-[#6b8fad] text-base mb-1">m</span>
                      </div>
                      {selected.nivelCm !== null && (
                        <div className="text-xs text-[#4a6a85] mb-3">{selected.nivelCm.toFixed(0)} cm</div>
                      )}

                      {/* Status + tendência */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${situacaoConfig(selected.situacao).bg} ${situacaoConfig(selected.situacao).text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${situacaoConfig(selected.situacao).dot}`} />
                          {situacaoConfig(selected.situacao).label}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#6b8fad]">
                          {selected.tendencia === 'subindo'  && <><TrendingUp  size={13} className="text-amber-400" /><span className="text-amber-400">Subindo</span></>}
                          {selected.tendencia === 'descendo' && <><TrendingDown size={13} className="text-emerald-400" /><span className="text-emerald-400">Descendo</span></>}
                          {selected.tendencia === 'estavel'  && <><Minus size={13} className="text-[#6b8fad]" /><span>Estável</span></>}
                        </span>
                      </div>

                      {/* Cotas de referência */}
                      {(selected.cotaAtencao || selected.cotaAlerta || selected.cotaEmergencia) && (
                        <div className="bg-[#0d1a27] rounded-lg px-3 py-2.5 mb-3 space-y-1.5">
                          <div className="text-[10px] font-semibold text-[#4a6a85] uppercase tracking-wide mb-1">Cotas de referência</div>
                          {selected.cotaAtencao && (
                            <div className="flex justify-between text-xs">
                              <span className="text-amber-400">Atenção</span>
                              <span className="text-white tabular-nums">{selected.cotaAtencao.toFixed(2).replace('.', ',')} m</span>
                            </div>
                          )}
                          {selected.cotaAlerta && (
                            <div className="flex justify-between text-xs">
                              <span className="text-orange-400">Alerta</span>
                              <span className="text-white tabular-nums">{selected.cotaAlerta.toFixed(2).replace('.', ',')} m</span>
                            </div>
                          )}
                          {selected.cotaEmergencia && (
                            <div className="flex justify-between text-xs">
                              <span className="text-red-400">Emergência</span>
                              <span className="text-white tabular-nums">{selected.cotaEmergencia.toFixed(2).replace('.', ',')} m</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Última leitura */}
                      <div className="text-xs text-[#4a6a85] bg-[#0d1a27] rounded-lg px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span>Última leitura</span>
                          <span className="text-[#6b8fad] tabular-nums">{formatDataHora(selected.dataHora)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-[#1a2e42]">
                          <span>Origem da leitura</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${fonteLeituraConfig(selected.fonte).className}`}>
                            {fonteLeituraConfig(selected.fonte).label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <StationLocationLink lat={selected.lat} lng={selected.lng} />
                        <div className="text-[10px] text-[#3a5a75] text-right">
                          Cód. ANA: {selected.codAna}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-[#0A1420] border border-[#294667] border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[180px]"
                    >
                      <MapPin size={24} className="text-[#294667] mb-3" />
                      <p className="text-sm text-[#4a6a85]">Clique em um ponto no mapa para ver os detalhes da estação</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Lista de estações */}
                <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#294667] flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Estações de Monitoramento</span>
                    {!loading && !erro && (
                      <span className="text-[10px] text-[#4a6a85]">Fontes: DCRS / ANA</span>
                    )}
                  </div>

                  {loading ? (
                    <div className="divide-y divide-[#1a2e42]">
                      {[1,2,3,4,5,6,7,8].map(i => (
                        <div key={i} className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-[#1a2e42] animate-pulse" />
                            <div className="space-y-1">
                              <div className="h-2.5 w-24 bg-[#1a2e42] rounded animate-pulse" />
                              <div className="h-2 w-16 bg-[#1a2e42] rounded animate-pulse" />
                            </div>
                          </div>
                          <div className="h-4 w-12 bg-[#1a2e42] rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : erro ? (
                    <div className="px-4 py-6 text-center">
                      <WifiOff size={20} className="text-[#294667] mx-auto mb-2" />
                      <p className="text-xs text-[#4a6a85]">Não foi possível carregar os dados</p>
                      <button
                        onClick={() => fetchEstacoes(true)}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1a2e42]">
                      {estacoes.map((est) => {
                        const cfg = situacaoConfig(est.situacao);
                        return (
                          <div
                            key={est.codAna}
                            className={`w-full flex items-center hover:bg-[#0d1a27] transition-colors ${selected?.codAna === est.codAna ? 'bg-[#0d1a27]' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelected(est)}
                              className="min-w-0 flex-1 flex items-center justify-between px-4 py-3 text-left"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${est.situacao !== 'normal' ? 'animate-pulse' : ''}`} />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-white truncate">{est.nomeExibicao}</div>
                                  <div className="text-[10px] text-[#4a6a85]">{est.rio}</div>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <div className="text-sm font-bold text-white tabular-nums">
                                  {formatNivel(est.nivelM)}<span className="text-[#6b8fad] text-xs font-normal">m</span>
                                </div>
                                <div className={`text-[10px] font-semibold ${cfg.text}`}>{cfg.label}</div>
                              </div>
                            </button>
                            <StationLocationLink lat={est.lat} lng={est.lng} compact className="mr-3 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Áreas de risco — derivadas das estações reais */}
                <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#294667] flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-sm font-semibold text-white">Estações em Atenção / Alerta</span>
                  </div>
                  {loading ? (
                    <div className="divide-y divide-[#1a2e42]">
                      {[1, 2].map(i => (
                        <div key={i} className="px-4 py-3 animate-pulse">
                          <div className="h-3 w-28 bg-[#1a2e42] rounded mb-1.5" />
                          <div className="h-2.5 w-40 bg-[#1a2e42] rounded" />
                        </div>
                      ))}
                    </div>
                  ) : estacoesEmAlerta.length === 0 ? (
                    <div className="px-4 py-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-400">Todas as estações em situação normal</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1a2e42]">
                      {estacoesEmAlerta.map((est) => {
                        const cfg = situacaoConfig(est.situacao);
                        return (
                          <button
                            key={est.codAna}
                            onClick={() => setSelected(est)}
                            className="w-full px-4 py-3 text-left hover:bg-[#0d1a27] transition-colors"
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-semibold text-white">{est.cidade}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6b8fad] leading-relaxed">
                              {est.nomeExibicao} — {formatNivel(est.nivelM)} m
                              {est.cotaAtencao ? ` (atenção: ${est.cotaAtencao.toFixed(1).replace('.', ',')} m)` : ''}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Câmeras ao vivo ───────────────────────────────────────────── */}
        <section className="bg-[#0A1420] border-t border-[#294667] py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-6">
              <Video size={18} className="text-primary" />
              <h2 className="text-lg font-bold text-white">Câmeras ao Vivo</h2>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                <Radio size={9} className="animate-pulse" />
                AO VIVO
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {mapa.cameras.map((cam, i) => (
                <motion.div
                  key={cam.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.1 }}
                  className="bg-[#0d1a27] border border-[#294667] rounded-xl overflow-hidden group"
                >
                  {/* Thumbnail clicável que abre no YouTube */}
                  <a
                    href={`https://www.youtube.com/watch?v=${cam.embedId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative"
                    style={{ paddingBottom: '56.25%' }}
                    aria-label={`Assistir ${cam.titulo} no YouTube`}
                  >
                    {/* Thumbnail do YouTube */}
                    <img
                      src={`https://img.youtube.com/vi/${cam.embedId}/hqdefault.jpg`}
                      alt={cam.titulo}
                      className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                      loading="lazy"
                    />
                    {/* Overlay escuro */}
                    <div className="absolute inset-0 bg-[#0A1420]/50 group-hover:bg-[#0A1420]/30 transition-colors pointer-events-none" />
                    {/* Botão play central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                      <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-1">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <span className="text-white text-xs font-semibold bg-black/50 px-3 py-1 rounded-full">
                        Assistir no YouTube
                      </span>
                    </div>
                    {/* Badge AO VIVO */}
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      AO VIVO
                    </div>
                  </a>
                  <div className="px-4 py-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                    <span className="text-xs font-semibold text-white">{cam.titulo}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="text-xs text-[#4a6a85] mt-4 flex items-start gap-1.5">
              <Info size={12} className="shrink-0 mt-0.5" />
              Clique em cada câmera para assistir a transmissão ao vivo no YouTube. A disponibilidade depende da conexão das câmeras de campo.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
