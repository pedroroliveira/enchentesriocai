const cod = '87300000';
const hoje = new Date().toISOString().split('T')[0];
const seteDias = new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0];
const url = `https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=${cod}&dataInicio=${seteDias}&dataFim=${hoje}`;

const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
const xml = await r.text();
console.log('Tamanho:', xml.length);
console.log('Tem erro:', xml.includes('<Error>'));

// Mostra trecho com dados
const idx = xml.indexOf('diffgram');
console.log('\nDados:\n', xml.substring(idx, idx + 1500));
