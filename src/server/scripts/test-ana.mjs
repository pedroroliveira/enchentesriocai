const estacoes = ['87165001','87168590','87170000','87270000','87271100','87300000','87150000','87163000'];
const hoje = new Date().toISOString().split('T')[0];
const ontem = new Date(Date.now()-86400000*7).toISOString().split('T')[0];

const results = await Promise.all(estacoes.map(async cod => {
  const url = `https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=${cod}&dataInicio=${ontem}&dataFim=${hoje}`;
  try {
    const r = await fetch(url, {signal: AbortSignal.timeout(8000)});
    const xml = await r.text();
    const hasError = xml.includes('<Error>');
    const leituras = [...xml.matchAll(/<DataHora>([^<]+)<\/DataHora>[\s\S]{0,200}?<Nivel>([^<]*)<\/Nivel>/g)];
    const ultima = leituras[leituras.length-1];
    return { cod, hasError, total: leituras.length, ultima: ultima ? ultima[1]+' nivel='+ultima[2] : 'sem dados' };
  } catch(e) {
    return { cod, hasError: true, total: 0, ultima: String(e) };
  }
}));

results.forEach(r => console.log(r.cod, r.hasError?'ERRO':'OK', 'leituras:'+r.total, r.ultima));
