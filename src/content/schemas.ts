import { z } from 'zod';
export const schemas = {
  home: z.object({
    "statusBanner": z.object({
      "nivel": z.string(),
      "mensagem": z.string(),
      "atualizadoEm": z.string()
    }),
    "hero": z.object({
      "titulo": z.string(),
      "subtitulo": z.string(),
      "ctaLabel": z.string(),
      "ctaHref": z.string()
    }),
    "rios": z.array(z.object({
      "id": z.string(),
      "nome": z.string(),
      "cidade": z.string(),
      "nivel": z.string(),
      "unidade": z.string(),
      "variacao": z.string(),
      "tendencia": z.string(),
      "situacao": z.string(),
      "cota_atencao": z.string(),
      "cota_alerta": z.string(),
      "cota_emergencia": z.string()
    })),
    "alertas": z.object({
      "temAlerta": z.boolean(),
      "mensagemSemAlerta": z.string(),
      "lista": z.array(z.unknown())
    }),
    "previsao": z.array(z.object({
      "id": z.string(),
      "dia": z.string(),
      "data": z.string(),
      "condicao": z.string(),
      "chuva_mm": z.string(),
      "impacto": z.string(),
      "descricao": z.string()
    })),
    "cta": z.object({
      "titulo": z.string(),
      "descricao": z.string(),
      "placeholderEmail": z.string(),
      "botaoLabel": z.string()
    })
  }),
  mapa: z.object({
    "cameras": z.array(z.object({
      "id": z.string(),
      "titulo": z.string(),
      "embedId": z.string()
    }))
  }),
  previsao: z.object({
    "hero": z.object({
      "titulo": z.string(),
      "subtitulo": z.string()
    }),
    "fontes": z.array(z.object({
      "id": z.string(),
      "nome": z.string(),
      "descricao": z.string(),
      "url": z.string()
    }))
  }),
  alertas: z.object({
    "hero": z.object({
      "titulo": z.string(),
      "subtitulo": z.string()
    }),
    "cidades": z.array(z.object({
      "id": z.string(),
      "nome": z.string()
    }))
  }),
  sobre: z.object({
    "hero": z.object({
      "titulo": z.string(),
      "subtitulo": z.string()
    }),
    "missao": z.object({
      "titulo": z.string(),
      "texto": z.string(),
      "valores": z.array(z.object({
        "id": z.string(),
        "titulo": z.string(),
        "descricao": z.string()
      }))
    }),
    "cobertura": z.object({
      "titulo": z.string(),
      "descricao": z.string(),
      "estatisticas": z.array(z.object({
        "id": z.string(),
        "valor": z.string(),
        "unidade": z.string(),
        "label": z.string()
      })),
      "municipiosPrincipais": z.array(z.object({
        "id": z.string(),
        "nome": z.string(),
        "regiao": z.string()
      }))
    }),
    "fontesDados": z.object({
      "titulo": z.string(),
      "descricao": z.string(),
      "fontes": z.array(z.object({
        "id": z.string(),
        "nome": z.string(),
        "descricao": z.string(),
        "url": z.string(),
        "tipo": z.string()
      }))
    }),
    "tecnologia": z.object({
      "titulo": z.string(),
      "descricao": z.string(),
      "itens": z.array(z.object({
        "id": z.string(),
        "nome": z.string(),
        "detalhe": z.string()
      }))
    }),
    "contato": z.object({
      "titulo": z.string(),
      "descricao": z.string(),
      "email": z.string(),
      "github": z.string(),
      "aviso": z.string()
    })
  }),
  contato: z.object({
    "hero": z.object({
      "titulo": z.string(),
      "subtitulo": z.string()
    }),
    "info": z.object({
      "email": z.string(),
      "regiao": z.string(),
      "tempoResposta": z.string()
    }),
    "emergencias": z.array(z.object({
      "id": z.string(),
      "label": z.string(),
      "numero": z.string()
    })),
    "formulario": z.object({
      "titulo": z.string(),
      "placeholderNome": z.string(),
      "placeholderEmail": z.string(),
      "placeholderMensagem": z.string(),
      "botaoEnviar": z.string(),
      "sucessoTitulo": z.string(),
      "sucessoDescricao": z.string(),
      "privacidade": z.string()
    })
  })
};
export type Schemas = typeof schemas;