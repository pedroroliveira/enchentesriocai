-- Corrige as cotas de Bom Princípio (ANA 87168590), São Sebastião do Caí
-- (ANA 87170000, Barca do Caí) e Montenegro (ANA 87270000).
--
-- Bom Princípio e São Sebastião do Caí tinham cota de atenção abaixo do
-- nível de base da régua da ANA e apareciam em "Atenção" com o rio baixo
-- (Bom Princípio passou 95,6% do tempo acima de 3,50 m entre jul e nov/2026;
-- o mínimo registrado foi 3,34 m).
--
--   São Sebastião do Caí: cotas oficiais do SGB/SAH-Caí para Barca do Caí —
--     atenção 500 cm, alerta 700 cm, inundação 1050 cm.
--   Montenegro (Passo Montenegro, 87270000): cotas oficiais do SACE Caí
--     (07/2022) — atenção 300 cm, alerta 400 cm, inundação 600 cm. As
--     cotas antigas (4/6/8 m) só marcavam "Alerta" quando a cidade já
--     começava a alagar. A régua da DC acompanha a da ANA (medianas
--     2,15 m × 2,23 m), então valem para a leitura DCRS-00012.
--   Bom Princípio: valores PROVISÓRIOS a partir do histórico de leituras
--     (base 3,3–3,8 m; cheias de 10,19 m e 12,98 m em set/2026). A régua é a
--     mesma do SGB (621 cm no boletim de 29/09 07h = 6,21 m na ANA), então
--     substituir pelas cotas oficiais do SGB/Defesa Civil assim que obtidas.
--
--   psql "$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" \
--     -f deploy/postgresql/corrige-cotas-estacoes.sql
--
-- É seguro rodar mais de uma vez.

BEGIN;

UPDATE estacoes
   SET cota_atencao = 6.00, cota_alerta = 8.00, cota_emergencia = 10.00
 WHERE cod_ana = '87168590';

UPDATE estacoes
   SET cota_atencao = 5.00, cota_alerta = 7.00, cota_emergencia = 10.50
 WHERE cod_ana = '87170000';

UPDATE estacoes
   SET cota_atencao = 3.00, cota_alerta = 4.00, cota_emergencia = 6.00
 WHERE cod_ana = '87270000';

SELECT cod_ana, nome_exibicao, cota_atencao, cota_alerta, cota_emergencia
  FROM estacoes
 WHERE cod_ana IN ('87168590', '87170000', '87270000')
 ORDER BY cod_ana;

COMMIT;
