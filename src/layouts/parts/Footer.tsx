import { Link } from 'react-router-dom';
import { Waves, ExternalLink } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[#294667] bg-[#060e17]">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Waves size={20} className="text-primary" />
              <span className="font-bold text-white text-sm">Enchentes Vale do Caí</span>
            </div>
            <p className="text-xs text-[#6b8fad] leading-relaxed">
              Monitoramento dos níveis dos rios da bacia do Caí e alertas de enchentes para a comunidade do Vale do Caí, RS.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-xs font-semibold text-[#8aabcc] uppercase tracking-wider mb-3">Navegação</h3>
            <nav className="flex flex-col gap-2" aria-label="Links do rodapé">
              {[
                { href: '/', label: 'Início' },
                { href: '/#rios', label: 'Rios Monitorados' },
                { href: '/alertas', label: 'Alertas e Avisos' },
                { href: '/previsao', label: 'Previsão de Chuvas' },
                { href: '/sobre', label: 'Sobre o Serviço' },
              ].map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-xs text-[#6b8fad] hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Fontes de dados */}
          <div>
            <h3 className="text-xs font-semibold text-[#8aabcc] uppercase tracking-wider mb-3">Fontes de Dados</h3>
            <div className="flex flex-col gap-2">
              <a
                href="https://www.ana.gov.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#6b8fad] hover:text-primary transition-colors"
              >
                <ExternalLink size={11} />
                ANA — Agência Nacional de Águas
              </a>
              <a
                href="https://www.inmet.gov.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#6b8fad] hover:text-primary transition-colors"
              >
                <ExternalLink size={11} />
                INMET — Instituto Nacional de Meteorologia
              </a>
              <a
                href="https://www.sema.rs.gov.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#6b8fad] hover:text-primary transition-colors"
              >
                <ExternalLink size={11} />
                SEMA/RS — Secretaria do Meio Ambiente
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-[#1a2e42] pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-[#4a6a85]">
            © {currentYear} Enchentes Vale do Caí. Dados com fins informativos — não substitui alertas oficiais da Defesa Civil.
          </p>
          <div className="flex gap-4">
            <Link to="/sobre" className="text-xs text-[#4a6a85] hover:text-primary transition-colors">
              Sobre
            </Link>
            <Link to="/contato" className="text-xs text-[#4a6a85] hover:text-primary transition-colors">
              Contato
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
