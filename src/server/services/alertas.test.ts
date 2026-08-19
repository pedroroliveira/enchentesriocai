import { describe, expect, it } from 'vitest';
import { derivarAlertas, ordenarAlertas, LEITURA_MAX_IDADE_MS, type AlertaAtivo } from './alertas.js';
import type { LeituraEstacao } from './ana.js';

const AGORA = new Date('2026-08-19T18:00:00.000Z');

function estacao(over: Partial<LeituraEstacao> = {}): LeituraEstacao {
  return {
    codAna: '87270000',
    codDcrs: 'DCRS-00012',
    nomeExibicao: 'Montenegro',
    rio: 'Rio Caí',
    cidade: 'Montenegro',
    lat: null,
    lng: null,
    posX: null,
    posY: null,
    ordem: 1,
    nivelM: 1.84,
    nivelCm: 184,
    dataHora: '2026-08-19T17:50:00.000Z',
    situacao: 'normal',
    tendencia: 'estavel',
    cotaAtencao: 4,
    cotaAlerta: 5,
    cotaEmergencia: 6,
    temperatura: null,
    umidade: null,
    pressao: null,
    ventoVel: null,
    chuva1h: null,
    chuva24h: null,
    chuva7d: null,
    fonte: 'DCRS',
    atualizadoEm: '2026-08-19T17:55:00.000Z',
    ...over,
  };
}

describe('derivarAlertas', () => {
  it('não gera alerta para estação em situação normal', () => {
    expect(derivarAlertas([estacao()], AGORA)).toEqual([]);
  });

  it('não gera alerta de atenção com o nível estável ou em queda', () => {
    expect(derivarAlertas([estacao({ nivelM: 4.15, situacao: 'atencao', tendencia: 'estavel' })], AGORA)).toEqual([]);
    expect(derivarAlertas([estacao({ nivelM: 4.15, situacao: 'atencao', tendencia: 'descendo' })], AGORA)).toEqual([]);
  });

  it('gera alerta de alerta e emergência em qualquer tendência', () => {
    for (const tendencia of ['subindo', 'estavel', 'descendo'] as const) {
      expect(derivarAlertas([estacao({ nivelM: 5.2, situacao: 'alerta', tendencia })], AGORA)).toHaveLength(1);
      expect(derivarAlertas([estacao({ nivelM: 6.5, situacao: 'emergencia', tendencia })], AGORA)).toHaveLength(1);
    }
  });

  it('gera alerta a partir da situação calculada pela cota', () => {
    const [alerta] = derivarAlertas([estacao({ nivelM: 4.15, situacao: 'atencao', tendencia: 'subindo' })], AGORA);

    expect(alerta.id).toBe('estacao-87270000');
    expect(alerta.nivel).toBe('atencao');
    expect(alerta.titulo).toBe('Nível de atenção — Montenegro');
    expect(alerta.nivelAgua).toBe('4,15');
    expect(alerta.cotaReferencia).toBe('4,00');
    expect(alerta.origem).toBe('estacao');
    expect(alerta.criadoEm).toBe('2026-08-19T17:50:00.000Z');
    expect(alerta.descricao).toContain('acima da cota de atenção (4,00m)');
    expect(alerta.descricao).toContain('em elevação');
  });

  it('usa a cota correspondente a cada nível', () => {
    const [emergencia] = derivarAlertas([estacao({ nivelM: 6.2, situacao: 'emergencia' })], AGORA);
    expect(emergencia.cotaReferencia).toBe('6,00');
    expect(emergencia.titulo).toBe('Nível de emergência — Montenegro');

    const [alerta] = derivarAlertas([estacao({ nivelM: 5.1, situacao: 'alerta' })], AGORA);
    expect(alerta.cotaReferencia).toBe('5,00');
  });

  it('descarta leitura velha demais para descrever o rio agora', () => {
    const velha = new Date(AGORA.getTime() - LEITURA_MAX_IDADE_MS - 60_000).toISOString();
    expect(derivarAlertas([estacao({ nivelM: 4.15, situacao: 'atencao', tendencia: 'subindo', dataHora: velha })], AGORA)).toEqual([]);
  });

  it('mantém leitura dentro da janela de validade', () => {
    const recente = new Date(AGORA.getTime() - LEITURA_MAX_IDADE_MS + 60_000).toISOString();
    expect(derivarAlertas([estacao({ nivelM: 4.15, situacao: 'atencao', tendencia: 'subindo', dataHora: recente })], AGORA)).toHaveLength(1);
  });

  it('ignora estação sem nível ou sem hora da leitura', () => {
    expect(derivarAlertas([estacao({ nivelM: null, situacao: 'atencao', tendencia: 'subindo' })], AGORA)).toEqual([]);
    expect(derivarAlertas([estacao({ nivelM: 4.15, situacao: 'atencao', tendencia: 'subindo', dataHora: null })], AGORA)).toEqual([]);
  });

  it('descreve o alerta mesmo sem cota cadastrada', () => {
    const [alerta] = derivarAlertas([estacao({ nivelM: 4.15, situacao: 'atencao', tendencia: 'subindo', cotaAtencao: null })], AGORA);
    expect(alerta.cotaReferencia).toBeNull();
    expect(alerta.descricao).toContain('acima da cota de atenção.');
  });

  it('ordena do mais grave para o menos grave', () => {
    const lista = derivarAlertas([
      estacao({ codAna: '1', cidade: 'A', nivelM: 4.1, situacao: 'atencao', tendencia: 'subindo' }),
      estacao({ codAna: '2', cidade: 'B', nivelM: 6.5, situacao: 'emergencia' }),
      estacao({ codAna: '3', cidade: 'C', nivelM: 5.2, situacao: 'alerta' }),
    ], AGORA);

    expect(lista.map(a => a.cidade)).toEqual(['B', 'C', 'A']);
  });
});

describe('ordenarAlertas', () => {
  it('desempata pelo alerta mais recente', () => {
    const base: AlertaAtivo = {
      id: 'x', titulo: 't', descricao: 'd', nivel: 'atencao', cidade: 'A', rio: 'Rio Caí',
      nivelAgua: null, cotaReferencia: null, ativo: true,
      criadoEm: '2026-08-19T10:00:00.000Z', encerradoEm: null, origem: 'manual',
    };
    const lista = ordenarAlertas([
      base,
      { ...base, id: 'y', criadoEm: '2026-08-19T17:00:00.000Z' },
    ]);

    expect(lista.map(a => a.id)).toEqual(['y', 'x']);
  });
});
