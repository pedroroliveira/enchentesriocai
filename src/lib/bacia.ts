/**
 * Regras da faixa de "Situação da bacia" exibida no topo da home.
 *
 * A bacia só escala para ATENÇÃO quando alguma estação nessa faixa está em
 * elevação: nível que cruzou a cota mas já parou de subir não sustenta o
 * aviso. Alerta e emergência escalam sempre, qualquer que seja a tendência —
 * nesses patamares o rio já é problema mesmo estável ou baixando.
 */

export type Situacao = 'normal' | 'atencao' | 'alerta' | 'emergencia';
export type Tendencia = 'subindo' | 'descendo' | 'estavel';

export interface EstacaoSituacao {
  situacao: Situacao;
  tendencia: Tendencia;
}

const ROTULO_SITUACAO: Record<Exclude<Situacao, 'normal'>, string> = {
  atencao:    'atenção',
  alerta:     'alerta',
  emergencia: 'emergência',
};

/**
 * A leitura sustenta um aviso? Regra única da casa, usada tanto pela faixa de
 * situação da bacia quanto pelos alertas derivados das estações — as duas
 * telas precisam dizer a mesma coisa sobre o mesmo rio.
 */
export function sustentaAviso(estacao: EstacaoSituacao): boolean {
  if (estacao.situacao === 'normal')  return false;
  if (estacao.situacao === 'atencao') return estacao.tendencia === 'subindo';
  return true;
}

export function calcularSituacaoBacia(estacoes: EstacaoSituacao[]): Situacao {
  const emAviso = estacoes.filter(sustentaAviso);
  if (emAviso.some(e => e.situacao === 'emergencia')) return 'emergencia';
  if (emAviso.some(e => e.situacao === 'alerta'))     return 'alerta';
  if (emAviso.some(e => e.situacao === 'atencao'))    return 'atencao';
  return 'normal';
}

export function contarLocaisNaSituacao(estacoes: EstacaoSituacao[], s: Situacao): number {
  return estacoes.filter(e => e.situacao === s).length;
}

/**
 * Quando a bacia não escala mas há estação acima da cota, a faixa verde não
 * pode dizer que está tudo dentro dos limites — informa a ressalva.
 */
function ressalvaBacia(estacoes: EstacaoSituacao[]): string | null {
  const acimaDaCota = estacoes.filter(e => e.situacao !== 'normal');
  if (acimaDaCota.length === 0) return null;

  if (acimaDaCota.length === 1) {
    const tendencia = acimaDaCota[0].tendencia === 'descendo' ? 'em queda' : 'estável';
    return `1 estação acima da cota de atenção — nível ${tendencia}`;
  }

  const todasEmQueda = acimaDaCota.every(e => e.tendencia === 'descendo');
  return `${acimaDaCota.length} estações acima da cota de atenção — ` +
    `níveis ${todasEmQueda ? 'em queda' : 'sem elevação'}`;
}

/** Texto que acompanha o rótulo da faixa. */
export function resumoBacia(estacoes: EstacaoSituacao[], situacao: Situacao): string {
  if (situacao === 'normal') {
    return ressalvaBacia(estacoes) ?? 'Todos os rios dentro dos limites normais';
  }

  const count = contarLocaisNaSituacao(estacoes, situacao);
  return `Pelo menos ${count} ${count === 1 ? 'local' : 'locais'} em ${ROTULO_SITUACAO[situacao]}`;
}
