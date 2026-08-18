import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CloudRain,
  Cloud,
  Sun,
  Zap,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  Gauge,
  AlertTriangle,
  Clock,
  ExternalLink,
  Waves,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { previsao } from 'virtual:content';
import type { PrevisaoData } from '../server/api/previsao/GET';
import type { AlertaMeteo } from '../server/api/alertas-meteo/GET';
import MapaMeteoro from '../components/MapaMeteoro';

const SITE = 'https://enchentesvaledocai.com.br';
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

// ─── helpers ────────────────────────────────────────────────────────────────

function WeatherIcon({ cond, size = 24 }: { cond: string; size?: number }) {
  const cls = `shrink-0`;
  if (cond === 'chuva_forte')          return <Zap       size={size} className={`${cls} text-amber-400`} />;
  if (cond === 'chuva')                return <CloudRain size={size} className={`${cls} text-primary`} />;
  if (cond === 'chuva_fraca')          return <CloudRain size={size} className={`${cls} text-[#8aabcc]`} />;
  if (cond === 'nublado')              return <Cloud     size={size} className={`${cls} text-[#6b8fad]`} />;
  if (cond === 'parcialmente_nublado') return <Cloud     size={size} className={`${cls} text-[#8aabcc]`} />;
  return <Sun size={size} className={`${cls} text-amber-400`} />;
}

const COND_LABEL: Record<string, string> = {
  chuva_forte: 'Chuva intensa',
  chuva: 'Chuva',
  chuva_fraca: 'Chuva fraca',
  nublado: 'Nublado',
  parcialmente_nublado: 'Parcialmente nublado',
  ensolarado: 'Ensolarado',
};

function condLabel(cond: string) {
  return COND_LABEL[cond] ?? cond;
}

const IMPACTO_CONFIG = {
  alto:     { label: 'Alto',     text: 'text-orange-400',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30' },
  moderado: { label: 'Moderado', text: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30' },
  baixo:    { label: 'Baixo',    text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
} as const;

function impactoConfig(imp: string) {
  if (imp === 'alto')     return IMPACTO_CONFIG.alto;
  if (imp === 'moderado') return IMPACTO_CONFIG.moderado;
  return IMPACTO_CONFIG.baixo;
}

// Skeleton de carregamento
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#1a2e42] rounded ${className ?? ''}`} />;
}

// ─── component ──────────────────────────────────────────────────────────────

// Documento JSON-LD estático: não depende de estado, fica fora do render.
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${SITE}/previsao#webpage`,
  name: 'Previsão de Chuvas — Enchentes Vale do Caí',
  url: `${SITE}/previsao`,
  isPartOf: { '@id': `${SITE}/#website` },
  about: { '@id': `${SITE}/#organization` },
});

export default function PrevisaoPage() {
  const [dados, setDados] = useState<PrevisaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [alertasMeteo, setAlertasMeteo] = useState<AlertaMeteo[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDados = useCallback(async (manual = false) => {
    if (manual) setAtualizando(true);
    setErro(false);
    try {
      const [resPrevisao, resAlertas] = await Promise.all([
        fetch('/api/previsao'),
        fetch('/api/alertas-meteo'),
      ]);
      if (!resPrevisao.ok) throw new Error(`HTTP ${resPrevisao.status}`);
      const jsonPrevisao = await resPrevisao.json() as { ok: boolean; data: PrevisaoData };
      if (jsonPrevisao.ok && jsonPrevisao.data) {
        setDados(jsonPrevisao.data);
      } else {
        throw new Error('Resposta inválida');
      }
      if (resAlertas.ok) {
        const jsonAlertas = await resAlertas.json() as { ok: boolean; data: AlertaMeteo[] };
        if (jsonAlertas.ok) setAlertasMeteo(jsonAlertas.data ?? []);
      }
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void fetchDados();
    timerRef.current = setInterval(() => void fetchDados(), POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchDados]);


  return (
    <>
      <Helmet>
        <title>Previsão de Chuvas — Enchentes Vale do Caí</title>
        <meta name="description" content="Previsão meteorológica detalhada para o Vale do Caí, RS: chuvas, temperatura, impacto nos rios e alertas do INMET." />
        <link rel="canonical" href={`${SITE}/previsao`} />
        <meta property="og:title" content="Previsão de Chuvas — Vale do Caí" />
        <meta property="og:description" content="Previsão de chuvas, temperatura e impacto nos rios para o Vale do Caí, RS." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE}/previsao`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta property="og:image" content={`${SITE}/og-image.svg`} />
        <meta name="twitter:image" content={`${SITE}/og-image.svg`} />
        <script type="application/ld+json">{JSON_LD}</script>
      </Helmet>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="bg-[#0A1420] border-b border-[#294667] py-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Waves size={16} className="text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-widest">Meteorologia</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{previsao.hero.titulo}</h1>
                <p className="text-[#8aabcc] text-sm max-w-2xl">{previsao.hero.subtitulo}</p>
              </div>
              <button
                onClick={() => void fetchDados(true)}
                disabled={atualizando || loading}
                className="flex items-center gap-2 text-xs text-[#4a6a85] hover:text-primary transition-colors disabled:opacity-50 shrink-0"
                title="Atualizar dados"
              >
                <RefreshCw size={14} className={atualizando ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>
          </div>
        </section>

        <section className="bg-[#0d1a27] py-10">
          <div className="container mx-auto px-4 flex flex-col gap-8">

            {/* ── Alertas meteorológicos do INMET (dinâmicos) ──────────── */}
            {alertasMeteo.map((alerta) => {
              const corSev =
                alerta.severidade === 'Extremo'   ? { bg: 'bg-red-500/10',    border: 'border-red-500/40',    text: 'text-red-300',    titulo: 'text-red-300',    badge: 'bg-red-500/20 text-red-400 border-red-500/30' } :
                alerta.severidade === 'Severo'    ? { bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-300', titulo: 'text-orange-300', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' } :
                                                    { bg: 'bg-amber-500/10',  border: 'border-amber-500/40',  text: 'text-amber-300',  titulo: 'text-amber-300',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
              return (
                <motion.div
                  key={alerta.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`${corSev.bg} border ${corSev.border} rounded-xl p-5`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className={`${corSev.titulo} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`font-bold text-sm ${corSev.titulo}`}>
                          {alerta.orgao} — {alerta.tipo}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${corSev.badge}`}>
                          {alerta.severidade}
                        </span>
                      </div>
                      <p className={`text-sm mb-3 ${corSev.text}`}>{alerta.descricao}</p>
                      <div className={`flex flex-wrap gap-4 text-xs mb-3 opacity-80 ${corSev.text}`}>
                        <span className="flex items-center gap-1"><Clock size={11} /> Início: {alerta.inicio}</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> Fim: {alerta.fim}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {alerta.recomendacoes.map((r, i) => (
                          <div key={i} className={`flex items-start gap-2 text-xs ${corSev.text} opacity-90`}>
                            <span className={`${corSev.titulo} mt-0.5`}>•</span>
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* ── Estado de erro ───────────────────────────────────────── */}
            {erro && !dados && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">Não foi possível carregar os dados meteorológicos.</p>
                </div>
                <button
                  onClick={() => void fetchDados(true)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-3 py-1.5 transition-colors shrink-0"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {/* ── Condições atuais + acumulado ─────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Condições atuais */}
              <div className="bg-[#0A1420] border border-[#294667] rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-white">Condições Atuais</h2>
                  <span className="text-[10px] text-[#4a6a85] flex items-center gap-1">
                    <Clock size={10} />
                    {loading ? '—' : (dados?.atualizadoEm ?? '—')}
                  </span>
                </div>

                {loading ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <div className="flex flex-col gap-2">
                        <Skeleton className="w-24 h-10" />
                        <Skeleton className="w-32 h-4" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[0,1,2,3].map(i => <Skeleton key={i} className="h-12" />)}
                    </div>
                  </div>
                ) : dados ? (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <WeatherIcon cond={dados.previsaoHoraria[0]?.condicao ?? 'ensolarado'} size={48} />
                      <div>
                        <div className="text-5xl font-bold text-white tabular-nums">
                          {dados.temperaturaAtual}<span className="text-2xl text-[#6b8fad]">°C</span>
                        </div>
                        <div className="text-sm text-[#8aabcc] mt-1">{dados.condicaoAtual}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <Droplets size={14} className="text-primary" />, label: 'Umidade', value: `${dados.umidade}%` },
                        { icon: <Wind size={14} className="text-[#8aabcc]" />, label: 'Vento', value: `${dados.vento} km/h ${dados.direcaoVento}` },
                        { icon: <Gauge size={14} className="text-[#8aabcc]" />, label: 'Pressão', value: `${dados.pressao} hPa` },
                        { icon: <Eye size={14} className="text-[#8aabcc]" />, label: 'Visibilidade', value: `${dados.visibilidade} km` },
                      ].map((item, i) => (
                        <div key={i} className="bg-[#0d1a27] rounded-lg px-3 py-2.5 flex items-center gap-2">
                          {item.icon}
                          <div>
                            <div className="text-[10px] text-[#4a6a85]">{item.label}</div>
                            <div className="text-xs font-semibold text-white">{item.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              {/* Acumulado de chuvas */}
              <div className="bg-[#0A1420] border border-[#294667] rounded-xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp size={15} className="text-primary" />
                  <h2 className="text-sm font-semibold text-white">Acumulado de Chuvas</h2>
                </div>

                {loading ? (
                  <div className="flex flex-col gap-4">
                    {[0,1,2].map(i => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex justify-between">
                          <Skeleton className="w-20 h-3" />
                          <Skeleton className="w-16 h-3" />
                        </div>
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : dados ? (
                  <div className="flex flex-col gap-4">
                    {[
                      { periodo: 'Últimas 24h', valor: dados.acumulado24h, referencia: 20, refLabel: 'ref. 20mm' },
                      { periodo: 'Últimas 48h', valor: dados.acumulado48h, referencia: 40, refLabel: 'ref. 40mm' },
                      { periodo: '7 dias',      valor: dados.acumulado7d,  referencia: 80, refLabel: 'ref. 80mm' },
                    ].map((ac, i) => {
                      const pct = Math.min(100, Math.round((ac.valor / (ac.referencia * 1.5)) * 100));
                      const acima = ac.valor > ac.referencia;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-[#8aabcc]">{ac.periodo}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white tabular-nums">
                                {ac.valor}<span className="text-xs text-[#6b8fad] font-normal">mm</span>
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${acima ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                {ac.refLabel}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-[#1a2e42] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' as const }}
                              className={`h-full rounded-full ${acima ? 'bg-amber-400' : 'bg-primary'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <p className="text-[11px] text-[#4a6a85] mt-5 leading-relaxed">
                  Dados de precipitação para São Sebastião do Caí (−29.58°, −51.37°). Valores de referência baseados na média histórica do período.
                </p>
              </div>
            </div>

            {/* ── Previsão horária ─────────────────────────────────────── */}
            <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#294667]">
                <h2 className="text-sm font-semibold text-white">Próximas Horas</h2>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex gap-0 min-w-max px-2 py-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center px-5 py-2 gap-2 min-w-[80px]">
                        <Skeleton className="w-8 h-3" />
                        <Skeleton className="w-5 h-5 rounded-full" />
                        <Skeleton className="w-8 h-4" />
                        <Skeleton className="w-10 h-3" />
                      </div>
                    ))}
                  </div>
                ) : dados ? (
                  <div className="flex gap-0 min-w-max">
                    {dados.previsaoHoraria.map((h, i) => {
                      const prob = h.prob;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.05 }}
                          className="flex flex-col items-center px-5 py-4 border-r border-[#1a2e42] last:border-r-0 min-w-[80px]"
                        >
                          <span className="text-xs text-[#6b8fad] mb-3">{h.hora}</span>
                          <WeatherIcon cond={h.condicao} size={20} />
                          <span className="text-sm font-bold text-white mt-2">{h.temp}°</span>
                          <div className="mt-2 flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-primary font-semibold">{h.chuva_mm}mm</span>
                            <div className="flex items-center gap-0.5">
                              <Droplets size={9} className={prob > 50 ? 'text-primary' : 'text-[#4a6a85]'} />
                              <span className={`text-[10px] ${prob > 50 ? 'text-primary' : 'text-[#4a6a85]'}`}>{prob}%</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Mapas meteorológicos ─────────────────────────────────── */}
            <MapaMeteoro />

            {/* ── Previsão 7 dias ──────────────────────────────────────── */}
            <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#294667]">
                <h2 className="text-sm font-semibold text-white">Previsão para 7 Dias</h2>
              </div>
              <div className="divide-y divide-[#1a2e42]">
                {loading
                  ? Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="px-5 py-4 flex items-center gap-4">
                      <Skeleton className="w-16 h-8" />
                      <Skeleton className="w-6 h-6 rounded-full hidden md:block" />
                      <Skeleton className="flex-1 h-4" />
                      <Skeleton className="w-16 h-6 hidden md:block" />
                    </div>
                  ))
                  : dados
                  ? dados.previsaoDiaria.map((dia, i) => {
                    const imp = impactoConfig(dia.impactoRios);
                    const prob = dia.prob;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.06 }}
                        className="px-5 py-4"
                      >
                        <div className="grid grid-cols-[80px_1fr_auto] md:grid-cols-[100px_40px_1fr_120px_80px_80px] items-center gap-3 md:gap-4">
                          {/* Dia */}
                          <div>
                            <div className="text-sm font-bold text-white">{dia.dia}</div>
                            <div className="text-[10px] text-[#4a6a85]">{dia.data}</div>
                          </div>

                          {/* Ícone */}
                          <div className="hidden md:flex justify-center">
                            <WeatherIcon cond={dia.condicao} size={22} />
                          </div>

                          {/* Descrição */}
                          <div>
                            <div className="text-xs text-[#8aabcc] hidden md:block mb-0.5">{condLabel(dia.condicao)}</div>
                            <p className="text-xs text-[#6b8fad] leading-relaxed">{dia.descricao}</p>
                          </div>

                          {/* Chuva */}
                          <div className="hidden md:flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              <CloudRain size={12} className="text-primary" />
                              <span className="text-sm font-bold text-white tabular-nums">{dia.chuva_mm}<span className="text-xs text-[#6b8fad] font-normal">mm</span></span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Droplets size={10} className="text-[#4a6a85]" />
                              <span className="text-[10px] text-[#6b8fad]">{prob}%</span>
                            </div>
                          </div>

                          {/* Temp */}
                          <div className="hidden md:flex items-center gap-1.5 justify-end">
                            <Thermometer size={12} className="text-[#8aabcc]" />
                            <span className="text-xs font-bold text-white">{dia.tempMax}°</span>
                            <span className="text-xs text-[#4a6a85]">{dia.tempMin}°</span>
                          </div>

                          {/* Impacto */}
                          <div className="flex justify-end">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${imp.bg} ${imp.text} ${imp.border} whitespace-nowrap`}>
                              {imp.label}
                            </span>
                          </div>
                        </div>

                        {/* Barra de probabilidade */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[10px] text-[#4a6a85] w-16 shrink-0">Prob. chuva</span>
                          <div className="flex-1 h-1.5 bg-[#1a2e42] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${prob}%` }}
                              transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' as const }}
                              className={`h-full rounded-full ${prob >= 70 ? 'bg-amber-400' : prob >= 40 ? 'bg-primary' : 'bg-emerald-400'}`}
                            />
                          </div>
                          <span className="text-[10px] text-[#6b8fad] w-8 text-right">{prob}%</span>
                        </div>
                      </motion.div>
                    );
                  })
                  : null}
              </div>

              {/* Legenda impacto */}
              <div className="px-5 py-3 border-t border-[#1a2e42] bg-[#0d1a27] flex flex-wrap gap-4">
                <span className="text-[10px] text-[#4a6a85] font-semibold">Impacto nos rios:</span>
                {[
                  { label: 'Baixo', cls: 'text-emerald-400' },
                  { label: 'Moderado', cls: 'text-amber-400' },
                  { label: 'Alto', cls: 'text-orange-400' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${item.cls.replace('text-', 'bg-')}`} />
                    <span className={`text-[10px] ${item.cls}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Fontes de dados ──────────────────────────────────────── */}
            <div className="bg-[#0A1420] border border-[#294667] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Fontes de Dados</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {previsao.fontes.map((fonte) => (
                  <a
                    key={fonte.id}
                    href={fonte.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 bg-[#0d1a27] border border-[#294667] rounded-lg px-4 py-3 hover:border-primary/40 transition-colors group"
                  >
                    <ExternalLink size={14} className="text-[#4a6a85] group-hover:text-primary transition-colors mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-primary transition-colors">{fonte.nome}</div>
                      <div className="text-[10px] text-[#4a6a85] mt-0.5">{fonte.descricao}</div>
                    </div>
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-[#4a6a85] mt-4 leading-relaxed">
                Dados meteorológicos fornecidos em tempo real pela API Open-Meteo (gratuita, sem chave). Atualização automática a cada 30 minutos. Coordenadas: São Sebastião do Caí, RS (−29.58°, −51.37°).
              </p>
            </div>

          </div>
        </section>
      </main>
    </>
  );
}
