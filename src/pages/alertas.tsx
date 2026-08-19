import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Bell,
  Clock,
  Waves,
  MapPin,
  Droplets,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
} from 'lucide-react';
import { alertas as alertasContent } from 'virtual:content';
import NotificacaoForm from '@/components/NotificacaoForm';

const SITE = 'https://enchentesvaledocai.com.br';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 min — mesmo ritmo dos níveis na home

// ─── types ──────────────────────────────────────────────────────────────────

type NivelAlerta = 'atencao' | 'alerta' | 'emergencia';

interface AlertaAtivo {
  id: string;
  titulo: string;
  descricao: string;
  nivel: NivelAlerta;
  cidade: string;
  rio: string;
  nivelAgua: string | null;
  cotaReferencia: string | null;
  ativo: boolean;
  criadoEm: string;
  encerradoEm: string | null;
  /** 'estacao' = derivado da leitura em tempo real; 'manual' = aviso cadastrado. */
  origem: 'estacao' | 'manual';
}

interface OcorrenciaDB {
  id: number;
  titulo: string;
  descricao: string;
  nivel: NivelAlerta;
  cidade: string;
  rio: string;
  nivelPico: string | null;
  duracao: string | null;
  inicio: string;
  fim: string | null;
  criadoEm: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

// Fora do render: antes cada chamada remontava o mapa e três elementos React.
const NIVEL_CONFIG = {
  atencao:    { label: 'Atenção',    bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/40',  dot: 'bg-amber-400',  icon: <AlertTriangle size={16} className="text-amber-400" /> },
  alerta:     { label: 'Alerta',     bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/40', dot: 'bg-orange-400', icon: <AlertTriangle size={16} className="text-orange-400" /> },
  emergencia: { label: 'Emergência', bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/40',    dot: 'bg-red-400',    icon: <AlertTriangle size={16} className="text-red-400" /> },
} as const;

function nivelConfig(n: NivelAlerta) {
  return NIVEL_CONFIG[n];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Documento JSON-LD estático: não depende de estado, fica fora do render.
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${SITE}/alertas#webpage`,
  name: 'Alertas e Avisos — Enchentes Vale do Caí',
  url: `${SITE}/alertas`,
  isPartOf: { '@id': `${SITE}/#website` },
  about: { '@id': `${SITE}/#organization` },
});

// ─── component ──────────────────────────────────────────────────────────────

export default function AlertasPage() {
  const [alertasAtivos, setAlertasAtivos] = useState<AlertaAtivo[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaDB[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);
  const [loadingOcorrencias, setLoadingOcorrencias] = useState(true);
  const [expandedOcorrencia, setExpandedOcorrencia] = useState<number | null>(null);

  useEffect(() => {
    // Os alertas vêm das leituras das estações, então precisam ser recarregados
    // no mesmo ritmo do monitoramento — a página costuma ficar aberta.
    const carregarAlertas = () => {
      fetch('/api/alertas')
        .then(r => r.json())
        .then(data => { setAlertasAtivos(data); setLoadingAlertas(false); })
        .catch(() => setLoadingAlertas(false));
    };

    carregarAlertas();
    const timer = setInterval(carregarAlertas, POLL_INTERVAL);

    fetch('/api/ocorrencias')
      .then(r => r.json())
      .then(data => { setOcorrencias(data); setLoadingOcorrencias(false); })
      .catch(() => setLoadingOcorrencias(false));

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Helmet>
        <title>Alertas e Avisos — Enchentes Vale do Caí</title>
        <meta name="description" content="Alertas ativos de enchentes, histórico de ocorrências e cadastro para notificações no Vale do Caí, RS." />
        <link rel="canonical" href={`${SITE}/alertas`} />
        <meta property="og:title" content="Alertas e Avisos — Enchentes Vale do Caí" />
        <meta property="og:description" content="Alertas ativos, histórico de ocorrências e notificações de enchentes no Vale do Caí." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE}/alertas`} />
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
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">Monitoramento</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{alertasContent.hero.titulo}</h1>
            <p className="text-[#8aabcc] text-sm max-w-2xl">{alertasContent.hero.subtitulo}</p>
          </div>
        </section>

        <section className="bg-[#0d1a27] py-10">
          <div className="container mx-auto px-4 flex flex-col gap-8">

            {/* ── Alertas ativos — a seção só aparece quando há alerta ativo ─ */}
            {(loadingAlertas || alertasAtivos.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Bell size={16} className="text-amber-400" />
                  <h2 className="text-lg font-bold text-white">Alertas Ativos</h2>
                  {!loadingAlertas && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-400">
                      {alertasAtivos.length} ativo{alertasAtivos.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {loadingAlertas ? (
                  <div className="flex items-center gap-2 text-[#6b8fad] py-6">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Carregando alertas...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {alertasAtivos.map((alerta, i) => {
                      const cfg = nivelConfig(alerta.nivel);
                      return (
                        <motion.div
                          key={alerta.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className={`${cfg.bg} border ${cfg.border} rounded-xl p-5`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot} animate-pulse`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-xs text-[#6b8fad] flex items-center gap-1">
                                  <MapPin size={10} />
                                  {alerta.cidade} — {alerta.rio}
                                </span>
                              </div>
                              <h3 className={`font-bold text-sm mb-1 ${cfg.text}`}>{alerta.titulo}</h3>
                              <p className="text-[#8aabcc] text-xs leading-relaxed mb-2">{alerta.descricao}</p>
                              <div className="flex flex-wrap gap-4 text-[10px] text-[#4a6a85]">
                                {alerta.nivelAgua && (
                                  <span className="flex items-center gap-1">
                                    <Droplets size={10} />
                                    Nível atual: <span className="font-semibold text-white">{alerta.nivelAgua}m</span>
                                  </span>
                                )}
                                {alerta.cotaReferencia && (
                                  <span>Cota de referência: <span className="font-semibold">{alerta.cotaReferencia}m</span></span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  {formatDateTime(alerta.criadoEm)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Histórico de ocorrências ─────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <History size={16} className="text-primary" />
                <h2 className="text-lg font-bold text-white">Histórico de Ocorrências</h2>
              </div>

              {loadingOcorrencias ? (
                <div className="flex items-center gap-2 text-[#6b8fad] py-6">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Carregando histórico...</span>
                </div>
              ) : (
                <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
                  <div className="divide-y divide-[#1a2e42]">
                    {ocorrencias.map((oc, i) => {
                      const cfg = nivelConfig(oc.nivel);
                      const expanded = expandedOcorrencia === oc.id;
                      return (
                        <motion.div
                          key={oc.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <button
                            onClick={() => setExpandedOcorrencia(expanded ? null : oc.id)}
                            className="w-full px-5 py-4 flex items-start gap-3 hover:bg-[#0d1a27] transition-colors text-left"
                            aria-expanded={expanded}
                          >
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-[10px] text-[#4a6a85] flex items-center gap-1">
                                  <MapPin size={9} />
                                  {oc.cidade}
                                </span>
                                <span className="text-[10px] text-[#4a6a85] flex items-center gap-1">
                                  <Clock size={9} />
                                  {formatDate(oc.inicio)}
                                </span>
                              </div>
                              <div className="text-sm font-semibold text-white">{oc.titulo}</div>
                            </div>
                            <span className="text-[#4a6a85] mt-1 shrink-0">
                              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </span>
                          </button>

                          <AnimatePresence>
                            {expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-5 pb-4 ml-5 border-l border-[#1a2e42]">
                                  <p className="text-xs text-[#8aabcc] leading-relaxed mb-3">{oc.descricao}</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {oc.nivelPico && (
                                      <div className="bg-[#0d1a27] rounded-lg px-3 py-2">
                                        <div className="text-[10px] text-[#4a6a85] mb-0.5">Nível pico</div>
                                        <div className="text-xs font-bold text-white">{oc.nivelPico}</div>
                                      </div>
                                    )}
                                    {oc.duracao && (
                                      <div className="bg-[#0d1a27] rounded-lg px-3 py-2">
                                        <div className="text-[10px] text-[#4a6a85] mb-0.5">Duração</div>
                                        <div className="text-xs font-bold text-white">{oc.duracao}</div>
                                      </div>
                                    )}
                                    <div className="bg-[#0d1a27] rounded-lg px-3 py-2">
                                      <div className="text-[10px] text-[#4a6a85] mb-0.5">Início</div>
                                      <div className="text-xs font-bold text-white">{formatDate(oc.inicio)}</div>
                                    </div>
                                    {oc.fim && (
                                      <div className="bg-[#0d1a27] rounded-lg px-3 py-2">
                                        <div className="text-[10px] text-[#4a6a85] mb-0.5">Encerrado</div>
                                        <div className="text-xs font-bold text-white">{formatDate(oc.fim)}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Cadastro de notificações ─────────────────────────────── */}
            <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#294667] flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                <h2 className="text-sm font-bold text-white">Receber Alertas de Enchentes</h2>
              </div>
              <div className="p-5">
                <NotificacaoForm />
              </div>
            </div>

          </div>
        </section>
      </main>
    </>
  );
}
