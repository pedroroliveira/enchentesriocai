# Leituras históricas

O arquivo `leituras.csv` foi recebido do responsável pelo site em 13/08/2026 e normalizado para CSV UTF-8 com datas ISO 8601 em UTC.

Validação realizada antes da inclusão:

- 5.644 registros, IDs de 1 a 5.647;
- lacunas de sequência nos IDs 4828, 4834 e 4839;
- nenhum ID duplicado;
- nenhuma combinação duplicada de estação e horário;
- nenhuma data inválida;
- nenhuma divergência entre `nivel_cm / 100` e `nivel_m`;
- período de 23/07/2026 00:00:00 UTC a 13/08/2026 18:47:40 UTC;
- 5.004 leituras ANA e 640 leituras DCRS.

Estações presentes no arquivo:

| Código ANA | Leituras |
|---|---:|
| 87150000 | 956 |
| 87163000 | 977 |
| 87165001 | 818 |
| 87168590 | 849 |
| 87170000 | 897 |
| 87270000 | 980 |
| 87300000 | 167 |

A estação 86748001, Rio Fão em Fontoura Xavier, não possui leituras neste CSV.
