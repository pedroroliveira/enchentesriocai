/**
 * Serviço de integração com a API GraphQL da Defesa Civil RS
 * Rede Hidrometeorológica — https://redehidrometeorologica.defesacivil.rs.gov.br/graphql
 *
 * Fornece dados em tempo real (nowcasting) das estações do Rio Caí:
 *   DCRS-00075  Nova Petrópolis/Caxias do Sul
 *   DCRS-00046  Picada Café
 *   DCRS-00085  Dois Irmãos
 *   DCRS-00069  Bom Princípio
 *   DCRS-00012  Montenegro
 *   DCRS-00031  Montenegro/Nova Santa Rita
 */

const GRAPHQL_URL = 'https://redehidrometeorologica.defesacivil.rs.gov.br/graphql';
const TIMEOUT_MS  = 12000;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface DcrsLeitura {
  codDcrs:    string;
  nomeGeral:  string;
  bacia:      string;
  lat:        number;
  lng:        number;
  /** Nível do rio em metros (normalizado) */
  nivelM:     number | null;
  /** Tendência: variação de nível por minuto */
  tendenciaRaw: number | null;
  /** Chuva acumulada 1h em mm */
  chuva1h:    number | null;
  /** Chuva acumulada 24h em mm */
  chuva24h:   number | null;
  /** Chuva acumulada 7 dias em mm */
  chuva7d:    number | null;
  /** Temperatura atual em °C */
  temperatura: number | null;
  /** Umidade relativa em % */
  umidade:    number | null;
  /** Pressão atmosférica em hPa */
  pressao:    number | null;
  /** Velocidade do vento em km/h */
  ventoVel:   number | null;
  /** Direção do vento em graus */
  ventoDir:   number | null;
  /** Sensação térmica em °C */
  sensTerm:   number | null;
  /** Timestamp da leitura (ISO em UTC) */
  timestamp:  string | null;
  /** Indica se a estação tem sensor de nível */
  temNivel:   boolean;
  /** Indica se a estação tem sensor de chuva */
  temChuva:   boolean;
}

// ─── Query GraphQL ───────────────────────────────────────────────────────────
// Desde 14/10/2026 a API só aceita o texto exato das consultas do guia oficial
// ("Tags_data" ou "Historic"); qualquer outra volta HTTP 400 QUERY_NOT_ALLOWED.
// O texto abaixo é o mesmo que o próprio site da rede envia — não editar
// campos nem acrescentar filtros (o servidor só ignora diferenças de espaço).
// Ela devolve todas as estações do estado; as do Caí são filtradas no cliente.

const QUERY_TAGS_DATA = `
  query Tags_data {
    tags_data(clients: ["casa-militar-defesa-civil-rs"]) {
         qualle_meteorologia {
            codigo
            name {
                prefix
                general
                local
            }
            show
            timestamp
            position {
                bacia
                latitude
                longitude
                regiao
                altitude
                filtros {
                    outros {
                        crepdec {
                            nome {
                                value
                            }
                            codigo {
                                value
                            }
                        }
                    }
                }
            }
            data {
                rio {
                    rio_alarmes {
                        inundacao {
                            ativo {
                                value
                            }
                            status {
                                value
                            }
                        }
                    }
                    rio_nome {
                        value
                    }
                    rio_nivel {
                        value
                    }
                    rio_nivel_tendencia {
                        value
                    }
                    rio_area_drenagem {
                        value
                    }
                    homologacao {
                        relacao {
                            valido {
                                value
                            }
                        }
                    }
                }
                chuva {
                    acumulado {
                        min005 {
                            value
                        }
                        h001 {
                            value
                        }
                        h003 {
                            value
                        }
                        h006 {
                            value
                        }
                        h012 {
                            value
                        }
                        h024 {
                            value
                        }
                        h048 {
                            value
                        }
                        h168 {
                            value
                        }
                    }
                    homologacao {
                        relacao {
                            valido {
                                value
                            }
                        }
                    }
                }
                pressaoatmos {
                    atual {
                        value
                    }
                    historico {
                        diaanterior {
                            media {
                                value
                            }
                        }
                        diaatual {
                            media {
                                value
                            }
                        }
                    }
                    tendencia {
                        value
                    }
                    homologacao {
                        relacao {
                            valido {
                                value
                            }
                        }
                    }
                }
                senstermica {
                    atual {
                        value
                    }
                    historico {
                        diaatual {
                            media {
                                value
                            }
                        }
                        diaanterior {
                            media {
                                value
                            }
                        }
                    }
                    tendencia {
                        value
                    }
                    homologacao {
                        relacao {
                            valido {
                                value
                            }
                        }
                    }
                }
                radiacaosolar {
                    atual {
                        value
                    }
                    homologacao {
                        relacao {
                            valido {
                                value
                            }
                        }
                    }
                }
                temperatura {
                    atual {
                        value
                    }
                    historico {
                        diaanterior {
                            media {
                                value
                            }
                        }
                        diaatual {
                            media {
                                value
                            }
                            maxima {
                                value
                            }
                            minima {
                                value
                            }
                        }
                    }
                    tendencia {
                        value
                    }
                    homologacao {
                        relacao {
                            valido {
                                value
                            }
                        }
                    }
                }
                umidade {
                    atual {
                        value
                    }
                    historico {
                        diaanterior {
                            media {
                                value
                            }
                        }
                        diaatual {
                            media {
                                value
                            }
                        }
                    }
                    tendencia {
                        value
                    }
                    homologacao {
                        relacao {
                            valido {
                                value
                            }
                        }
                    }
                }
                vento {
                    direcao {
                        value
                    }
                    velocidade_maxima {
                        value
                    }
                    velocidade_media {
                        value
                    }
                    homologacao {
                        relacao {
                            valido {
                                value
                            }
                        }
                    }
                }
            }
            type
            filter {
                relacao {
                    tem_chuva_acumulada
                    tem_nivel_do_rio
                    tem_pressao_atmosferica
                    tem_sensacao_termica
                    tem_umidade
                    tem_vazao_do_rio
                    tem_vento
                }
            }
            resource {
                estacao {
                    estado {
                        manutencao {
                            value
                        }
                    }
                }
            }
        }
        proximaAtualizacaoEm
    }
  }
`;

const ESTACOES_CAI = new Set([
  'DCRS-00075', 'DCRS-00046', 'DCRS-00085', 'DCRS-00069', 'DCRS-00012', 'DCRS-00031',
]);

// ─── Normalização de nível ───────────────────────────────────────────────────
// A API retorna unidades inconsistentes por estação:
//   Em METROS:      DCRS-00012 (Montenegro), DCRS-00031 (Montenegro/NSR), DCRS-00069 (Bom Princípio)
//   Em CENTÍMETROS: DCRS-00075 (Nova Petrópolis), DCRS-00046 (Picada Café), DCRS-00085 (Dois Irmãos)
//
// ATENÇÃO: DCRS-00069 (Bom Princípio) retorna metros com datum alto (~16m) —
// incompatível com a cota da ANA em Feliz. Não mapear Feliz → DCRS-00069.

const ESTACOES_EM_CM = new Set(['DCRS-00075', 'DCRS-00046', 'DCRS-00085']);

function normalizarNivelParaMetros(codDcrs: string, valor: number | null): number | null {
  if (valor === null || valor === undefined) return null;
  if (ESTACOES_EM_CM.has(codDcrs)) {
    return Math.round((valor / 100) * 1000) / 1000; // cm → m
  }
  return Math.round(valor * 1000) / 1000; // já em metros
}

// ─── Timestamp ───────────────────────────────────────────────────────────────

/**
 * A API passou a devolver `timestamp` no horário de Brasília sem fuso
 * (ex.: "2026-11-03T20:25:00.000"). Lido no fuso do servidor (UTC), a leitura
 * ficaria 3 horas no passado — mesmo problema já tratado nas datas da ANA.
 * Valores que já trazem `Z` ou offset são respeitados.
 */
export function parseTimestampDcrs(texto: string): Date | null {
  const t = texto.trim();
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/i.test(t);
  const data = new Date(temFuso ? t : `${t}-03:00`);
  return isNaN(data.getTime()) ? null : data;
}

// ─── Fetch principal ─────────────────────────────────────────────────────────

export async function fetchEstacoesDefesaCivil(): Promise<DcrsLeitura[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resp: globalThis.Response;
  try {
    resp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY_TAGS_DATA }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) throw new Error(`Defesa Civil GraphQL HTTP ${resp.status}`);

  const json = await resp.json() as {
    data?: {
      tags_data?: {
        qualle_meteorologia?: Array<{
          codigo: string;
          timestamp?: string;
          name: { general: string; local: string };
          position: { bacia: string; latitude: number; longitude: number };
          data: {
            rio?: { rio_nivel?: { value: number | null }; rio_nivel_tendencia?: { value: number | null } };
            chuva?: { acumulado?: { h001?: { value: number | null }; h024?: { value: number | null }; h168?: { value: number | null } } };
            temperatura?: { atual?: { value: number | null } };
            umidade?: { atual?: { value: number | null } };
            pressaoatmos?: { atual?: { value: number | null } };
            vento?: { velocidade_media?: { value: number | null }; direcao?: { value: number | null } };
            senstermica?: { atual?: { value: number | null } };
          };
          filter: { relacao: { tem_nivel_do_rio: boolean; tem_chuva_acumulada: boolean } };
        }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }

  const estacoes = json.data?.tags_data?.qualle_meteorologia ?? [];

  return estacoes.filter((e) => ESTACOES_CAI.has(e.codigo)).map((e) => {
    const nivelRaw = e.data.rio?.rio_nivel?.value ?? null;
    return {
      codDcrs:      e.codigo,
      nomeGeral:    e.name.general.trim(),
      bacia:        e.position.bacia,
      lat:          e.position.latitude,
      lng:          e.position.longitude,
      nivelM:       normalizarNivelParaMetros(e.codigo, nivelRaw),
      tendenciaRaw: e.data.rio?.rio_nivel_tendencia?.value ?? null,
      chuva1h:      e.data.chuva?.acumulado?.h001?.value ?? null,
      chuva24h:     e.data.chuva?.acumulado?.h024?.value ?? null,
      chuva7d:      e.data.chuva?.acumulado?.h168?.value ?? null,
      temperatura:  e.data.temperatura?.atual?.value ?? null,
      umidade:      e.data.umidade?.atual?.value ?? null,
      pressao:      e.data.pressaoatmos?.atual?.value ?? null,
      ventoVel:     e.data.vento?.velocidade_media?.value ?? null,
      ventoDir:     e.data.vento?.direcao?.value ?? null,
      sensTerm:     e.data.senstermica?.atual?.value ?? null,
      timestamp:    e.timestamp ? parseTimestampDcrs(e.timestamp)?.toISOString() ?? null : null,
      temNivel:     e.filter.relacao.tem_nivel_do_rio,
      temChuva:     e.filter.relacao.tem_chuva_acumulada,
    };
  });
}
