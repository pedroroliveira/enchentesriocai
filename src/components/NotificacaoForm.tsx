import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Mail, MessageCircle, MapPin, AlertTriangle, CheckCircle, Loader2, ChevronDown } from 'lucide-react';

const CIDADES = [
  'Caxias do Sul',
  'São Marcos',
  'Antônio Prado',
  'Flores da Cunha',
  'Nova Prata',
  'Bento Gonçalves',
  'Garibaldi',
  'Carlos Barbosa',
  'Bom Princípio',
  'São Sebastião do Caí',
  'Vale Real',
  'Feliz',
  'Montenegro',
  'São Jerônimo',
  'Triunfo',
];

const NIVEIS = [
  { value: 'atencao',   label: 'Atenção',    desc: 'Primeiro sinal de elevação',  cor: 'text-amber-400'  },
  { value: 'alerta',    label: 'Alerta',     desc: 'Risco moderado de transbordamento', cor: 'text-orange-400' },
  { value: 'emergencia',label: 'Emergência', desc: 'Situação crítica iminente',   cor: 'text-red-400'    },
];

type Estado = 'idle' | 'enviando' | 'sucesso' | 'erro' | 'duplicado';

export default function NotificacaoForm() {
  const [email, setEmail]           = useState('');
  const [whatsapp, setWhatsapp]     = useState('');
  const [cidades, setCidades]       = useState<string[]>([]);
  const [nivel, setNivel]           = useState('atencao');
  const [estado, setEstado]         = useState<Estado>('idle');
  const [erroMsg, setErroMsg]       = useState('');
  const [cidadeAberta, setCidadeAberta] = useState(false);

  const toggleCidade = (c: string) =>
    setCidades(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const podeEnviar = emailValido(email) && cidades.length > 0 && estado !== 'enviando';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;

    setEstado('enviando');
    setErroMsg('');

    // Cadastra e-mail
    try {
      const resEmail = await fetch('/api/notificacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contato: email.trim(), tipo: 'email', cidades, nivelMinimo: nivel }),
      });

      if (resEmail.status === 409) {
        setEstado('duplicado');
        return;
      }
      if (!resEmail.ok) throw new Error('Erro ao cadastrar e-mail');

      // Cadastra WhatsApp se informado
      if (whatsapp.trim()) {
        const num = whatsapp.replace(/\D/g, '');
        const resWpp = await fetch('/api/notificacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contato: num, tipo: 'whatsapp', cidades, nivelMinimo: nivel }),
        });
        // ignora 409 no WhatsApp (pode já estar cadastrado)
        if (!resWpp.ok && resWpp.status !== 409) throw new Error('Erro ao cadastrar WhatsApp');
      }

      setEstado('sucesso');
    } catch (err) {
      setEstado('erro');
      setErroMsg(err instanceof Error ? err.message : 'Erro inesperado');
    }
  }

  if (estado === 'sucesso') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-4 py-8 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle size={28} className="text-emerald-400" />
        </div>
        <div>
          <div className="text-lg font-bold text-white mb-1">Cadastro realizado!</div>
          <div className="text-sm text-[#8aabcc]">
            Você receberá alertas em <span className="text-white font-medium">{email}</span>
            {whatsapp && <> e no WhatsApp <span className="text-white font-medium">{whatsapp}</span></>}
            {' '}quando os rios atingirem o nível de{' '}
            <span className="font-medium text-amber-400">
              {NIVEIS.find(n => n.value === nivel)?.label}
            </span>{' '}
            em {cidades.length === 1 ? cidades[0] : `${cidades.length} cidades`}.
          </div>
        </div>
        <button
          onClick={() => { setEstado('idle'); setEmail(''); setWhatsapp(''); setCidades([]); setNivel('atencao'); }}
          className="text-xs text-[#4a6a85] hover:text-primary transition-colors mt-2"
        >
          Cadastrar outro contato
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* E-mail */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#8aabcc] mb-1.5">
          <Mail size={12} />
          E-mail <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
          className="w-full bg-[#0d1a27] border border-[#294667] text-white placeholder-[#4a6a85] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
        />
        {email && !emailValido(email) && (
          <p className="text-xs text-red-400 mt-1">E-mail inválido</p>
        )}
      </div>

      {/* WhatsApp */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#8aabcc] mb-1.5">
          <MessageCircle size={12} />
          WhatsApp <span className="text-[#4a6a85] font-normal">(opcional)</span>
        </label>
        <input
          type="tel"
          value={whatsapp}
          onChange={e => setWhatsapp(e.target.value)}
          placeholder="+55 51 9 9999-9999"
          className="w-full bg-[#0d1a27] border border-[#294667] text-white placeholder-[#4a6a85] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Cidades */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#8aabcc] mb-1.5">
          <MapPin size={12} />
          Cidades monitoradas <span className="text-red-400">*</span>
          {cidades.length > 0 && (
            <span className="ml-auto text-primary font-semibold">{cidades.length} selecionada{cidades.length > 1 ? 's' : ''}</span>
          )}
        </label>

        {/* Trigger */}
        <button
          type="button"
          onClick={() => setCidadeAberta(v => !v)}
          className="w-full bg-[#0d1a27] border border-[#294667] text-left rounded-md px-4 py-2.5 text-sm flex items-center justify-between focus:outline-none focus:border-primary transition-colors"
        >
          <span className={cidades.length === 0 ? 'text-[#4a6a85]' : 'text-white'}>
            {cidades.length === 0
              ? 'Selecione as cidades...'
              : cidades.length <= 2
                ? cidades.join(', ')
                : `${cidades.slice(0, 2).join(', ')} +${cidades.length - 2}`}
          </span>
          <ChevronDown size={14} className={`text-[#4a6a85] transition-transform ${cidadeAberta ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {cidadeAberta && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="mt-1 bg-[#0d1a27] border border-[#294667] rounded-md overflow-hidden"
            >
              <div className="max-h-44 overflow-y-auto p-1">
                {CIDADES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCidade(c)}
                    className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors ${
                      cidades.includes(c)
                        ? 'bg-primary/15 text-primary'
                        : 'text-[#8aabcc] hover:bg-[#1a2e42]'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${
                      cidades.includes(c) ? 'bg-primary border-primary text-white' : 'border-[#294667]'
                    }`}>
                      {cidades.includes(c) && '✓'}
                    </span>
                    {c}
                  </button>
                ))}
              </div>
              <div className="border-t border-[#1a2e42] px-3 py-2 flex justify-between items-center">
                <button type="button" onClick={() => setCidades([...CIDADES])} className="text-xs text-primary hover:underline">Todas</button>
                <button type="button" onClick={() => setCidades([])} className="text-xs text-[#4a6a85] hover:underline">Limpar</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nível mínimo */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#8aabcc] mb-2">
          <AlertTriangle size={12} />
          Notificar a partir de
        </label>
        <div className="grid grid-cols-3 gap-2">
          {NIVEIS.map(n => (
            <button
              key={n.value}
              type="button"
              onClick={() => setNivel(n.value)}
              className={`rounded-md border px-3 py-2.5 text-center transition-all ${
                nivel === n.value
                  ? 'border-primary bg-primary/10'
                  : 'border-[#294667] bg-[#0d1a27] hover:border-[#3a5a75]'
              }`}
            >
              <div className={`text-xs font-bold ${nivel === n.value ? 'text-primary' : n.cor}`}>{n.label}</div>
              <div className="text-[10px] text-[#4a6a85] mt-0.5 leading-tight hidden sm:block">{n.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Feedback de erro */}
      <AnimatePresence>
        {(estado === 'erro' || estado === 'duplicado') && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-xs ${
              estado === 'duplicado'
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}
          >
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {estado === 'duplicado'
              ? 'Este e-mail já está cadastrado para receber alertas.'
              : erroMsg || 'Erro ao cadastrar. Tente novamente.'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão */}
      <button
        type="submit"
        disabled={!podeEnviar}
        className="w-full bg-primary text-white font-semibold py-3 rounded-md hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {estado === 'enviando' ? (
          <><Loader2 size={15} className="animate-spin" /> Cadastrando...</>
        ) : (
          <><Bell size={15} /> Cadastrar alertas</>
        )}
      </button>

      <p className="text-xs text-[#3a5a75] text-center">
        Gratuito. Cancele a qualquer momento.
      </p>
    </form>
  );
}
