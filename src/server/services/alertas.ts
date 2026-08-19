/**
 * Alertas ativos do Vale do Caí
 *
 * Os alertas não são mais cadastrados à mão: eles são derivados das leituras
 * em tempo real das estações (`getEstacoes`), comparando o nível medido com as
 * cotas de atenção/alerta/emergência já configuradas em cada estação. Assim o
 * alerta nasce e desaparece junto com o rio, sem depender de ninguém encerrar
 * o registro.
 *
 * Quem decide se a leitura vira aviso é `sustentaAviso` (src/lib/bacia), a
 * mesma regra da faixa de situação no topo da home: atenção só com o nível em
 * elevação, alerta e emergência sempre.
 *
 * A tabela `alertas` continua existindo para avisos manuais (um comunicado da
 * Defesa Civil, por exemplo). As duas fontes são unidas nesta camada.
 */

import { db } from '../db/client.js';
import { alertas as alertasTable } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { getEstacoes, type LeituraEstacao } from './ana.js';
import { sustentaAviso } from '../../lib/bacia';

export type NivelAlerta = 'atencao' | 'alerta' | 'emergencia';

export interface AlertaAtivo {
  id: string;
  titulo: string;
  descricao: string;
  nivel: NivelAlerta;
  cidade: string;
  rio: string;
  nivelAgua: string | null;
  cotaReferencia: string | null;
  ativo: boolean;
  criadoEm: string;
  encerradoEm: string | null;
  origem: 'estacao' | 'manual';
}

/**
 * Leitura mais velha que isto não sustenta alerta: estação muda, sensor cai, e
 * um dado parado de ontem não descreve o rio de agora.
 */
export const LEITURA_MAX_IDADE_MS = 6 * 60 * 60 * 1000; // 6 horas

const SEVERIDADE: Record<NivelAlerta, number> = { emergencia: 3, alerta: 2, atencao: 1 };

const TEXTO_NIVEL: Record<NivelAlerta, { rotulo: string; acao: string }> = {
  atencao: {
    rotulo: 'atenção',
    acao: 'Moradores de áreas ribeirinhas devem acompanhar a evolução do nível.',
  },
  alerta: {
    rotulo: 'alerta',
    acao: 'Moradores de áreas ribeirinhas devem preparar a remoção de bens e seguir as orientações da Defesa Civil.',
  },
  emergencia: {
    rotulo: 'emergência',
    acao: 'Deixe as áreas de risco e siga imediatamente as orientações da Defesa Civil.',
  },
};

const TEXTO_TENDENCIA: Record<LeituraEstacao['tendencia'], string> = {
  subindo:  'em elevação',
  descendo: 'em queda',
  estavel:  'estável',
};

/** Mesmo formato dos cards de nível: metros com vírgula decimal. */
function formatarMetros(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

/** Cota que a estação cruzou para chegar naquela situação. */
function cotaDaSituacao(est: LeituraEstacao, nivel: NivelAlerta): number | null {
  if (nivel === 'emergencia') return est.cotaEmergencia;
  if (nivel === 'alerta')     return est.cotaAlerta;
  return est.cotaAtencao;
}

/**
 * Converte as estações fora do normal em alertas. Função pura — recebe as
 * leituras e o instante de referência, para poder ser testada.
 */
export function derivarAlertas(estacoes: LeituraEstacao[], agora: Date = new Date()): AlertaAtivo[] {
  const derivados: AlertaAtivo[] = [];

  for (const est of estacoes) {
    if (!sustentaAviso(est) || est.nivelM === null) continue;

    // Sem hora da leitura não dá para saber se o dado ainda vale.
    if (!est.dataHora) continue;
    const medidoEm = new Date(est.dataHora);
    if (Number.isNaN(medidoEm.getTime())) continue;
    if (agora.getTime() - medidoEm.getTime() > LEITURA_MAX_IDADE_MS) continue;

    const nivel = est.situacao as NivelAlerta;
    const texto = TEXTO_NIVEL[nivel];
    const cota  = cotaDaSituacao(est, nivel);

    const trechoCota = cota !== null ? ` (${formatarMetros(cota)}m)` : '';

    derivados.push({
      id:    `estacao-${est.codAna}`,
      titulo: `Nível de ${texto.rotulo} — ${est.cidade}`,
      descricao:
        `O ${est.rio} em ${est.cidade} está em ${formatarMetros(est.nivelM)}m, ` +
        `acima da cota de ${texto.rotulo}${trechoCota}. ` +
        `Nível ${TEXTO_TENDENCIA[est.tendencia]} na estação ${est.nomeExibicao}. ${texto.acao}`,
      nivel,
      cidade: est.cidade,
      rio:    est.rio,
      nivelAgua:      formatarMetros(est.nivelM),
      cotaReferencia: cota !== null ? formatarMetros(cota) : null,
      ativo:      true,
      criadoEm:   medidoEm.toISOString(),
      encerradoEm: null,
      origem:     'estacao',
    });
  }

  return ordenarAlertas(derivados);
}

/** Mais grave primeiro; empate desempata pela leitura mais recente. */
export function ordenarAlertas(lista: AlertaAtivo[]): AlertaAtivo[] {
  return [...lista].sort((a, b) => {
    const porGravidade = SEVERIDADE[b.nivel] - SEVERIDADE[a.nivel];
    if (porGravidade !== 0) return porGravidade;
    return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
  });
}

/** Avisos cadastrados à mão que ainda estão abertos. */
async function buscarAlertasManuais(): Promise<AlertaAtivo[]> {
  const rows = await db
    .select()
    .from(alertasTable)
    .where(eq(alertasTable.ativo, true))
    .orderBy(desc(alertasTable.criadoEm));

  return rows.map((row) => ({
    id:    `manual-${row.id}`,
    titulo: row.titulo,
    descricao: row.descricao,
    nivel:  row.nivel as NivelAlerta,
    cidade: row.cidade,
    rio:    row.rio,
    nivelAgua:      row.nivelAgua,
    cotaReferencia: row.cotaReferencia,
    ativo:      true,
    criadoEm:   (row.criadoEm ?? new Date()).toISOString(),
    encerradoEm: row.encerradoEm ? row.encerradoEm.toISOString() : null,
    origem:     'manual',
  }));
}

/**
 * Alertas ativos agora: os derivados das estações mais os avisos manuais.
 * Uma falha na leitura das estações não pode esconder um aviso manual, e
 * vice-versa — por isso as duas fontes são resolvidas de forma independente.
 */
export async function getAlertasAtivos(): Promise<AlertaAtivo[]> {
  const [estacoesRes, manuaisRes] = await Promise.allSettled([
    getEstacoes(),
    buscarAlertasManuais(),
  ]);

  if (estacoesRes.status === 'rejected' && manuaisRes.status === 'rejected') {
    throw estacoesRes.reason;
  }

  const derivados = estacoesRes.status === 'fulfilled' ? derivarAlertas(estacoesRes.value) : [];
  const manuais   = manuaisRes.status === 'fulfilled' ? manuaisRes.value : [];

  return ordenarAlertas([...derivados, ...manuais]);
}
