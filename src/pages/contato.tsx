import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Mail,
  MessageSquare,
  Send,
  CheckCircle,
  AlertTriangle,
  Waves,
  Phone,
  MapPin,
  Clock,
} from 'lucide-react';
import { contato } from 'virtual:content';

const SITE = 'https://enchentesvaledocai.com.br';

type Assunto = 'duvida' | 'erro' | 'sugestao' | 'imprensa' | 'outro';

const ASSUNTOS: { value: Assunto; label: string }[] = [
  { value: 'duvida',    label: 'Dúvida sobre os dados' },
  { value: 'erro',      label: 'Reportar erro ou dado incorreto' },
  { value: 'sugestao',  label: 'Sugestão de melhoria' },
  { value: 'imprensa',  label: 'Imprensa / Parceria' },
  { value: 'outro',     label: 'Outro assunto' },
];

// Documento JSON-LD estático: não depende de estado, fica fora do render.
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  '@id': `${SITE}/contato#webpage`,
  name: 'Contato — Enchentes Vale do Caí',
  url: `${SITE}/contato`,
  isPartOf: { '@id': `${SITE}/#website` },
  about: { '@id': `${SITE}/#organization` },
});

export default function ContatoPage() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [assunto, setAssunto] = useState<Assunto>('duvida');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const honeypotRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    // Honeypot check — se preenchido, é bot; ignora silenciosamente
    if (honeypotRef.current?.value) {
      setSucesso(true);
      return;
    }

    if (!nome.trim() || !email.trim() || !mensagem.trim()) {
      setErro('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setEnviando(true);
    try {
      const assuntoLabel = ASSUNTOS.find((a) => a.value === assunto)?.label ?? assunto;

      // Field mapping: only the message textarea goes in messages_attributes[0].body.
      // All other fields (dropdowns, radios, checkboxes) must be added to conversation.data as { "Label": value } pairs.
      const res = await fetch('/api/contact/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: {
            messages_attributes: [{ body: mensagem }],
            data: {
              __gd_contact_form_title: 'Contato — Enchentes Vale do Caí',
              'Assunto': assuntoLabel,
            },
          },
          user: { email: email.trim(), name: nome.trim() },
        }),
      });

      const json = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Erro ao enviar mensagem.');
      }
      setSucesso(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }


  return (
    <>
      <Helmet>
        <title>Contato — Enchentes Vale do Caí</title>
        <meta name="description" content="Entre em contato com a equipe do Enchentes Vale do Caí. Dúvidas, sugestões, erros nos dados ou parcerias." />
        <link rel="canonical" href={`${SITE}/contato`} />
        <meta property="og:title" content="Contato — Enchentes Vale do Caí" />
        <meta property="og:description" content="Entre em contato com a equipe do Enchentes Vale do Caí." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE}/contato`} />
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
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">Fale Conosco</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{contato.hero.titulo}</h1>
            <p className="text-[#8aabcc] text-sm max-w-2xl">
              {contato.hero.subtitulo}
            </p>
          </div>
        </section>

        <section className="bg-[#0d1a27] py-10">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">

              {/* ── Informações de contato ───────────────────────────── */}
              <div className="flex flex-col gap-5">
                <div className="bg-[#0A1420] border border-[#294667] rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-white mb-4">Informações</h2>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <Mail size={15} className="text-primary mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-[#4a6a85] mb-0.5">E-mail</div>
                        <a
                          href={`mailto:${contato.info.email}`}
                          className="text-xs text-[#8aabcc] hover:text-primary transition-colors break-all"
                        >
                          {contato.info.email}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin size={15} className="text-primary mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-[#4a6a85] mb-0.5">Região atendida</div>
                        <span className="text-xs text-[#8aabcc]">{contato.info.regiao}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock size={15} className="text-primary mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[10px] text-[#4a6a85] mb-0.5">Tempo de resposta</div>
                        <span className="text-xs text-[#8aabcc]">{contato.info.tempoResposta}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0A1420] border border-[#294667] rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-white mb-3">Emergências</h2>
                  <p className="text-xs text-[#8aabcc] leading-relaxed mb-3">
                    Em situações de risco imediato, acione os órgãos oficiais:
                  </p>
                  <div className="flex flex-col gap-2">
                  {contato.emergencias.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-[#0d1a27] rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-[#4a6a85]" />
                          <span className="text-xs text-[#8aabcc]">{item.label}</span>
                        </div>
                        <a
                          href={`tel:${item.numero}`}
                          className="text-sm font-bold text-primary hover:text-primary/80 transition-colors tabular-nums"
                        >
                          {item.numero}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Formulário ──────────────────────────────────────── */}
              <div className="lg:col-span-2">
                <div className="bg-[#0A1420] border border-[#294667] rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <MessageSquare size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold text-white">{contato.formulario.titulo}</h2>
                  </div>

                  {sucesso ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="flex flex-col items-center justify-center gap-4 py-12 text-center"
                    >
                      <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                        <CheckCircle size={28} className="text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white mb-1">{contato.formulario.sucessoTitulo}</h3>
                        <p className="text-sm text-[#8aabcc] max-w-sm">
                          {contato.formulario.sucessoDescricao}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSucesso(false);
                          setNome('');
                          setEmail('');
                          setAssunto('duvida');
                          setMensagem('');
                        }}
                        className="text-xs text-primary hover:text-primary/80 transition-colors mt-2"
                      >
                        Enviar outra mensagem
                      </button>
                    </motion.div>
                  ) : (
                    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-5">
                      {/* Honeypot — fora da tela, nunca incluído no POST */}
                      <input
                        ref={honeypotRef}
                        type="text"
                        name="_gotcha"
                        tabIndex={-1}
                        autoComplete="off"
                        style={{ position: 'absolute', left: '-9999px' }}
                        aria-hidden="true"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Nome */}
                        <div>
                          <label htmlFor="nome" className="block text-xs font-semibold text-[#8aabcc] mb-1.5">
                            Nome <span className="text-red-400">*</span>
                          </label>
                          <input
                            id="nome"
                            type="text"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder={contato.formulario.placeholderNome}
                            required
                            className="w-full bg-[#0d1a27] border border-[#294667] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a6a85] focus:outline-none focus:border-primary/60 transition-colors"
                          />
                        </div>

                        {/* E-mail */}
                        <div>
                          <label htmlFor="email" className="block text-xs font-semibold text-[#8aabcc] mb-1.5">
                            E-mail <span className="text-red-400">*</span>
                          </label>
                          <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={contato.formulario.placeholderEmail}
                            required
                            className="w-full bg-[#0d1a27] border border-[#294667] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a6a85] focus:outline-none focus:border-primary/60 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Assunto */}
                      <div>
                        <label htmlFor="assunto" className="block text-xs font-semibold text-[#8aabcc] mb-1.5">
                          Assunto
                        </label>
                        <select
                          id="assunto"
                          value={assunto}
                          onChange={(e) => setAssunto(e.target.value as Assunto)}
                          className="w-full bg-[#0d1a27] border border-[#294667] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/60 transition-colors appearance-none cursor-pointer"
                        >
                          {ASSUNTOS.map((a) => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Mensagem */}
                      <div>
                        <label htmlFor="mensagem" className="block text-xs font-semibold text-[#8aabcc] mb-1.5">
                          Mensagem <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          id="mensagem"
                          value={mensagem}
                          onChange={(e) => setMensagem(e.target.value)}
                          placeholder={contato.formulario.placeholderMensagem}
                          required
                          rows={5}
                          className="w-full bg-[#0d1a27] border border-[#294667] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4a6a85] focus:outline-none focus:border-primary/60 transition-colors resize-none"
                        />
                        <p className="text-[10px] text-[#4a6a85] mt-1">{mensagem.length} caracteres</p>
                      </div>

                      {/* Erro */}
                      {erro && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                          <AlertTriangle size={14} className="text-red-400 shrink-0" />
                          <p className="text-xs text-red-300">{erro}</p>
                        </div>
                      )}

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={enviando}
                        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg px-6 py-3 transition-colors"
                      >
                        {enviando ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Enviando…
                          </>
                        ) : (
                          <>
                            <Send size={15} />
                            {contato.formulario.botaoEnviar}
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-[#4a6a85] text-center">
                        {contato.formulario.privacidade}
                      </p>
                    </form>
                  )}
                </div>
              </div>

            </div>
          </div>
        </section>
      </main>
    </>
  );
}
