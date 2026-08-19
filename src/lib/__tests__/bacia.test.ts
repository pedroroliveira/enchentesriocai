import { describe, expect, it } from 'vitest';
import {
  calcularSituacaoBacia,
  contarLocaisNaSituacao,
  resumoBacia,
  type EstacaoSituacao,
  type Situacao,
  type Tendencia,
} from '../bacia';

const est = (situacao: Situacao, tendencia: Tendencia = 'estavel'): EstacaoSituacao => ({ situacao, tendencia });

describe('calcularSituacaoBacia', () => {
  it('fica normal sem estação alguma fora do normal', () => {
    expect(calcularSituacaoBacia([est('normal', 'subindo'), est('normal')])).toBe('normal');
  });

  it('escala para atenção quando a estação em atenção está em elevação', () => {
    expect(calcularSituacaoBacia([est('normal'), est('atencao', 'subindo')])).toBe('atencao');
  });

  it('não escala com estação em atenção estável ou em queda', () => {
    expect(calcularSituacaoBacia([est('atencao', 'estavel')])).toBe('normal');
    expect(calcularSituacaoBacia([est('atencao', 'descendo')])).toBe('normal');
    expect(calcularSituacaoBacia([est('atencao', 'estavel'), est('atencao', 'descendo')])).toBe('normal');
  });

  it('escala em alerta e emergência qualquer que seja a tendência', () => {
    for (const t of ['subindo', 'estavel', 'descendo'] as Tendencia[]) {
      expect(calcularSituacaoBacia([est('alerta', t)])).toBe('alerta');
      expect(calcularSituacaoBacia([est('emergencia', t)])).toBe('emergencia');
    }
  });

  it('usa sempre a situação mais grave', () => {
    expect(calcularSituacaoBacia([est('atencao', 'subindo'), est('emergencia', 'descendo')])).toBe('emergencia');
    expect(calcularSituacaoBacia([est('atencao', 'subindo'), est('alerta', 'descendo')])).toBe('alerta');
  });

  it('lista vazia é normal', () => {
    expect(calcularSituacaoBacia([])).toBe('normal');
  });
});

describe('resumoBacia', () => {
  it('conta os locais na situação em vigor', () => {
    const estacoes = [est('atencao', 'subindo'), est('atencao', 'estavel'), est('normal')];
    expect(resumoBacia(estacoes, 'atencao')).toBe('Pelo menos 2 locais em atenção');
  });

  it('usa o singular com um único local', () => {
    expect(resumoBacia([est('alerta', 'descendo')], 'alerta')).toBe('Pelo menos 1 local em alerta');
  });

  it('diz que está tudo normal quando nenhuma estação passou da cota', () => {
    expect(resumoBacia([est('normal', 'subindo')], 'normal')).toBe('Todos os rios dentro dos limites normais');
  });

  it('ressalva a estação acima da cota que não sustenta o aviso', () => {
    expect(resumoBacia([est('atencao', 'estavel')], 'normal'))
      .toBe('1 estação acima da cota de atenção — nível estável');
    expect(resumoBacia([est('atencao', 'descendo')], 'normal'))
      .toBe('1 estação acima da cota de atenção — nível em queda');
  });

  it('ressalva no plural, distinguindo queda geral de níveis parados', () => {
    expect(resumoBacia([est('atencao', 'descendo'), est('atencao', 'descendo')], 'normal'))
      .toBe('2 estações acima da cota de atenção — níveis em queda');
    expect(resumoBacia([est('atencao', 'descendo'), est('atencao', 'estavel')], 'normal'))
      .toBe('2 estações acima da cota de atenção — níveis sem elevação');
  });
});

describe('contarLocaisNaSituacao', () => {
  it('conta apenas a situação pedida', () => {
    const estacoes = [est('atencao', 'subindo'), est('alerta'), est('normal')];
    expect(contarLocaisNaSituacao(estacoes, 'atencao')).toBe(1);
    expect(contarLocaisNaSituacao(estacoes, 'normal')).toBe(1);
    expect(contarLocaisNaSituacao(estacoes, 'emergencia')).toBe(0);
  });
});
