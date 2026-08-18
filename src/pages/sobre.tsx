import { Helmet } from '@dr.pogodin/react-helmet';
import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Waves,
  Target,
  Map,
  Database,
  Code2,
  Mail,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Send,
} from 'lucide-react';
import { sobre } from 'virtual:content';

const SITE = 'https://enchentesvaledocai.com.br';

const tipoColor: Record<string, string> = {
  Hidrologia:   'bg-primary/15 text-primary border-primary/30',
  Meteorologia: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Previsão:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Emergências:  'bg-red-500/15 text-red-400 border-red-500/30',
};

const regiaoColor: Record<string, string> = {
  Nascentes:  'text-emerald-400',
  'Alto Caí': 'text-primary',
  'Médio Caí':'text-primary',
  'Rio Fão':  'text-[#8aabcc]',
  'Baixo Caí':'text-amber-400',
  Foz:        'text-[#6b8fad]',
};

// Documento JSON-LD estático: não depende de estado, fica fora do render.
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${SITE}/sobre#webpage`,
  name: 'Sobre o Serviço — Enchentes Vale do Caí',
  url: `${SITE}/sobre`,
  isPartOf: { '@id': `${SITE}/#website` },
  about: { '@id': `${SITE}/#organization` },
});

export default function SobrePage() {
  const [email, setEmail] = useState('');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const honeypotRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (honeypotRef.current?.value) {
      setSucesso(true);
      return;
    }

    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado || !assunto.trim() || !mensagem.trim()) {
      setErro('Por favor, preencha e-mail, assunto e mensagem.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      setErro('Informe um endereço de e-mail válido.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/contact/sobre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { email: emailNormalizado },
          conversation: {
            data: { Assunto: assunto.trim() },
            messages_attributes: [{ body: mensagem.trim() }],
          },
        }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Erro ao enviar a mensagem.');
      setSucesso(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  function resetForm() {
    setEmail('');
    setAssunto('');
    setMensagem('');
    setErro('');
    setSucesso(false);
  }


  return (
    <>
      <Helmet>
        <title>Sobre o Serviço — Enchentes Vale do Caí</title>
        <meta name="description" content="Conheça o projeto Enchentes Vale do Caí: missão, cobertura da bacia hidrográfica, fontes de dados oficiais e contato." />
        <link rel="canonical" href={`${SITE}/sobre`} />
        <meta property="og:title" content="Sobre o Serviço — Enchentes Vale do Caí" />
        <meta property="og:description" content="Missão, cobertura, fontes de dados e contato do serviço de monitoramento do Rio Caí." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE}/sobre`} />
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
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">Projeto</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{sobre.hero.titulo}</h1>
            <p className="text-[#8aabcc] text-sm max-w-2xl">{sobre.hero.subtitulo}</p>
          </div>
        </section>

        <section className="bg-[#0d1a27] py-10">
          <div className="container mx-auto px-4 flex flex-col gap-10">

            {/* ── Missão ───────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-[#0A1420] border border-[#294667] rounded-xl p-6 md:p-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-white">{sobre.missao.titulo}</h2>
              </div>
              <p className="text-[#8aabcc] text-sm leading-relaxed mb-8 max-w-3xl">
                {sobre.missao.texto}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sobre.missao.valores.map((v, i) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    className="bg-[#0d1a27] border border-[#294667] rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={14} className="text-primary shrink-0" />
                      <span className="text-sm font-bold text-white">{v.titulo}</span>
                    </div>
                    <p className="text-xs text-[#6b8fad] leading-relaxed">{v.descricao}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* ── Cobertura ────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-[#0A1420] border border-[#294667] rounded-xl p-6 md:p-8"
            >
              <div className="flex items-center gap-2 mb-2">
                <Map size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-white">{sobre.cobertura.titulo}</h2>
              </div>
              <p className="text-[#8aabcc] text-sm leading-relaxed mb-6">{sobre.cobertura.descricao}</p>

              {/* Estatísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {sobre.cobertura.estatisticas.map((est, i) => (
                  <motion.div
                    key={est.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    className="bg-[#0d1a27] border border-[#294667] rounded-lg p-4 text-center"
                  >
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {est.valor}
                      {est.unidade && <span className="text-base text-[#6b8fad] font-normal ml-0.5">{est.unidade}</span>}
                    </div>
                    <div className="text-xs text-[#6b8fad] mt-1">{est.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Municípios */}
              <div>
                <h3 className="text-xs font-semibold text-[#8aabcc] uppercase tracking-widest mb-3">Municípios monitorados</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {sobre.cobertura.municipiosPrincipais.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 bg-[#0d1a27] border border-[#1a2e42] rounded-lg px-3 py-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(regiaoColor[m.regiao] ?? 'text-[#6b8fad]').replace('text-', 'bg-')}`} />
                      <div>
                        <div className="text-xs font-semibold text-white">{m.nome}</div>
                        <div className={`text-[10px] ${regiaoColor[m.regiao] ?? 'text-[#6b8fad]'}`}>{m.regiao}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* ── Fontes de dados ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="bg-[#0A1420] border border-[#294667] rounded-xl p-6 md:p-8"
            >
              <div className="flex items-center gap-2 mb-2">
                <Database size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-white">{sobre.fontesDados.titulo}</h2>
              </div>
              <p className="text-[#8aabcc] text-sm leading-relaxed mb-6">{sobre.fontesDados.descricao}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sobre.fontesDados.fontes.map((f, i) => (
                  <motion.a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.07 }}
                    className="flex items-start gap-4 bg-[#0d1a27] border border-[#294667] rounded-lg p-4 hover:border-primary/40 transition-colors group"
                  >
                    <ExternalLink size={14} className="text-[#4a6a85] group-hover:text-primary transition-colors mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{f.nome}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tipoColor[f.tipo] ?? 'bg-[#1a2e42] text-[#6b8fad] border-[#294667]'}`}>
                          {f.tipo}
                        </span>
                      </div>
                      <p className="text-xs text-[#6b8fad] leading-relaxed">{f.descricao}</p>
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.div>

            {/* ── Tecnologia ───────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-[#0A1420] border border-[#294667] rounded-xl p-6 md:p-8"
            >
              <div className="flex items-center gap-2 mb-2">
                <Code2 size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-white">{sobre.tecnologia.titulo}</h2>
              </div>
              <p className="text-[#8aabcc] text-sm leading-relaxed mb-6">{sobre.tecnologia.descricao}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sobre.tecnologia.itens.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.06 }}
                    className="flex items-center gap-3 bg-[#0d1a27] border border-[#1a2e42] rounded-lg px-4 py-3"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-white">{t.nome}</div>
                      <div className="text-[10px] text-[#6b8fad] font-mono mt-0.5">{t.detalhe}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* ── Contato ──────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="bg-[#0A1420] border border-[#294667] rounded-xl p-6 md:p-8"
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-white">{sobre.contato.titulo}</h2>
              </div>
              <p className="text-[#8aabcc] text-sm leading-relaxed mb-6">{sobre.contato.descricao}</p>

              <div className="flex flex-wrap gap-3 mb-6">
                <a
                  href={`mailto:${sobre.contato.email}`}
                  className="flex items-center gap-2 bg-primary/15 border border-primary/40 text-primary px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/25 transition-colors"
                >
                  <Mail size={15} />
                  <span>{sobre.contato.email}</span>
                </a>

              </div>

              <div className="bg-[#0d1a27] border border-[#294667] rounded-xl p-5 md:p-6 mb-6">
                <h3 className="text-sm font-bold text-white mb-1">Enviar uma mensagem</h3>
                <p className="text-xs text-[#6b8fad] mb-5">
                  A mensagem será encaminhada à equipe responsável pelo projeto.
                </p>

                {sucesso ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 py-8 text-center"
                    role="status"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle size={24} className="text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Mensagem enviada!</h4>
                      <p className="text-xs text-[#8aabcc]">Responderemos pelo e-mail informado.</p>
                    </div>
                    <button type="button" onClick={resetForm} className="text-xs text-primary hover:text-primary/80">
                      Enviar outra mensagem
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-4">
                    <input
                      ref={honeypotRef}
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      className="absolute -left-[9999px]"
                      aria-hidden="true"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="sobre-email" className="block text-xs font-semibold text-[#8aabcc] mb-1.5">
                          Seu e-mail <span className="text-red-400">*</span>
                        </label>
                        <input
                          id="sobre-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu@email.com"
                          autoComplete="email"
                          maxLength={254}
                          required
                          className="w-full bg-[#0A1420] border border-[#294667] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a6a85] focus:outline-none focus:border-primary/60 transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="sobre-assunto" className="block text-xs font-semibold text-[#8aabcc] mb-1.5">
                          Assunto <span className="text-red-400">*</span>
                        </label>
                        <input
                          id="sobre-assunto"
                          type="text"
                          value={assunto}
                          onChange={(e) => setAssunto(e.target.value)}
                          placeholder="Assunto da mensagem"
                          maxLength={120}
                          required
                          className="w-full bg-[#0A1420] border border-[#294667] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a6a85] focus:outline-none focus:border-primary/60 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="sobre-mensagem" className="block text-xs font-semibold text-[#8aabcc] mb-1.5">
                        Mensagem <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        id="sobre-mensagem"
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        rows={5}
                        maxLength={5000}
                        required
                        className="w-full bg-[#0A1420] border border-[#294667] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a6a85] focus:outline-none focus:border-primary/60 transition-colors resize-y"
                      />
                      <p className="text-[10px] text-[#4a6a85] mt-1 text-right">{mensagem.length}/5000</p>
                    </div>

                    {erro && (
                      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3" role="alert">
                        <AlertTriangle size={14} className="text-red-400 shrink-0" />
                        <p className="text-xs text-red-300">{erro}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={enviando}
                      className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg px-6 py-3 transition-colors"
                    >
                      {enviando ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enviando…
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          Enviar mensagem
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-[#4a6a85] text-center">
                      Seu e-mail será usado somente para responder a esta mensagem.
                    </p>
                  </form>
                )}
              </div>

              {/* Aviso de emergência */}
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{sobre.contato.aviso}</p>
              </div>
            </motion.div>

          </div>
        </section>
      </main>
    </>
  );
}
