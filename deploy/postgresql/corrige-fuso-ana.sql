-- Corrige o fuso horário das leituras da ANA gravadas antes da correção em
-- src/server/services/ana.ts (parseDataHoraAna).
--
-- A ANA publica a hora no horário de Brasília sem indicar o fuso, e o
-- servidor (UTC) a interpretava como UTC: toda leitura ANA ficou gravada
-- 3 horas antes do instante real. Este script adianta essas leituras 3 h.
--
-- Rode ANTES de publicar a versão corrigida, e publique logo em seguida:
--
--   psql "$DATABASE_URL" -f deploy/postgresql/corrige-fuso-ana.sql
--
-- Nesse intervalo o código antigo apenas deixa de gravar leituras ANA (elas
-- parecem 3 h mais velhas que as já corrigidas) — nada se perde, a versão
-- nova recupera as que faltarem.
--
-- É seguro rodar mais de uma vez (a correção fica registrada em
-- correcoes_dados) e também depois de publicar: só são deslocadas as linhas
-- com a assinatura do erro — gravadas 2h30 ou mais depois da hora da leitura,
-- quando o atraso real da ANA é de 15 a 40 min — e cópias que coincidirem
-- com leituras já gravadas pela versão nova são removidas.

BEGIN;

CREATE TABLE IF NOT EXISTS correcoes_dados (
  nome        varchar(100) PRIMARY KEY,
  aplicada_em timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  deslocadas integer;
  removidas  integer;
BEGIN
  IF EXISTS (SELECT 1 FROM correcoes_dados WHERE nome = 'ana-fuso-horario') THEN
    RAISE NOTICE 'Correção ana-fuso-horario já aplicada — nada a fazer.';
    RETURN;
  END IF;

  UPDATE leituras
     SET data_hora = data_hora + interval '3 hours'
   WHERE fonte = 'ANA'
     AND criado_em - data_hora >= interval '2 hours 30 minutes';
  GET DIAGNOSTICS deslocadas = ROW_COUNT;

  -- Mesma estação e mesmo instante: fica a linha mais nova.
  DELETE FROM leituras a
   USING leituras b
   WHERE a.fonte = 'ANA' AND b.fonte = 'ANA'
     AND a.cod_ana = b.cod_ana
     AND a.data_hora = b.data_hora
     AND a.id < b.id;
  GET DIAGNOSTICS removidas = ROW_COUNT;

  INSERT INTO correcoes_dados (nome) VALUES ('ana-fuso-horario');
  RAISE NOTICE 'Leituras ANA adiantadas 3 h: %, duplicadas removidas: %', deslocadas, removidas;
END $$;

COMMIT;
