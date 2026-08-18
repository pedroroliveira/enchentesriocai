-- Estações, cotas, alerta e ocorrências fornecidos pelo responsável pelo site em 13/08/2026.
-- Este arquivo não contém inscrições privadas de e-mail ou WhatsApp.

BEGIN;

INSERT INTO estacoes (
  id, cod_ana, cod_dcrs, nome, nome_exibicao, rio, cidade, lat, lng,
  pos_x, pos_y, cota_atencao, cota_alerta, cota_emergencia, ativo
) VALUES
  (8, '86748001', NULL, 'Rio Fão (Fontoura Xavier)', 'Rio Fão (Fontoura Xavier)', 'Rio Fão', 'Fontoura Xavier', '-28.9800', '-52.3400', '38', '25', 2.00, 3.00, 4.50, true),
  (1, '87150000', 'DCRS-00075', 'Linha Gonzaga', 'Linha Gonzaga', 'Rio Caí', 'Caxias do Sul', '-29.1200', '-51.1800', '52', '15', 2.50, 3.50, 5.00, true),
  (2, '87163000', 'DCRS-00085', 'Vale Real', 'Vale Real', 'Rio Caí', 'Vale Real', '-29.3700', '-51.2700', '46', '22', 2.80, 4.00, 5.50, true),
  (3, '87165001', NULL, 'Feliz', 'Feliz', 'Rio Caí', 'Feliz', '-29.4500', '-51.3000', '36', '28', 3.00, 4.50, 6.00, true),
  (4, '87168590', NULL, 'Bom Princípio', 'Bom Princípio', 'Rio Caí', 'Bom Princípio', '-29.4800', '-51.3500', '30', '33', 3.20, 4.80, 6.50, true),
  (5, '87170000', NULL, 'São Sebastião do Caí', 'São Sebastião do Caí', 'Rio Caí', 'São Sebastião do Caí', '-29.5900', '-51.3800', '24', '40', 3.50, 5.50, 7.50, true),
  (6, '87270000', 'DCRS-00012', 'Montenegro', 'Montenegro', 'Rio Caí', 'Montenegro', '-29.6800', '-51.4600', '18', '50', 4.00, 6.00, 8.00, true),
  (7, '87300000', 'DCRS-00031', 'Triunfo', 'Triunfo', 'Rio Caí', 'Triunfo', '-29.8400', '-51.7200', '12', '62', 4.50, 7.00, 9.00, true)
ON CONFLICT (cod_ana) DO UPDATE SET
  id = EXCLUDED.id,
  cod_dcrs = EXCLUDED.cod_dcrs,
  nome = EXCLUDED.nome,
  nome_exibicao = EXCLUDED.nome_exibicao,
  rio = EXCLUDED.rio,
  cidade = EXCLUDED.cidade,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  pos_x = EXCLUDED.pos_x,
  pos_y = EXCLUDED.pos_y,
  cota_atencao = EXCLUDED.cota_atencao,
  cota_alerta = EXCLUDED.cota_alerta,
  cota_emergencia = EXCLUDED.cota_emergencia,
  ativo = EXCLUDED.ativo;

INSERT INTO alertas (
  id, titulo, descricao, nivel, cidade, rio, nivel_agua,
  cota_referencia, ativo, criado_em, encerrado_em
) VALUES (
  1,
  'Nível de atenção atingido — Montenegro',
  'O Rio Caí em Montenegro atingiu a cota de atenção (4,0m). Moradores de áreas ribeirinhas devem ficar em alerta.',
  'atencao', 'Montenegro', 'Rio Caí', '4.15', '4.0', true,
  '2026-07-30T22:04:58-03:00', NULL
)
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descricao = EXCLUDED.descricao,
  nivel = EXCLUDED.nivel,
  cidade = EXCLUDED.cidade,
  rio = EXCLUDED.rio,
  nivel_agua = EXCLUDED.nivel_agua,
  cota_referencia = EXCLUDED.cota_referencia,
  ativo = EXCLUDED.ativo,
  criado_em = EXCLUDED.criado_em,
  encerrado_em = EXCLUDED.encerrado_em;

INSERT INTO ocorrencias (
  id, titulo, descricao, nivel, cidade, rio, nivel_pico,
  duracao, inicio, fim, criado_em
) VALUES
  (1, 'Enchente — Montenegro', 'Cheia do Rio Caí atingiu cota de alerta. Aproximadamente 120 famílias afetadas nas áreas de várzea. Defesa Civil atuou com remoção preventiva.', 'alerta', 'Montenegro', 'Rio Caí', '7,2m', '4 dias', '2024-09-12T00:00:00-03:00', '2024-09-16T00:00:00-03:00', '2026-07-30T22:04:58-03:00'),
  (2, 'Inundação — São Sebastião do Caí', 'Chuvas intensas causaram elevação rápida do Rio Caí. Centro histórico parcialmente alagado. 45 famílias desalojadas.', 'alerta', 'São Sebastião do Caí', 'Rio Caí', '6,8m', '2 dias', '2024-06-03T00:00:00-03:00', '2024-06-05T00:00:00-03:00', '2026-07-30T22:04:58-03:00'),
  (3, 'Atenção — Rio Fão em Feliz', 'Rio Fão atingiu cota de atenção após chuvas de 80mm em 24h na Serra. Sem danos registrados.', 'atencao', 'Feliz', 'Rio Fão', '4,2m', '18 horas', '2024-04-20T00:00:00-03:00', '2024-04-21T00:00:00-03:00', '2026-07-30T22:04:58-03:00'),
  (4, 'Emergência histórica do Caí', 'Maior cheia registrada nos últimos 20 anos. Rio Caí atingiu 9,4m em Montenegro. Mais de 800 famílias afetadas. Estado de calamidade decretado.', 'emergencia', 'Montenegro', 'Rio Caí', '9,4m', '8 dias', '2023-09-04T00:00:00-03:00', '2023-09-12T00:00:00-03:00', '2026-07-30T22:04:58-03:00'),
  (5, 'Alerta — Triunfo e São Jerônimo', 'Baixo Caí em situação de alerta. Áreas de várzea inundadas. Rodovias interditadas.', 'alerta', 'Triunfo', 'Rio Caí', '8,1m', '3 dias', '2023-09-05T00:00:00-03:00', '2023-09-08T00:00:00-03:00', '2026-07-30T22:04:58-03:00')
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descricao = EXCLUDED.descricao,
  nivel = EXCLUDED.nivel,
  cidade = EXCLUDED.cidade,
  rio = EXCLUDED.rio,
  nivel_pico = EXCLUDED.nivel_pico,
  duracao = EXCLUDED.duracao,
  inicio = EXCLUDED.inicio,
  fim = EXCLUDED.fim,
  criado_em = EXCLUDED.criado_em;

SELECT setval(pg_get_serial_sequence('alertas', 'id'), COALESCE(MAX(id), 1), true) FROM alertas;
SELECT setval(pg_get_serial_sequence('ocorrencias', 'id'), COALESCE(MAX(id), 1), true) FROM ocorrencias;
SELECT setval(pg_get_serial_sequence('estacoes', 'id'), COALESCE(MAX(id), 1), true) FROM estacoes;

COMMIT;
