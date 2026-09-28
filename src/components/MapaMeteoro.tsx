import { useState, useEffect, useRef } from 'react';
import { Map, Layers, RefreshCw, ExternalLink, Droplets, Wind, Thermometer, Cloud } from 'lucide-react';

// Centralizado em Montenegro, RS — zoom 6 mostra a maior parte do estado
const LAT = -29.69;
const LON = -51.46;
const ZOOM = 6;

// Camadas disponíveis
type CamadaId = 'chuva' | 'nuvens' | 'temperatura' | 'vento';

interface Camada {
  id: CamadaId;
  label: string;
  descricao: string;
  icon: React.ReactNode;
  windyLayer: string;
  color: string;
}

const CAMADAS: Camada[] = [
  {
    id: 'chuva',
    label: 'Radar de Chuva',
    descricao: 'Precipitação em tempo real',
    icon: <Droplets size={14} />,
    windyLayer: 'rain',
    color: 'text-primary border-primary/40 bg-primary/10',
  },
  {
    id: 'nuvens',
    label: 'Cobertura de Nuvens',
    descricao: 'Nebulosidade atual',
    icon: <Cloud size={14} />,
    windyLayer: 'clouds',
    color: 'text-[#8aabcc] border-[#8aabcc]/40 bg-[#8aabcc]/10',
  },
  {
    id: 'temperatura',
    label: 'Temperatura',
    descricao: 'Temperatura do ar (2m)',
    icon: <Thermometer size={14} />,
    windyLayer: 'temp',
    color: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
  },
  {
    id: 'vento',
    label: 'Vento',
    descricao: 'Velocidade e direção do vento',
    icon: <Wind size={14} />,
    windyLayer: 'wind',
    color: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  },
];

// Monta URL do embed do Windy
function windyUrl(layer: string): string {
  const params = new URLSearchParams({
    lat: String(LAT),
    lon: String(LON),
    zoom: String(ZOOM),
    level: 'surface',
    overlay: layer,
    product: 'ecmwf',
    menu: '',
    message: '',
    marker: '',
    calendar: 'now',
    pressure: '',
    type: 'map',
    location: 'coordinates',
    detail: '',
    metricWind: 'km%2Fh',
    metricTemp: '%C2%B0C',
    radarRange: '-1',
  });
  return `https://embed.windy.com/embed2.html?${params.toString()}`;
}

export default function MapaMeteoro() {
  const [camadaAtiva, setCamadaAtiva] = useState<CamadaId>('chuva');
  const [carregando, setCarregando] = useState(true);
  const [chave, setChave] = useState(0); // força re-render do iframe ao trocar camada
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const camada = CAMADAS.find((c) => c.id === camadaAtiva)!;

  // Ao trocar camada, mostra loading e incrementa chave para recarregar iframe
  function trocarCamada(id: CamadaId) {
    if (id === camadaAtiva) return;
    setCarregando(true);
    setCamadaAtiva(id);
    setChave((k) => k + 1);
  }

  function recarregar() {
    setCarregando(true);
    setChave((k) => k + 1);
  }

  // Timeout de segurança: se o iframe demorar muito, remove o loading
  useEffect(() => {
    const t = setTimeout(() => setCarregando(false), 8000);
    return () => clearTimeout(t);
  }, [chave]);

  return (
    <div className="bg-[#0A1420] border border-[#294667] rounded-xl overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-5 py-4 border-b border-[#294667] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Map size={15} className="text-primary" />
          <h2 className="text-sm font-semibold text-white">Mapas Meteorológicos</h2>
          <span className="text-[10px] bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-mono">
            AO VIVO
          </span>
        </div>
        <button
          onClick={recarregar}
          className="flex items-center gap-1.5 text-[11px] text-[#4a6a85] hover:text-primary transition-colors"
          title="Recarregar mapa"
        >
          <RefreshCw size={12} className={carregando ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Recarregar</span>
        </button>
      </div>

      {/* Seletor de camadas */}
      <div className="px-5 py-3 border-b border-[#1a2e42] flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 mr-1">
          <Layers size={12} className="text-[#4a6a85]" />
          <span className="text-[10px] text-[#4a6a85] font-semibold">Camada:</span>
        </div>
        {CAMADAS.map((c) => (
          <button
            key={c.id}
            onClick={() => trocarCamada(c.id)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
              camadaAtiva === c.id
                ? c.color
                : 'text-[#4a6a85] border-[#294667] bg-transparent hover:border-[#4a6a85] hover:text-[#8aabcc]'
            }`}
          >
            {c.icon}
            {c.label}
          </button>
        ))}
      </div>

      {/* Mapa */}
      <div className="relative" style={{ paddingBottom: '56.25%' /* 16:9 */ }}>
        {/* Skeleton de carregamento */}
        {carregando && (
          <div className="absolute inset-0 z-10 bg-[#0d1a27] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-[#4a6a85]">Carregando {camada.label.toLowerCase()}…</p>
          </div>
        )}

        <iframe
          key={chave}
          ref={iframeRef}
          src={windyUrl(camada.windyLayer)}
          title={`Mapa meteorológico — ${camada.label}`}
          className="absolute inset-0 w-full h-full border-0"
          onLoad={() => setCarregando(false)}
          loading="lazy"
          allow="fullscreen"
        />
      </div>

      {/* Rodapé */}
      <div className="px-5 py-3 border-t border-[#1a2e42] bg-[#0d1a27] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          <span className="text-[10px] text-[#4a6a85]">
            Região: Rio Grande do Sul (centro em Montenegro)
          </span>
          <span className="text-[10px] text-[#4a6a85]">
            {camada.descricao} · Modelo ECMWF
          </span>
        </div>
        <a
          href={`https://www.windy.com/?${camada.windyLayer},${LAT},${LON},${ZOOM}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-[#4a6a85] hover:text-primary transition-colors"
        >
          <ExternalLink size={10} />
          Abrir no Windy
        </a>
      </div>
    </div>
  );
}
