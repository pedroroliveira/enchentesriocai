-- Uso:
-- psql "$DATABASE_URL" \
--   -v leituras_csv='deploy/postgresql/data/leituras.csv' \
--   -f deploy/postgresql/import-leituras.sql
--
-- Cabeçalho esperado:
-- id,cod_ana,nivel_cm,nivel_m,data_hora,fonte,criado_em

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE leituras_importacao (
  id text,
  cod_ana text,
  nivel_cm text,
  nivel_m text,
  data_hora text,
  fonte text,
  criado_em text
) ON COMMIT DROP;

\copy leituras_importacao FROM :'leituras_csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

INSERT INTO leituras (
  id, cod_ana, nivel_cm, nivel_m, data_hora, fonte, criado_em
)
SELECT
  id::integer,
  trim(cod_ana),
  NULLIF(replace(trim(nivel_cm), ',', '.'), '')::numeric,
  NULLIF(replace(trim(nivel_m), ',', '.'), '')::numeric,
  data_hora::timestamptz,
  COALESCE(NULLIF(trim(fonte), ''), 'ANA'),
  CASE
    WHEN NULLIF(trim(criado_em), '') IS NULL THEN now()
    ELSE criado_em::timestamptz
  END
FROM leituras_importacao
ON CONFLICT (id) DO UPDATE SET
  cod_ana = EXCLUDED.cod_ana,
  nivel_cm = EXCLUDED.nivel_cm,
  nivel_m = EXCLUDED.nivel_m,
  data_hora = EXCLUDED.data_hora,
  fonte = EXCLUDED.fonte,
  criado_em = EXCLUDED.criado_em;

SELECT setval(
  pg_get_serial_sequence('leituras', 'id'),
  COALESCE((SELECT MAX(id) FROM leituras), 1),
  true
);

COMMIT;
