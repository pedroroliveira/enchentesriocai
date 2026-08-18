import { ExternalLink, MapPin } from 'lucide-react';

interface StationLocationLinkProps {
  lat: string | null;
  lng: string | null;
  compact?: boolean;
  className?: string;
}

export function googleMapsUrl(lat: string | null, lng: string | null): string | null {
  if (!lat || !lng) return null;

  const latitude = Number(lat);
  const longitude = Number(lng);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const query = encodeURIComponent(`${latitude},${longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default function StationLocationLink({
  lat,
  lng,
  compact = false,
  className = '',
}: StationLocationLinkProps) {
  const href = googleMapsUrl(lat, lng);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={event => event.stopPropagation()}
      className={`inline-flex items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50 transition-colors ${
        compact ? 'gap-1 px-2 py-1 text-[10px]' : 'gap-1.5 px-3 py-1.5 text-xs font-semibold'
      } ${className}`}
      aria-label="Abrir localização da estação no Google Maps"
    >
      <MapPin size={compact ? 11 : 13} />
      <span>Localização</span>
      <ExternalLink size={compact ? 10 : 12} aria-hidden="true" />
    </a>
  );
}
