CREATE TYPE "public"."nivel_alerta" AS ENUM('atencao', 'alerta', 'emergencia');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacao" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TABLE "alertas" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descricao" text NOT NULL,
	"nivel" "nivel_alerta" NOT NULL,
	"cidade" varchar(100) NOT NULL,
	"rio" varchar(100) NOT NULL,
	"nivel_agua" varchar(20),
	"cota_referencia" varchar(20),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now(),
	"encerrado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "estacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cod_ana" varchar(20) NOT NULL,
	"cod_dcrs" varchar(20),
	"nome" varchar(100) NOT NULL,
	"nome_exibicao" varchar(100) NOT NULL,
	"rio" varchar(100) NOT NULL,
	"cidade" varchar(100) NOT NULL,
	"lat" varchar(20),
	"lng" varchar(20),
	"pos_x" varchar(10),
	"pos_y" varchar(10),
	"cota_atencao" numeric(6, 2),
	"cota_alerta" numeric(6, 2),
	"cota_emergencia" numeric(6, 2),
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "estacoes_cod_ana_unique" UNIQUE("cod_ana")
);
--> statement-breakpoint
CREATE TABLE "leituras" (
	"id" serial PRIMARY KEY NOT NULL,
	"cod_ana" varchar(20) NOT NULL,
	"nivel_cm" numeric(8, 2),
	"nivel_m" numeric(6, 3),
	"data_hora" timestamp with time zone NOT NULL,
	"fonte" varchar(20) DEFAULT 'ANA' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato" varchar(255) NOT NULL,
	"tipo" "tipo_notificacao" NOT NULL,
	"cidades" text NOT NULL,
	"nivel_minimo" "nivel_alerta" DEFAULT 'atencao' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ocorrencias" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descricao" text NOT NULL,
	"nivel" "nivel_alerta" NOT NULL,
	"cidade" varchar(100) NOT NULL,
	"rio" varchar(100) NOT NULL,
	"nivel_pico" varchar(20),
	"duracao" varchar(50),
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now()
);
