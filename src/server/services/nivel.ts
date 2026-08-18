/**
 * Converte a cota absoluta recebida da telemetria DCRS em nível fluviométrico.
 *
 * As leituras ANA já são níveis relativos à régua da estação e, portanto, não
 * recebem o redutor de telemetria.
 */
export function aplicarRedutorTelemetria(
  nivelM: number,
  redutorTelemetria: string | number | null | undefined,
  fonte: string,
): number {
  if (fonte !== 'DCRS') return nivelM;

  const redutor = Number(redutorTelemetria ?? 0);
  if (!Number.isFinite(redutor)) return nivelM;

  return Math.round((nivelM - redutor) * 1000) / 1000;
}

export function metrosParaCentimetros(nivelM: number): number {
  return Math.round(nivelM * 100 * 100) / 100;
}
