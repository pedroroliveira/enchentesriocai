import { describe, expect, it } from 'vitest';
import { googleMapsUrl } from './StationLocationLink.js';

describe('googleMapsUrl', () => {
  it('gera uma busca do Google Maps com latitude e longitude', () => {
    expect(googleMapsUrl('-29.6800', '-51.4600')).toBe(
      'https://www.google.com/maps/search/?api=1&query=-29.68%2C-51.46',
    );
  });

  it('não gera link quando falta uma coordenada', () => {
    expect(googleMapsUrl(null, '-51.4600')).toBeNull();
    expect(googleMapsUrl('-29.6800', null)).toBeNull();
  });

  it('rejeita coordenadas inválidas ou fora dos limites geográficos', () => {
    expect(googleMapsUrl('texto', '-51.4600')).toBeNull();
    expect(googleMapsUrl('-91', '-51.4600')).toBeNull();
    expect(googleMapsUrl('-29.6800', '181')).toBeNull();
  });
});
