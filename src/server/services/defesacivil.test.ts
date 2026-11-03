import { describe, expect, it } from 'vitest';
import { parseTimestampDcrs } from './defesacivil.js';

describe('parseTimestampDcrs', () => {
  it('interpreta o timestamp sem fuso como horário de Brasília', () => {
    // Formato devolvido pela API desde out/2026: 20:25 em Brasília = 23:25 UTC.
    expect(parseTimestampDcrs('2026-11-03T20:25:00.000')?.toISOString()).toBe('2026-11-03T23:25:00.000Z');
  });

  it('respeita timestamps que já trazem fuso', () => {
    expect(parseTimestampDcrs('2026-10-14T17:34:52.000Z')?.toISOString()).toBe('2026-10-14T17:34:52.000Z');
    expect(parseTimestampDcrs('2026-10-14T14:34:52-03:00')?.toISOString()).toBe('2026-10-14T17:34:52.000Z');
  });

  it('devolve null para texto inválido', () => {
    expect(parseTimestampDcrs('sem data')).toBeNull();
  });
});
