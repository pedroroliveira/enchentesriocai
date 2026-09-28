import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ db: {} }));

const { parseAnaXml, parseDataHoraAna } = await import('./ana.js');

describe('parseDataHoraAna', () => {
  it('interpreta a hora da ANA como horário de Brasília, independente do fuso do servidor', () => {
    // 16:45 em Brasília = 19:45 UTC. Antes ficava 16:45 UTC — 3 h no passado.
    expect(parseDataHoraAna('2026-09-28 16:45:00 ').toISOString()).toBe('2026-09-28T19:45:00.000Z');
  });

  it('vira o dia em UTC depois das 21 h de Brasília', () => {
    expect(parseDataHoraAna('2026-09-28 22:15:00').toISOString()).toBe('2026-09-29T01:15:00.000Z');
  });
});

describe('parseAnaXml', () => {
  it('lê nível e data em ordem cronológica, descartando leituras vazias', () => {
    const xml = `
      <DocumentElement>
        <DadosHidrometereologicos><DataHora>2026-09-28 16:45:00 </DataHora><Nivel>312.00</Nivel></DadosHidrometereologicos>
        <DadosHidrometereologicos><DataHora>2026-09-28 16:30:00 </DataHora><Nivel>  </Nivel></DadosHidrometereologicos>
        <DadosHidrometereologicos><DataHora>2026-09-28 16:15:00 </DataHora><Nivel>309,50</Nivel></DadosHidrometereologicos>
      </DocumentElement>`;
    expect(parseAnaXml(xml)).toEqual([
      { dataHora: new Date('2026-09-28T19:15:00.000Z'), nivelCm: 309.5 },
      { dataHora: new Date('2026-09-28T19:45:00.000Z'), nivelCm: 312 },
    ]);
  });
});
