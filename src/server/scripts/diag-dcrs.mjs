// Diagnóstico: unidade de cada estação DC
const GRAPHQL_URL = 'https://redehidrometeorologica.defesacivil.rs.gov.br/graphql';
const query = `query { tags_data(station: ["DCRS-00075","DCRS-00046","DCRS-00085","DCRS-00069","DCRS-00012","DCRS-00031"] clients: ["casa-militar-defesa-civil-rs"]) { qualle_meteorologia { codigo name { general } position { latitude longitude } data { rio { rio_nivel { value } } } } } }`;
fetch(GRAPHQL_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({query}), signal: AbortSignal.timeout(12000) })
  .then(r=>r.json())
  .then(j=>{
    const est = j.data?.tags_data?.qualle_meteorologia ?? [];
    est.forEach(e => {
      const v = e.data.rio?.rio_nivel?.value;
      console.log(e.codigo, '|', e.name.general.trim(), '| raw:', v, '| lat:', e.position.latitude.toFixed(4));
    });
  })
  .catch(e=>console.error(e.message));
