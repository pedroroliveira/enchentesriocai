import { describe, it, expect } from 'vitest';
import { projetarNivel, removerPicosIsolados, type PontoNivel } from '../projecao';

const HORA = 60 * 60 * 1000;
const BASE = Date.UTC(2026, 8, 28, 12, 0, 0);

/** Leituras a cada `min` minutos nas últimas `horas`, seguindo `nivel(h)`. */
function serie(horas: number, nivel: (h: number) => number, min = 15): PontoNivel[] {
  const pontos: PontoNivel[] = [];
  for (let m = -horas * 60; m <= 0; m += min) {
    pontos.push({ t: BASE + m * 60 * 1000, nivelM: nivel(m / 60) });
  }
  return pontos;
}

const fim = (p: PontoNivel[]) => p[p.length - 1];

describe('projetarNivel', () => {
  it('segue uma subida constante, perdendo força aos poucos', () => {
    const proj = projetarNivel(serie(12, h => 3 + 0.1 * h))!;
    expect(proj[0]).toEqual({ t: BASE, nivelM: 3 });
    expect(fim(proj).t).toBe(BASE + 6 * HORA);
    // Uma reta daria 3,60 m; o amortecimento deixa a projeção um pouco abaixo.
    expect(fim(proj).nivelM).toBeGreaterThan(3.45);
    expect(fim(proj).nivelM).toBeLessThan(3.6);
  });

  it('é uma curva, não uma reta: cada hora sobe menos que a anterior', () => {
    const proj = projetarNivel(serie(12, h => 3 + 0.1 * h))!;
    const porHora = proj.filter(p => (p.t - BASE) % HORA === 0);
    const subidas = porHora.slice(1).map((p, i) => p.nivelM - porHora[i].nivelM);
    for (let i = 1; i < subidas.length; i++) expect(subidas[i]).toBeLessThan(subidas[i - 1]);
  });

  it('acompanha a aceleração da cheia melhor que a média das últimas horas', () => {
    // Subida que acelera: 0,02 m/h há 6 h, 0,3 m/h agora.
    const proj = projetarNivel(serie(24, h => 2 + 0.3 * h + 0.0233 * h * h))!;
    // A reta dos últimos 3 h daria taxa média ≈ 0,23 m/h.
    const taxaInicial = (proj[2].nivelM - proj[0].nivelM) / 1;
    expect(taxaInicial).toBeGreaterThan(0.23);
  });

  it('projeta descida e estabilidade', () => {
    expect(fim(projetarNivel(serie(12, h => 5 - 0.05 * h))!).nivelM).toBeLessThan(5);
    expect(projetarNivel(serie(12, () => 1.5))!.every(p => p.nivelM === 1.5)).toBe(true);
  });

  it('funciona com estações de leitura horária', () => {
    const proj = projetarNivel(serie(24, h => 4 + 0.08 * h, 60))!;
    expect(fim(proj).nivelM).toBeGreaterThan(4.3);
  });

  it('ignora leitura espúria isolada', () => {
    const leituras = serie(12, () => 1);
    leituras[leituras.length - 5] = { ...leituras[leituras.length - 5], nivelM: -30 };
    expect(projetarNivel(leituras)!.every(p => p.nivelM === 1)).toBe(true);
  });

  it('parte da última leitura, mesmo com ruído', () => {
    const leituras = serie(6, h => 2 - 0.05 * h).map((p, i) => ({ ...p, nivelM: p.nivelM + (i % 2 ? 0.02 : -0.02) }));
    expect(projetarNivel(leituras)![0].nivelM).toBe(fim(leituras).nivelM);
  });

  it('nunca projeta nível negativo', () => {
    const proj = projetarNivel(serie(6, h => 0.2 - 0.1 * h))!;
    expect(Math.min(...proj.map(p => p.nivelM))).toBe(0);
  });

  it('termina exatamente no fim do horizonte, mesmo fora do passo', () => {
    const horizonte = 6 * HORA + 20 * 60 * 1000;
    const proj = projetarNivel(serie(6, h => 2 + 0.1 * h), { horizonteMs: horizonte })!;
    expect(fim(proj).t).toBe(BASE + horizonte);
    expect(proj[proj.length - 2].t).toBe(BASE + 6 * HORA);
    expect(fim(proj).nivelM).toBeGreaterThan(proj[proj.length - 2].nivelM);
  });

  it('não projeta sem leituras recentes suficientes', () => {
    expect(projetarNivel([])).toBeNull();
    expect(projetarNivel([{ t: BASE - HORA, nivelM: 1 }, { t: BASE, nivelM: 1.1 }])).toBeNull();
    // Muitas leituras, mas cobrindo só 30 min.
    expect(projetarNivel(serie(0.5, () => 1))).toBeNull();
    // Leituras antigas não contam como recentes.
    expect(projetarNivel([
      { t: BASE - 10 * HORA, nivelM: 1 },
      { t: BASE - 9 * HORA, nivelM: 1 },
      { t: BASE, nivelM: 1.2 },
    ])).toBeNull();
  });
});

describe('removerPicosIsolados', () => {
  it('remove o pico isolado e mantém um degrau real', () => {
    const pico = [1, 1, -30, 1, 1].map((v, i) => ({ t: i, nivelM: v }));
    expect(removerPicosIsolados(pico).map(p => p.nivelM)).toEqual([1, 1, 1, 1]);
    const degrau = [1, 1, 3, 3, 3].map((v, i) => ({ t: i, nivelM: v }));
    expect(removerPicosIsolados(degrau)).toHaveLength(5);
  });
});
