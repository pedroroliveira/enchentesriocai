import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const nivelAlertaEnum = pgEnum('nivel_alerta', ['atencao', 'alerta', 'emergencia']);
export const tipoNotificacaoEnum = pgEnum('tipo_notificacao', ['email', 'whatsapp']);

export const alertas = pgTable('alertas', {
  id: serial('id').primaryKey(),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  descricao: text('descricao').notNull(),
  nivel: nivelAlertaEnum('nivel').notNull(),
  cidade: varchar('cidade', { length: 100 }).notNull(),
  rio: varchar('rio', { length: 100 }).notNull(),
  nivelAgua: varchar('nivel_agua', { length: 20 }),
  cotaReferencia: varchar('cota_referencia', { length: 20 }),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow(),
  encerradoEm: timestamp('encerrado_em', { withTimezone: true }),
}, (table) => [
  index('alertas_ativo_criado_idx').on(table.ativo, table.criadoEm),
]);

export const ocorrencias = pgTable('ocorrencias', {
  id: serial('id').primaryKey(),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  descricao: text('descricao').notNull(),
  nivel: nivelAlertaEnum('nivel').notNull(),
  cidade: varchar('cidade', { length: 100 }).notNull(),
  rio: varchar('rio', { length: 100 }).notNull(),
  nivelPico: varchar('nivel_pico', { length: 20 }),
  duracao: varchar('duracao', { length: 50 }),
  inicio: timestamp('inicio', { withTimezone: true }).notNull(),
  fim: timestamp('fim', { withTimezone: true }),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('ocorrencias_inicio_idx').on(table.inicio),
]);

export const notificacoes = pgTable('notificacoes', {
  id: serial('id').primaryKey(),
  contato: varchar('contato', { length: 255 }).notNull(),
  tipo: tipoNotificacaoEnum('tipo').notNull(),
  cidades: text('cidades').notNull(),
  nivelMinimo: nivelAlertaEnum('nivel_minimo').notNull().default('atencao'),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('notificacoes_contato_ativo_idx').on(table.contato, table.ativo),
]);

export const estacoes = pgTable('estacoes', {
  id: serial('id').primaryKey(),
  codAna: varchar('cod_ana', { length: 20 }).notNull().unique(),
  codDcrs: varchar('cod_dcrs', { length: 20 }),
  nome: varchar('nome', { length: 100 }).notNull(),
  nomeExibicao: varchar('nome_exibicao', { length: 100 }).notNull(),
  rio: varchar('rio', { length: 100 }).notNull(),
  cidade: varchar('cidade', { length: 100 }).notNull(),
  lat: varchar('lat', { length: 20 }),
  lng: varchar('lng', { length: 20 }),
  posX: varchar('pos_x', { length: 10 }),
  posY: varchar('pos_y', { length: 10 }),
  redutorTelemetria: numeric('redutor_telemetria', { precision: 8, scale: 3 }),
  cotaAtencao: numeric('cota_atencao', { precision: 6, scale: 2 }),
  cotaAlerta: numeric('cota_alerta', { precision: 6, scale: 2 }),
  cotaEmergencia: numeric('cota_emergencia', { precision: 6, scale: 2 }),
  ativo: boolean('ativo').notNull().default(true),
});

export const leituras = pgTable('leituras', {
  id: serial('id').primaryKey(),
  codAna: varchar('cod_ana', { length: 20 }).notNull(),
  nivelCm: numeric('nivel_cm', { precision: 8, scale: 2 }),
  nivelM: numeric('nivel_m', { precision: 6, scale: 3 }),
  dataHora: timestamp('data_hora', { withTimezone: true }).notNull(),
  fonte: varchar('fonte', { length: 20 }).notNull().default('ANA'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('leituras_cod_ana_data_hora_idx').on(table.codAna, table.dataHora),
]);
