# Enchentes Vale do Caí

Monitoramento comunitário da bacia hidrográfica do Rio Caí, no Rio Grande do Sul. O site acompanha os níveis dos rios em tempo real, publica alertas e ocorrências, exibe a previsão de chuvas e permite que moradores se cadastrem para receber avisos.

Em produção: <https://enchentesvaledocai.com.br>

O projeto nasceu de uma exportação do GoDaddy Airo e foi adaptado para rodar de forma independente com Node.js, Apache e PostgreSQL.

## Como funciona

O coração do sistema é a rota `GET /api/estacoes`, que combina duas fontes de dados fluviométricos:

1. **Defesa Civil do RS (DCRS)** — API GraphQL da Rede Hidrometeorológica. É a fonte primária: rápida (~1s) e com dados de *nowcasting*, além de temperatura, umidade, pressão, vento e chuva acumulada.
2. **ANA HidroWeb** — serviço XML da Agência Nacional de Águas. É o *fallback*, usado para as estações sem código DCRS ou quando a Defesa Civil falha. É lento (15s ou mais).

As leituras são gravadas na tabela `leituras` com a origem (`DCRS` ou `ANA`), o que permite servir o último valor conhecido mesmo quando as duas fontes estão fora do ar. Um cache em memória de 2 minutos evita marretar as APIs externas: a primeira requisição após o vencimento aguarda a atualização, e as seguintes recebem o valor em cache enquanto a atualização roda em segundo plano.

O nível bruto da telemetria passa por dois ajustes antes de virar a informação exibida:

- **Redutor de telemetria** (`estacoes.redutor_telemetria`): as leituras DCRS vêm como cota absoluta e precisam do desconto do datum para virar nível fluviométrico. As leituras da ANA já são relativas à régua e não recebem o redutor.
- **Cotas de referência** (`cota_atencao`, `cota_alerta`, `cota_emergencia`): comparadas ao nível para classificar a situação em `normal`, `atencao`, `alerta` ou `emergencia`.

A tendência (`subindo` / `descendo` / `estavel`) vem do campo de variação por minuto da DCRS quando disponível; senão é calculada a partir do histórico das últimas 48 horas.

Outras fontes usadas pelo site:

- **Open-Meteo** — previsão do tempo de 7 dias (`GET /api/previsao`, cache de 1 hora).
- **INMET** — avisos meteorológicos ativos, filtrados pelo *bounding box* do Vale do Caí (`GET /api/alertas-meteo`, cache de 30 minutos).
- **Windy** — mapa meteorológico embutido na página de previsão.
- **YouTube** — câmeras ao vivo na página do mapa.

## Requisitos

- Node.js 22.12 ou superior
- PostgreSQL 14 ou superior

## Primeiros passos

```bash
npm install
cp env.example .env    # edite DATABASE_URL e as variáveis SMTP_*
npm run db:migrate     # aplica as migrações de drizzle/
npm run dev            # http://localhost:5173
```

Para popular o banco com as estações, cotas e o histórico inicial:

```bash
psql "$DATABASE_URL" -f deploy/postgresql/seed.sql
psql "$DATABASE_URL" \
  -v leituras_csv='deploy/postgresql/data/leituras.csv' \
  -f deploy/postgresql/import-leituras.sql
```

O `seed.sql` contém apenas dados públicos — estações, cotas, alertas e ocorrências. Nenhuma inscrição de e-mail ou WhatsApp é distribuída no repositório.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Compila o cliente e o *bundle* SSR do servidor |
| `npm start` | Executa o *bundle* de produção (`dist/server.bundle.mjs`) |
| `npm run preview` | Pré-visualiza o build de produção |
| `npm test` | Testes com Vitest |
| `npm run test:ui` | Interface do Vitest |
| `npm run test:coverage` | Testes com relatório de cobertura |
| `npm run type-check` | Verificação de tipos com `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Formatação com Prettier |
| `npm run audit` | Auditoria de dependências (severidade alta) |
| `npm run db:generate` | Gera uma migração a partir do schema |
| `npm run db:migrate` | Aplica as migrações pendentes |
| `npm run db:push` | Sincroniza o schema direto no banco (só em desenvolvimento) |
| `npm run clean` / `reset` | Limpa o build / limpa e reinstala |

## Estrutura

```
├── src/
│   ├── pages/                # Uma página por rota
│   │   ├── index.tsx         # Home: status dos rios, alertas, previsão
│   │   ├── mapa.tsx          # Mapa SVG da bacia + câmeras ao vivo
│   │   ├── previsao.tsx      # Previsão de 7 dias e avisos do INMET
│   │   ├── alertas.tsx       # Alertas ativos e histórico de ocorrências
│   │   ├── sobre.tsx
│   │   ├── contato.tsx
│   │   └── _404.tsx
│   ├── components/
│   │   ├── ui/               # Componentes base shadcn/ui
│   │   ├── NotificacaoForm.tsx
│   │   ├── MapaMeteoro.tsx   # Mapa Windy embutido
│   │   └── ...
│   ├── layouts/              # RootLayout, Website, Dashboard e parts/
│   ├── content/pages/        # Textos das páginas em JSON (ver abaixo)
│   ├── lib/                  # Utilidades, rotas de SEO, consentimento
│   ├── server/
│   │   ├── api/              # Rotas Express, uma pasta por caminho
│   │   ├── services/         # Integrações ANA, Defesa Civil, nível
│   │   ├── db/               # Cliente Drizzle, schema e configuração
│   │   ├── scripts/          # Scripts avulsos de diagnóstico
│   │   └── entry.ts          # Servidor Express + SSR
│   ├── entry-server.tsx      # Renderização no servidor
│   └── main.tsx              # Hidratação no cliente
├── drizzle/                  # Migrações PostgreSQL
├── deploy/                   # Configurações Apache, systemd e seed do banco
├── docs/guia-implantacao.md  # Guia de implantação
└── export-plugins/           # Plugins Vite herdados da exportação
```

### Conteúdo das páginas

Os textos fixos das páginas ficam em `src/content/pages/*.json` e são expostos ao código por um plugin Vite através do módulo virtual `virtual:content`:

```tsx
import { mapa } from 'virtual:content';

mapa.cameras.map((cam) => /* ... */);
```

Os tipos em `src/content/virtual-content.d.ts` são gerados automaticamente a partir dos JSON — não edite esse arquivo à mão.

## Rotas da API

| Rota | Descrição |
|---|---|
| `GET /api/estacoes` | Níveis, situação e tendência de todas as estações ativas |
| `GET /api/alertas` | Alertas cadastrados (`?ativo=true` filtra os vigentes) |
| `GET /api/ocorrencias` | Histórico de ocorrências |
| `GET /api/previsao` | Previsão do Open-Meteo enriquecida com dados locais da DCRS |
| `GET /api/alertas-meteo` | Avisos ativos do INMET na região |
| `POST /api/notificacoes` | Cadastro para receber alertas por e-mail ou WhatsApp |
| `POST /api/contact/:formName` | Envio dos formulários de contato via SMTP |
| `GET /api/health` | *Health check*, inclusive da conexão com o banco |
| `GET /api/ana-test` | Endpoint de depuração que devolve o XML cru da ANA |

O servidor também responde `/robots.txt`, `/sitemap.xml` e `/llms.txt`, gerados por host.

## Banco de dados

Schema em `src/server/db/schema.ts`, gerenciado com Drizzle ORM:

- **`estacoes`** — cadastro das estações: códigos ANA e DCRS, cidade, rio, coordenadas, posição no mapa SVG, redutor de telemetria e cotas de referência.
- **`leituras`** — série histórica de níveis, com a origem de cada leitura.
- **`alertas`** — alertas publicados, com nível, cidade, rio e período de vigência.
- **`ocorrencias`** — histórico de eventos passados, com nível de pico e duração.
- **`notificacoes`** — inscrições para aviso por e-mail ou WhatsApp.

## Tecnologias

**Frontend:** React 19, TypeScript 5, Vite 6, Tailwind CSS 3, shadcn/ui (sobre Radix UI), React Router 7, Motion.

**Backend:** Express 5, Drizzle ORM, PostgreSQL, Nodemailer, renderização no servidor (SSR) com hidratação no cliente.

**Ferramentas:** ESLint 9, Prettier, Vitest e Testing Library.

## Testes

```bash
npm test
```

A suíte cobre os serviços do servidor (conversão de nível, geração de `llms.txt`, `robots`/SEO por host, manifesto do AdSense) e componentes do cliente.

## Implantação

O alvo de produção é um servidor Ubuntu com Apache como *proxy reverso*, PostgreSQL local e o serviço Node gerenciado pelo systemd. O passo a passo completo — banco, TLS via Cloudflare DNS, *virtual hosts* e serviço — está em [docs/guia-implantacao.md](docs/guia-implantacao.md). O arquivo `DEPLOY-UBUNTU.md` na raiz é uma cópia do mesmo conteúdo.

O script `publicar.sh` automatiza o ciclo de publicação em uma máquina já configurada: instala as dependências, verifica os tipos, compila, sincroniza `dist/` para `/opt/enchentes-vale-do-cai/` e reinicia o serviço.

## Licença

Ainda não definida. O repositório não inclui um arquivo `LICENSE`; até que um seja adicionado, todos os direitos permanecem reservados.
