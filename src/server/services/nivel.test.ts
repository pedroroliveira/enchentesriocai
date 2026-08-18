import { describe, expect, it } from 'vitest';
import { aplicarRedutorTelemetria, metrosParaCentimetros } from './nivel.js';

describe('aplicarRedutorTelemetria', () => {
  it('deduz o datum das leituras DCRS', () => {
    expect(aplicarRedutorTelemetria(18.427, '15.125', 'DCRS')).toBe(3.302);
  });

  it('aceita redutor nulo como zero', () => {
    expect(aplicarRedutorTelemetria(3.81, null, 'DCRS')).toBe(3.81);
  });

  it('não aplica o redutor às leituras ANA', () => {
    expect(aplicarRedutorTelemetria(3.81, '15.125', 'ANA')).toBe(3.81);
  });

  it('ignora configuração inválida sem inutilizar a leitura', () => {
    expect(aplicarRedutorTelemetria(3.81, 'inválido', 'DCRS')).toBe(3.81);
  });
});

describe('metrosParaCentimetros', () => {
  it('deriva centímetros do nível já corrigido', () => {
    expect(metrosParaCentimetros(3.302)).toBe(330.2);
  });
});
