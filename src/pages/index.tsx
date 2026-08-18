import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { useState, useEffect, useCallback } from 'react';
import {
  Waves,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Bell,
  CloudRain,
  Cloud,
  Sun,
  Zap,
  MapPin,
  Clock,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { home } from 'virtual:content';
import NotificacaoForm from '@/components/NotificacaoForm';
import StationLocationLink from '@/components/StationLocationLink';

// ─── tipos ──────────────────────────────────────────────────────────────────

const SITE = 'https://enchentesvaledocai.com.br';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 min — níveis e alertas
const POLL_PREVISAO_INTERVAL = 30 * 60 * 1000; // 30 min — previsão (cache de 1h no servidor)

type Situacao = 'normal' | 'atencao' | 'alerta' | 'emergencia';

interface EstacaoAPI {
  codAna: string;
  nomeExibicao: string;
  rio: string;
  cidade: string;
  lat: string | null;
  lng: string | null;
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

// ─── helpers ────────────────────────────────────────────────────────────────

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
  normal:     { label: 'Normal',     bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  atencao:    { label: 'Atenção',    bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  alerta:     { label: 'Alerta',     bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30',  dot: 'bg-orange-400' },
  emergencia: { label: 'Emergência', bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30',     dot: 'bg-red-400' },
} as const;

function situacaoConfig(s: Situacao) {
  return SITUACAO_CONFIG[s] ?? SITUACAO_CONFIG.normal;
}

function calcularSituacaoBacia(estacoes: EstacaoAPI[]): Situacao {
  if (estacoes.some(e => e.situacao === 'emergencia')) return 'emergencia';
  if (estacoes.some(e => e.situacao === 'alerta'))     return 'alerta';
  if (estacoes.some(e => e.situacao === 'atencao'))    return 'atencao';
  return 'normal';
}

function contarLocaisNaSituacao(estacoes: EstacaoAPI[], s: Situacao): number {
  return estacoes.filter(e => e.situacao === s).length;
}

const BANNER_CONFIG = {
  normal:     { bg: 'bg-emerald-600', text: 'text-white', icon: '✓',  label: 'NORMAL',     mensagem: 'Todos os rios dentro dos limites normais' },
  atencao:    { bg: 'bg-amber-500',   text: 'text-white', icon: '⚠',  label: 'ATENÇÃO',    mensagem: 'Monitoramento intensificado em algumas estações' },
  alerta:     { bg: 'bg-orange-600',  text: 'text-white', icon: '⚠',  label: 'ALERTA',     mensagem: 'Nível elevado — siga as orientações da Defesa Civil' },
  emergencia: { bg: 'bg-red-600',     text: 'text-white', icon: '🚨', label: 'EMERGÊNCIA', mensagem: 'Situação crítica — evacue áreas de risco imediatamente' },
} as const;

function bannerFromSituacao(s: Situacao, count: number) {
  const prefixo = s === 'normal'
    ? 'Todos os rios dentro dos limites normais'
    : `Pelo menos ${count} ${count === 1 ? 'local' : 'locais'} em ${
        s === 'atencao' ? 'atenção' : s === 'alerta' ? 'alerta' : 'emergência'
      }`;
  return { ...BANNER_CONFIG[s], prefixo };
}

function formatNivel(nivelM: number | null): string {
  if (nivelM === null) return '—';
  return nivelM.toFixed(2).replace('.', ',');
}

function formatCota(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(1).replace('.', ',');
}

function formatHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

// ─── tipos alertas ──────────────────────────────────────────────────────────

interface AlertaAPI {
  id: number;
  titulo: string;
  descricao: string;
  nivel: string;
  cidade: string;
  rio: string;
  nivelAgua: string | null;
  cotaReferencia: string | null;
  ativo: boolean;
  criadoEm: string;
}

const NIVEL_ALERTA_CONFIG = {
  emergencia: { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-300',    icon: 'text-red-400' },
  alerta:     { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-300', icon: 'text-orange-400' },
  atencao:    { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-300',  icon: 'text-amber-400' },
  padrao:     { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-300',   icon: 'text-blue-400' },
} as const;

function nivelAlertaConfig(nivel: string) {
  if (nivel === 'emergencia') return NIVEL_ALERTA_CONFIG.emergencia;
  if (nivel === 'alerta')     return NIVEL_ALERTA_CONFIG.alerta;
  if (nivel === 'atencao')    return NIVEL_ALERTA_CONFIG.atencao;
  return NIVEL_ALERTA_CONFIG.padrao;
}

// Documento JSON-LD estático: não depende de estado, fica fora do render.
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'Enchentes Vale do Caí', url: `${SITE}/` },
    { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Enchentes Vale do Caí', url: `${SITE}/` },
    {
      '@type': 'WebPage',
      '@id': `${SITE}/#webpage`,
      url: `${SITE}/`,
      name: 'Enchentes Vale do Caí — Monitoramento dos Rios',
      isPartOf: { '@id': `${SITE}/#website` },
      about: { '@id': `${SITE}/#organization` },
      datePublished: '2026-07-30',
      dateModified: '2026-07-30',
    },
  ],
});

// ─── component ──────────────────────────────────────────────────────────────

export default function HomePage() {
  const [estacoes, setEstacoes] = useState<EstacaoAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const [alertas, setAlertas] = useState<AlertaAPI[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);

  // previsão em tempo real
  interface DiaPrevisao {
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
  const [previsao, setPrevisao] = useState<DiaPrevisao[]>([]);
  const [loadingPrevisao, setLoadingPrevisao] = useState(true);

  const fetchEstacoes = useCallback(async (manual = false) => {
    if (manual) setAtualizando(true);
    try {
      const res = await fetch('/api/estacoes');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setEstacoes(ordenarEstacoes(data.estacoes ?? []));
      setAtualizadoEm(data.atualizadoEm ?? null);
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  }, []);

  const fetchAlertas = useCallback(async () => {
    try {
      const res = await fetch('/api/alertas');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json() as AlertaAPI[];
      setAlertas(data.filter(a => a.ativo));
    } catch {
      // silencioso — mantém lista vazia
    } finally {
      setLoadingAlertas(false);
    }
  }, []);

  const fetchPrevisao = useCallback(async () => {
    try {
      const res = await fetch('/api/previsao');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json() as { ok: boolean; data: { previsaoDiaria: DiaPrevisao[] } };
      if (json.ok) setPrevisao(json.data.previsaoDiaria.slice(0, 3));
    } catch {
      // silencioso — mantém dados vazios
    } finally {
      setLoadingPrevisao(false);
    }
  }, []);

  useEffect(() => {
    void fetchEstacoes();
    void fetchAlertas();
    void fetchPrevisao();
    const timerRios = setInterval(() => { void fetchEstacoes(); void fetchAlertas(); }, POLL_INTERVAL);
    // A previsão é servida de um cache de 1 hora no servidor; repetir a cada
    // 5 min só gera requisições que devolvem exatamente a mesma resposta.
    const timerPrevisao = setInterval(() => { void fetchPrevisao(); }, POLL_PREVISAO_INTERVAL);
    return () => {
      clearInterval(timerRios);
      clearInterval(timerPrevisao);
    };
  }, [fetchEstacoes, fetchAlertas, fetchPrevisao]);

  const situacaoBacia = loading || erro ? 'normal' : calcularSituacaoBacia(estacoes);
  const countCriticos = loading || erro ? 0 : contarLocaisNaSituacao(estacoes, situacaoBacia);
  const banner = bannerFromSituacao(situacaoBacia, countCriticos);

  return (
    <>
      <Helmet>
        <title>Enchentes Vale do Caí — Monitoramento dos Rios e Alertas</title>
        <meta name="description" content="Acompanhe em tempo real os níveis dos rios da bacia do Caí, alertas de enchentes e previsão de chuvas para o Vale do Caí, RS." />
        <link rel="canonical" href={SITE} />
        <meta property="og:title" content="Enchentes Vale do Caí — Monitoramento dos Rios" />
        <meta property="og:description" content="Níveis dos rios, alertas de enchentes e previsão de chuvas para o Vale do Caí, RS." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta property="og:image" content={`${SITE}/og-image.svg`} />
        <meta name="twitter:image" content={`${SITE}/og-image.svg`} />
        <script type="application/ld+json">{JSON_LD}</script>
      </Helmet>

      <main>
        {/* ── Status Banner ─────────────────────────────────────────────── */}
        <div className={`${banner.bg} ${banner.text} py-2 px-4`}>
          <div className="container mx-auto flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>{banner.icon}</span>
              <span>Situação da bacia:</span>
              <span className="font-bold uppercase tracking-wide">{banner.label}</span>
              <span className="hidden sm:inline font-normal opacity-90">— {banner.prefixo}{situacaoBacia !== 'normal' ? ` — ${banner.mensagem}` : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="flex items-center gap-1 text-xs opacity-70">
                  <RefreshCw size={10} className="animate-spin" />
                  Carregando...
                </span>
              ) : erro ? (
                <span className="flex items-center gap-1 text-xs opacity-70">
                  <WifiOff size={10} />
                  Sem conexão
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs opacity-80">
                  <Clock size={10} />
                  Atualizado: {formatHora(atualizadoEm)}
                </span>
              )}
              <button
                onClick={() => fetchEstacoes(true)}
                disabled={atualizando || loading}
                className="opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
                aria-label="Atualizar dados"
                title="Atualizar dados"
              >
                <RefreshCw size={12} className={atualizando ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#0A1420] min-h-[420px] flex items-center">
          <div className="absolute inset-0 pointer-events-none">
            <img
              src="/assets/media/hero.jpg"
              alt=""
              className="w-full h-full object-cover opacity-20"
              loading="eager"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0A1420]/60 via-[#0A1420]/40 to-[#0A1420]" />
          </div>
          <div className="absolute inset-0 pointer-events-none opacity-5"
            style={{
              backgroundImage: 'linear-gradient(#4A90D9 1px, transparent 1px), linear-gradient(90deg, #4A90D9 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
          <div className="relative container mx-auto px-4 py-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' as const }}
              className="max-w-2xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <Waves size={18} className="text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">Sistema de Monitoramento</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
                {home.hero.titulo}
              </h1>
              <p className="text-[#8aabcc] text-base md:text-lg leading-relaxed mb-8 max-w-xl">
                {home.hero.subtitulo}
              </p>
              <a
                href={home.hero.ctaHref}
                className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-md hover:bg-primary/90 transition-colors text-sm"
              >
                {home.hero.ctaLabel}
                <ChevronRight size={16} />
              </a>
            </motion.div>
          </div>
        </section>

        {/* ── Rios — dados reais da ANA ─────────────────────────────────── */}
        <section id="rios" className="py-14 bg-[#0d1a27]">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Status dos Rios</h2>
                {loading ? (
                  <p className="text-xs text-[#6b8fad] mt-1 flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" />
                    Buscando dados da ANA...
                  </p>
                ) : erro ? (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <WifiOff size={10} />
                    Falha ao carregar — usando último cache disponível
                  </p>
                ) : (
                  <p className="text-xs text-[#6b8fad] mt-1 flex items-center gap-1">
                    <Wifi size={10} className="text-emerald-400" />
                    <span className="text-emerald-400">Dados em tempo real</span>
                    <span className="ml-1">— Fonte: ANA HidroWeb</span>
                  </p>
                )}
              </div>
              <span className="text-xs bg-[#1E3A5F] text-[#8aabcc] px-3 py-1 rounded-full border border-[#294667]">
                {loading ? '...' : estacoes.length} estações monitoradas
              </span>
            </div>

            {/* Skeleton de carregamento */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} className="bg-[#0A1420] border border-[#1a2e42] rounded-lg p-5 animate-pulse">
                    <div className="flex justify-between mb-4">
                      <div className="space-y-2">
                        <div className="h-2.5 w-16 bg-[#1a2e42] rounded" />
                        <div className="h-4 w-28 bg-[#1a2e42] rounded" />
                      </div>
                      <div className="h-6 w-16 bg-[#1a2e42] rounded-full" />
                    </div>
                    <div className="h-10 w-24 bg-[#1a2e42] rounded mb-4" />
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1a2e42]">
                      {[1,2,3].map(j => <div key={j} className="h-8 bg-[#1a2e42] rounded" />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cards das estações */}
            {!loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {estacoes.map((est, i) => {
                  const cfg = situacaoConfig(est.situacao);
                  return (
                    <motion.div
                      key={est.codAna}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.05, ease: 'easeOut' as const }}
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      className={`bg-[#0A1420] border ${cfg.border} rounded-lg p-5 cursor-default`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-1.5 text-[#6b8fad] text-xs mb-1">
                            <MapPin size={11} />
                            <span>{est.cidade}</span>
                          </div>
                          <h3 className="font-bold text-white text-base">{est.nomeExibicao}</h3>
                          <div className="text-[10px] text-[#4a6a85] mt-0.5">{est.rio}</div>
                        </div>
                        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text} shrink-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${est.situacao !== 'normal' ? 'animate-pulse' : ''}`} />
                          {cfg.label}
                        </span>
                      </div>

                      {/* Nível */}
                      <div className="flex items-end gap-3 mb-4">
                        <div>
                          <span className="text-4xl font-bold text-white tabular-nums">{formatNivel(est.nivelM)}</span>
                          <span className="text-[#6b8fad] text-sm ml-1">m</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1.5 text-xs">
                          {est.tendencia === 'subindo'  && <TrendingUp  size={14} className="text-amber-400" />}
                          {est.tendencia === 'descendo' && <TrendingDown size={14} className="text-emerald-400" />}
                          {est.tendencia === 'estavel'  && <Minus size={14} className="text-[#6b8fad]" />}
                          {est.tendencia === 'subindo'  && <span className="text-amber-400">Subindo</span>}
                          {est.tendencia === 'descendo' && <span className="text-emerald-400">Descendo</span>}
                          {est.tendencia === 'estavel'  && <span className="text-[#6b8fad]">Estável</span>}
                        </div>
                      </div>

                      {/* Cotas de referência */}
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1a2e42]">
                        <div className="text-center">
                          <div className="text-[10px] text-[#4a6a85] mb-0.5">Atenção</div>
                          <div className="text-xs font-semibold text-amber-400">{formatCota(est.cotaAtencao)}m</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-[#4a6a85] mb-0.5">Alerta</div>
                          <div className="text-xs font-semibold text-orange-400">{formatCota(est.cotaAlerta)}m</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-[#4a6a85] mb-0.5">Emergência</div>
                          <div className="text-xs font-semibold text-red-400">{formatCota(est.cotaEmergencia)}m</div>
                        </div>
                      </div>

                      {/* Última leitura + localização */}
                      <div className="mt-3 flex items-center justify-between gap-2 min-h-6">
                        {est.dataHora ? (
                          <div className="flex items-center gap-1 text-[10px] text-[#3a5a75]">
                            <Clock size={9} />
                            <span>Leitura: {formatHora(est.dataHora)}</span>
                          </div>
                        ) : (
                          <span />
                        )}
                        <StationLocationLink lat={est.lat} lng={est.lng} compact />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Estado de erro */}
            {erro && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <WifiOff size={28} className="text-[#294667] mb-3" />
                <p className="text-sm text-[#4a6a85] mb-3">Não foi possível carregar os dados das estações</p>
                <button
                  onClick={() => fetchEstacoes(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={11} />
                  Tentar novamente
                </button>
              </div>
            )}
          </div>

          {/* ── Atalho para o Mapa da Bacia ───────────────────────────────── */}
          <div className="container mx-auto px-4 mt-8">
            <a
              href="/mapa"
              className="flex items-center justify-between w-full bg-[#0d1a27] border border-[#294667] hover:border-primary/60 hover:bg-[#0f1f30] transition-colors rounded-xl px-5 py-4 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <MapPin size={16} className="text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Mapa da Bacia</div>
                  <div className="text-xs text-[#6b8fad]">Visualize todas as estações no mapa interativo</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#4a6a85] group-hover:text-primary transition-colors shrink-0" />
            </a>
          </div>
        </section>

        {/* ── Alertas — dados reais da API ──────────────────────────────── */}
        <section id="alertas" className="py-14 bg-[#0A1420]">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                <h2 className="text-xl font-bold text-white">Alertas Ativos</h2>
                {!loadingAlertas && alertas.length > 0 && (
                  <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">
                    {alertas.length}
                  </span>
                )}
              </div>
              <a
                href="/alertas"
                className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                Ver todos os alertas
                <ChevronRight size={12} />
              </a>
            </div>

            {/* Skeleton */}
            {loadingAlertas && (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="bg-[#0d1a27] border border-[#1a2e42] rounded-lg p-4 animate-pulse h-16" />
                ))}
              </div>
            )}

            {/* Alertas reais */}
            {!loadingAlertas && alertas.length > 0 && (
              <div className="space-y-3">
                {alertas.map((alerta) => {
                  const cfg = nivelAlertaConfig(alerta.nivel);
                  return (
                    <motion.div
                      key={alerta.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35 }}
                      className={`${cfg.bg} border ${cfg.border} rounded-lg p-4 flex items-start gap-3`}
                    >
                      <AlertTriangle size={18} className={`${cfg.icon} mt-0.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold ${cfg.text} text-sm`}>{alerta.titulo}</div>
                        <div className="text-[#8aabcc] text-xs mt-1 leading-relaxed">{alerta.descricao}</div>
                        <div className="text-[#4a6a85] text-xs mt-2 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin size={9} />
                            {alerta.cidade}
                          </span>
                          {alerta.nivelAgua && (
                            <span className="flex items-center gap-1">
                              <Waves size={9} />
                              Nível: {alerta.nivelAgua}m
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={9} />
                            {new Date(alerta.criadoEm).toLocaleString('pt-BR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                              timeZone: 'America/Sao_Paulo',
                            })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Sem alertas */}
            {!loadingAlertas && alertas.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5"
              >
                <CheckCircle size={20} className="text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-emerald-300 text-sm">Nenhum alerta ativo no momento</div>
                  <div className="text-[#6b8fad] text-xs mt-1">Todos os rios monitorados estão dentro dos limites normais.</div>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* ── Previsão de Chuvas — dados reais Open-Meteo ───────────────── */}
        <section id="previsao" className="py-14 bg-[#0d1a27]">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CloudRain size={18} className="text-primary" />
                <div>
                  <h2 className="text-xl font-bold text-white">Previsão de Chuvas</h2>
                  <p className="text-xs text-[#6b8fad] mt-0.5">
                    {loadingPrevisao ? 'Carregando...' : 'Próximos 3 dias — Fonte: Open-Meteo'}
                  </p>
                </div>
              </div>
              <a
                href="/previsao"
                className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                Previsão completa (7 dias)
                <ChevronRight size={12} />
              </a>
            </div>

            {/* Skeleton */}
            {loadingPrevisao && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-[#0A1420] border border-[#1a2e42] rounded-lg p-5 animate-pulse h-36" />
                ))}
              </div>
            )}

            {/* Cards reais */}
            {!loadingPrevisao && previsao.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {previsao.map((dia, i) => {
                  const impactoCor =
                    dia.impactoRios === 'alto'     ? 'text-orange-400' :
                    dia.impactoRios === 'moderado' ? 'text-amber-400'  : 'text-emerald-400';
                  const impactoLabel =
                    dia.impactoRios === 'alto'     ? 'Alto'     :
                    dia.impactoRios === 'moderado' ? 'Moderado' : 'Baixo';
                  return (
                    <motion.div
                      key={`${dia.data}-${i}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.08, ease: 'easeOut' as const }}
                      className="bg-[#0A1420] border border-[#294667] rounded-lg p-5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="font-bold text-white text-base">{dia.dia}</div>
                          <div className="text-xs text-[#6b8fad]">{dia.data}</div>
                        </div>
                        <span>
                          {dia.condicao === 'chuva_forte'          && <Zap       size={28} className="text-amber-400" />}
                          {dia.condicao === 'chuva'                && <CloudRain size={28} className="text-primary" />}
                          {dia.condicao === 'chuva_fraca'          && <CloudRain size={28} className="text-primary/70" />}
                          {dia.condicao === 'parcialmente_nublado' && <Cloud     size={28} className="text-[#8aabcc]" />}
                          {dia.condicao === 'nublado'              && <Cloud     size={28} className="text-[#6b8fad]" />}
                          {dia.condicao === 'ensolarado'           && <Sun       size={28} className="text-amber-400" />}
                        </span>
                      </div>

                      {/* Chuva acumulada */}
                      <div className="flex items-end gap-1 mb-1">
                        <span className="text-3xl font-bold text-white tabular-nums">{dia.chuva_mm}</span>
                        <span className="text-[#6b8fad] text-sm mb-1">mm</span>
                        {dia.prob > 0 && (
                          <span className="text-xs text-[#4a6a85] mb-1 ml-1">{dia.prob}% prob.</span>
                        )}
                      </div>

                      {/* Temperatura */}
                      <div className="flex items-center gap-2 mb-3 text-xs text-[#6b8fad]">
                        <span className="text-white font-semibold">{dia.tempMax}°</span>
                        <span>/</span>
                        <span>{dia.tempMin}°</span>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#1a2e42]">
                        <span className="text-xs text-[#6b8fad]">Impacto nos rios:</span>
                        <span className={`text-xs font-semibold ${impactoCor}`}>{impactoLabel}</span>
                      </div>

                      <p className="text-xs text-[#4a6a85] mt-2 leading-relaxed">{dia.descricao}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Fallback vazio */}
            {!loadingPrevisao && previsao.length === 0 && (
              <div className="flex items-center justify-center py-10 text-[#4a6a85] text-sm">
                Previsão temporariamente indisponível.
              </div>
            )}
          </div>
        </section>

        {/* ── Cadastro de alertas ───────────────────────────────────────── */}
        <section id="cadastro-alertas" className="py-16 bg-[#0A1420] border-t border-[#294667]">
          <div className="container mx-auto px-4">
            <div className="max-w-lg mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: 'easeOut' as const }}
                className="text-center mb-8"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <Bell size={22} className="text-primary" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{home.cta.titulo}</h2>
                <p className="text-[#8aabcc] text-sm leading-relaxed">{home.cta.descricao}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' as const }}
                className="bg-[#0d1a27] border border-[#294667] rounded-xl p-6"
              >
                <NotificacaoForm />
              </motion.div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
