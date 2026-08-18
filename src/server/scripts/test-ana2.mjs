// Testa fetch direto + parsing para cada estação
const estacoes = [
  { cod: '87150000', nome: 'Linha Gonzaga' },
  { cod: '87163000', nome: 'Vale Real' },
  { cod: '87165001', nome: 'Feliz' },
  { cod: '87168590', nome: 'Bom Princípio' },
  { cod: '87170000', nome: 'Barca do Caí' },
  { cod: '87270000', nome: 'Montenegro' },
  { cod: '87300000', nome: 'Triunfo' },
  { cod: '86748001', nome: 'Rio Fão' },
];

const hoje = new Date().toISOString().split('T')[0];
const seteDias = new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0];

for (const est of estacoes) {
  const url = `https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=${est.cod}&dataInicio=${seteDias}&dataFim=${hoje}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const xml = await r.text();
    const hasError = xml.includes('<Error>');
    
    // Tenta diferentes padrões de parsing
    const p1 = [...xml.matchAll(/<DataHora>([^<]+)<\/DataHora>[\s\S]{0,300}?<Nivel>([^<]*)<\/Nivel>/g)];
    const p2 = [...xml.matchAll(/<Nivel>([^<]+)<\/Nivel>/g)];
    const p3 = [...xml.matchAll(/<DataHora>([^<]+)<\/DataHora>/g)];
    
    const ultima = p1[p1.length - 1];
    console.log(`${est.cod} ${est.nome}: erro=${hasError} p1=${p1.length} niveis=${p2.length} datas=${p3.length}`, ultima ? `ultima: ${ultima[1]} nivel=${ultima[2]}` : '');
    
    if (!hasError && p2.length === 0 && xml.length < 2000) {
      console.log('  XML:', xml.substring(0, 500));
    }
  } catch(e) {
    console.log(`${est.cod} ${est.nome}: ERRO ${e.message}`);
  }
}
