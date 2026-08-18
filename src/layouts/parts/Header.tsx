import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Waves } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Início' },
    { href: '/mapa', label: 'Mapa' },
    { href: '/alertas', label: 'Alertas' },
    { href: '/previsao', label: 'Previsão' },
    { href: '/sobre', label: 'Sobre' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0A1420] border-b border-[#294667]">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src="/assets/media/logo-horizontal.png"
              alt="Enchentes Vale do Caí"
              className="block h-auto max-h-10 md:max-h-12 w-auto max-w-full object-contain self-center"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <span
              className="hidden items-center gap-2 text-white font-bold text-lg"
              style={{ display: 'none' }}
            >
              <Waves size={22} className="text-primary" />
              <span>Enchentes Vale do Caí</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-6" aria-label="Navegação principal">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === item.href
                    ? 'text-white'
                    : 'text-[#8aabcc]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 hover:bg-[#1E3A5F] rounded-md transition-colors text-white"
            aria-label="Abrir menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-[#294667] py-4">
            <nav className="flex flex-col gap-1" aria-label="Navegação mobile">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary py-2 px-2 rounded ${
                    location.pathname === item.href
                      ? 'text-white bg-[#1E3A5F]'
                      : 'text-[#8aabcc]'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
