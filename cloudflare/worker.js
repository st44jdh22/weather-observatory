// Sr. AI Capitán v5.15 (base v5.11) — AEMET integration + existing forecast-first AI briefing.
// Secrets: OPENAI_API_KEY, ARA_ACCESS_CODE, AEMET_API_KEY; KV binding AI_USAGE.
const ORIGIN='https://st44jdh22.github.io';
const POINTS=[
 {name:'Sant Antoni Marina D6',lat:38.978,lon:1.301},
 {name:'Ibiza Town',lat:38.908,lon:1.443},
 {name:'Santa Eulària',lat:38.985,lon:1.535},
 {name:'La Savina',lat:38.733,lon:1.418},
 {name:'Cala Gració',lat:38.992,lon:1.287},
 {name:'Cala Salada',lat:39.010,lon:1.303},
 {name:'Cala Bassa',lat:38.965,lon:1.239},
 {name:'Cala Conta',lat:38.960,lon:1.222},
 {name:'Cala Tarida',lat:38.942,lon:1.236},
 {name:'Es Vedrà',lat:38.868,lon:1.195},
 {name:'Es Cubells',lat:38.881,lon:1.270},
 {name:'Cala Jondal',lat:38.867,lon:1.329},
 {name:'Ses Salines',lat:38.840,lon:1.393},
 {name:"Playa d'en Bossa",lat:38.888,lon:1.410},
 {name:'Talamanca',lat:38.919,lon:1.461},
 {name:'Tagomago',lat:39.033,lon:1.650},
 {name:'Portinatx',lat:39.110,lon:1.518},
 {name:'Benirràs',lat:39.080,lon:1.452},
 {name:'Cala Xarraca',lat:39.105,lon:1.501},
 {name:'Ses Margalides',lat:39.050,lon:1.285},
 {name:'Ses Illetes',lat:38.761,lon:1.433},
 {name:'Cala Saona',lat:38.696,lon:1.386},
 {name:'Platja de Migjorn',lat:38.670,lon:1.473},
 {name:'Es Caló',lat:38.688,lon:1.515},
 {name:'Es Pujols',lat:38.725,lon:1.459},
 {name:'Es Freus (general area)',lat:38.744,lon:1.431}
]; // Approximate geographic reference points only. Not chart positions or navigable routes.
const KNOWLEDGE=`Local marine context (not chart data): Es Freus may develop steep seas and wind-over-current in some NE/SW conditions. Es Vedrà and Vedranell may experience terrain-driven gusts and direction shifts. La Bota is a charted hazard requiring verification on current official charts. Consider exposure and lee effects only where geographically relevant. Coarse forecast grids cannot confirm individual-cove shelter, anchoring permission or navigable routes. The captain retains command.`;
const json=(x,status=200,h={})=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...h}});
const cors=()=>({'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-ARA-Access'});
function eq(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
function nm(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r,x=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2;return 3440.065*2*Math.asin(Math.sqrt(x))}
async function fetchJSON(url){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),9000);try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
function windowHours(s){if(s.startsWith('Morning'))return [8,12];if(s.startsWith('Afternoon'))return [12,18];if(s.startsWith('All day'))return [8,18];if(s.startsWith('Evening'))return [18,23];if(s.startsWith('Overnight'))return [23,24];return [8,18]}
async function weather(date,period,locations){
 const [start,end]=windowHours(period);
 const locs=locations;
 return await Promise.all(locs.map(async p=>{
  const q=`latitude=${p.lat}&longitude=${p.lon}&timezone=Europe%2FMadrid&start_date=${date}&end_date=${date}`;
  const [w,m]=await Promise.allSettled([
   fetchJSON('https://api.open-meteo.com/v1/forecast?'+q+'&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,precipitation&wind_speed_unit=kn'),
   fetchJSON('https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=wave_height,wave_direction,swell_wave_height,swell_wave_direction')
  ]);
  const select=(v,keys)=>{if(v.status!=='fulfilled'||!v.value.hourly)return {error:v.status==='rejected'?'unavailable':'missing hourly data'};const h=v.value.hourly;const times=h.time||[];return times.map((t,i)=>({time:t,...Object.fromEntries(keys.map(k=>[k,h[k]?.[i]??null]))})).filter(x=>{const hour=Number(x.time.slice(11,13));return hour>=start&&hour<end})};
  return {area:p.name,point_type:'approximate forecast-grid reference',wind:select(w,['wind_speed_10m','wind_direction_10m','wind_gusts_10m','precipitation_probability','precipitation']),sea:select(m,['wave_height','wave_direction','swell_wave_height','swell_wave_direction'])};
 }));
}

// Experimental inter-model agreement, not a calibrated forecast accuracy probability.
async function modelAgreement(date,period,p){
 const [start,end]=windowHours(period);
 const q=`latitude=${p.lat}&longitude=${p.lon}&timezone=Europe%2FMadrid&start_date=${date}&end_date=${date}&hourly=wind_speed_10m,wind_gusts_10m,precipitation_probability&wind_speed_unit=kn`;
 const models=['ecmwf_ifs025','gfs_seamless'];
 const responses=await Promise.allSettled(models.map(m=>fetchJSON('https://api.open-meteo.com/v1/forecast?'+q+'&models='+m)));
 const extract=r=>{
  if(r.status!=='fulfilled'||!r.value.hourly)return null;
  const h=r.value.hourly;
  return (h.time||[]).map((t,i)=>({t,w:h.wind_speed_10m?.[i],g:h.wind_gusts_10m?.[i],rain:h.precipitation_probability?.[i]}))
   .filter(x=>{const hr=Number(x.t.slice(11,13));return hr>=start&&hr<end&&Number.isFinite(x.w)&&Number.isFinite(x.g)});
 };
 const [a,b]=responses.map(extract);
 if(!a?.length||!b?.length)return {percentage:null,label:'Not available',method:'ECMWF/GFS comparison unavailable; no percentage displayed',models_available:responses.map((r,i)=>r.status==='fulfilled'?models[i]:null).filter(Boolean)};
 const bm=new Map(b.map(x=>[x.t,x]));const pairs=a.map(x=>[x,bm.get(x.t)]).filter(x=>x[1]);
 if(pairs.length<2)return {percentage:null,label:'Not available',method:'Insufficient matching forecast hours',models_available:models};
 // A conservative, transparent heuristic: mean model differences in wind, gusts and rain.
 const differences=pairs.map(([x,y])=>Math.min(100,Math.abs(x.w-y.w)*4+Math.abs(x.g-y.g)*2+Math.abs((x.rain??50)-(y.rain??50))*.12));
 const mean=differences.reduce((s,x)=>s+x,0)/differences.length;
 const pct=Math.max(0,Math.min(100,Math.round(100-mean)));
 return {percentage:pct,label:pct>=85?'High agreement':pct>=65?'Moderate agreement':'Low agreement',
 method:'Experimental ECMWF IFS / NOAA GFS model-agreement index; NOT a calibrated probability of forecast accuracy',
 models_available:models,compared_hours:pairs.length};
}
function quickLook(forecast,period,confidence){
 const first=forecast?.[0],wind=Array.isArray(first?.wind)?first.wind.filter(x=>Number.isFinite(x.wind_speed_10m)):[];
 const sea=Array.isArray(first?.sea)?first.sea.filter(x=>Number.isFinite(x.wave_height)):[];
 if(!wind.length)return {status:'Unknown',tone:'neutral',wind:'Unavailable',gusts:'Unavailable',weather:'Unavailable',wave:'Unavailable',confidence};
 const ws=wind.map(x=>x.wind_speed_10m),gs=wind.map(x=>x.wind_gusts_10m).filter(Number.isFinite);
 const rain=wind.map(x=>x.precipitation_probability).filter(Number.isFinite);
 const peak=Math.max(...gs,...ws),maxRain=rain.length?Math.max(...rain):null;
 const waves=sea.map(x=>x.wave_height);
 const maxWave=waves.length?Math.max(...waves):null;
 const severity=peak>=35||maxWave>=2.5?0:peak>=27||maxWave>=1.6?1:peak>=20||maxWave>=1?2:peak>=13||maxWave>=.5?3:4;
 const names=['Very poor','Unsettled','Mixed','Fine','Very good'],tones=['danger','warning','caution','good','excellent'];
 return {status:names[severity],tone:tones[severity],
 wind:Math.round(Math.min(...ws))+'–'+Math.round(Math.max(...ws))+' kn',
 gusts:gs.length?'Up to '+Math.round(Math.max(...gs))+' kn':'Unavailable',
 weather:maxRain===null?'Precipitation unavailable':maxRain>=75?'Rain/showers likely':maxRain>=40?'Possible showers':'Mostly dry',
 wave:maxWave===null?'Unavailable':'Up to '+maxWave.toFixed(1)+' m at departure grid',
 confidence,
 summary_basis:'Five-level preliminary conditions index based on departure-grid gust and wave thresholds; not a go/no-go decision.'};
}

// AEMET official OpenData proxy. The secret stays in Cloudflare, never in the browser.
const AEMET_ROOT='https://opendata.aemet.es/opendata';
async function aemetResource(path,env){
 const r=await fetch(AEMET_ROOT+path,{headers:{api_key:env.AEMET_API_KEY,accept:'application/json'}});
 if(!r.ok)throw Error('AEMET API HTTP '+r.status);
 const meta=await r.json();
 if(!meta.datos||!/^https:\/\/(?:opendata\.aemet\.es|www\.aemet\.es)\//.test(meta.datos))throw Error('AEMET data link missing or invalid');
 const data=await fetch(meta.datos);
 if(!data.ok)throw Error('AEMET data HTTP '+data.status);
 const content=await data.text();
 if(content.length>400000)throw Error('AEMET response too large');
 return {content,issued:meta.descripcion||null,source:meta.datos};
}
const cleanText=x=>String(x||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
// AEMET warning bundle is tar.gz containing bilingual CAP XML files (not ordinary XML text).
const capText=(xml,tag)=>{const m=xml.match(new RegExp('<(?:\\w+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?'+tag+'>','i'));return m?m[1].replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim():''};
function capBlocks(xml,tag){return [...xml.matchAll(new RegExp('<(?:\\w+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?'+tag+'>','gi'))].map(x=>x[1])}
async function capArchive(buffer){
 let bytes=new Uint8Array(buffer);
 if(bytes[0]===0x1f&&bytes[1]===0x8b){
  const ds=new DecompressionStream('gzip');
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer());
 }
 const files=[];
 for(let pos=0;pos+512<=bytes.length;){
  const head=bytes.subarray(pos,pos+512);if(head.every(v=>v===0))break;
  const name=new TextDecoder().decode(head.subarray(0,100)).replace(/\0.*$/,'');
  const sizeRaw=new TextDecoder().decode(head.subarray(124,136)).replace(/\0.*$/,'').trim();
  const size=parseInt(sizeRaw,8);if(!Number.isFinite(size)||size<0||size>2_000_000||pos+512+size>bytes.length)throw Error('Invalid CAP tar archive');
  if(/\.xml$/i.test(name))files.push(new TextDecoder('utf-8').decode(bytes.subarray(pos+512,pos+512+size)));
  pos+=512+Math.ceil(size/512)*512;
  if(files.length>1000)throw Error('CAP archive contains too many records');
 }
 if(!files.length)throw Error('No CAP XML records found in archive');
 return files;
}
function capAlert(xml){
 const infos=capBlocks(xml,'info');
 const parsed=infos.map(block=>{
  const params=capBlocks(block,'parameter').map(p=>({name:capText(p,'valueName'),value:capText(p,'value')}));
  const level=params.find(p=>/Meteoalerta nivel/i.test(p.name))?.value?.toLowerCase()||'';
  const areas=capBlocks(block,'area').map(a=>({name:capText(a,'areaDesc'),geocodes:capBlocks(a,'geocode').map(g=>({name:capText(g,'valueName'),value:capText(g,'value')}))}));
  return {language:capText(block,'language'),event:capText(block,'event'),headline:capText(block,'headline'),description:capText(block,'description'),instruction:capText(block,'instruction'),severity:capText(block,'severity'),level,onset:capText(block,'onset'),effective:capText(block,'effective'),expires:capText(block,'expires'),areas};
 });
 const es=parsed.find(p=>/^es/i.test(p.language))||parsed[0];
 const en=parsed.find(p=>/^en/i.test(p.language))||null;
 return {id:capText(xml,'identifier'),sent:capText(xml,'sent'),status:capText(xml,'status'),msgType:capText(xml,'msgType'),es,en,areas:es?.areas||en?.areas||[]};
}
async function aemetWarnings(env){
 const url='/api/avisos_cap/ultimoelaborado/area/64';
 const metaResponse=await fetch(AEMET_ROOT+url,{headers:{api_key:env.AEMET_API_KEY,accept:'application/json'}});
 if(!metaResponse.ok)throw Error('CAP metadata HTTP '+metaResponse.status);
 const meta=await metaResponse.json();
 if(!meta.datos||!/^https:\/\/(?:opendata\.aemet\.es|www\.aemet\.es)\//.test(meta.datos))throw Error('CAP download URL invalid');
 const download=await fetch(meta.datos);if(!download.ok)throw Error('CAP download HTTP '+download.status);
 const raw=await download.arrayBuffer();if(raw.byteLength>12_000_000)throw Error('CAP archive too large');
 const xmls=await capArchive(raw);
 const alerts=xmls.map(capAlert).filter(a=>a.es||a.en);
 if(alerts.length!==xmls.length)throw Error('Some CAP records could not be parsed');
 const matches=alerts.filter(a=>a.areas.some(x=>/Ibiza|Eivissa|Formentera|Pitiusas|Baleares|Balears/i.test(x.name)));
 const unmatched=alerts.filter(a=>!a.areas.some(x=>/Ibiza|Eivissa|Formentera|Pitiusas|Baleares|Balears/i.test(x.name)));
 // CAP zone codes require official mapping before safely declaring a clean all-clear.
 return {verified:true,classification:'CAP records parsed; local coverage not exhaustively verified',format:'CAP XML in tar.gz',records_total:alerts.length,matching_area_records:matches.length,unmatched_area_records:unmatched.length,alerts:matches.slice(0,80),coverage_verified:false,retrieved_at_utc:new Date().toISOString()};
}
// Exact AEMET Costa de Illes Balears coastal bulletin, distinct from CAP alerts.
// Its <aviso><texto> wording must NEVER be constructed from colour-level alerts.
const AEMET_COASTAL_XML='https://www.aemet.es/xml/maritima/FQXX44MM.xml';
function coastalTag(block,name){
 const m=block.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));
 return m?m[1].replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi,(_,num,named)=>{
  if(num){const cp=num[0].toLowerCase()==='x'?parseInt(num.slice(1),16):Number(num);return cp>=32&&cp<=0x10ffff?String.fromCodePoint(cp):''}
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[named.toLowerCase()]||'';
 }).replace(/\s+/g,' ').trim():null;
}
function madridLocalMs(value){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value||''))return NaN;
 const [y,mo,d,h,mi,s]=value.match(/\d+/g).map(Number);
 const tentative=Date.UTC(y,mo-1,d,h,mi,s);
 if(!Number.isFinite(tentative))return NaN;
 // AEMET coastal XML uses Spanish official (Europe/Madrid) wall-clock time.
 // Resolve CET/CEST explicitly rather than treating the timestamp as UTC.
 const tz=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',timeZoneName:'shortOffset'}).formatToParts(new Date(tentative)).find(x=>x.type==='timeZoneName')?.value||'';
 const offset=/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
 if(!offset)return NaN;
 const minutes=(Number(offset[2])*60+Number(offset[3]||0))*(offset[1]==='+'?1:-1);
 return tentative-minutes*60000;
}
export function parseCoastalAvisos(xml,nowMs=Date.now()){
 if(typeof xml!=='string'||xml.length>400000||!/<root\b/i.test(xml)||!/<origen>/i.test(xml)||!/<\/root>/i.test(xml))throw Error('Invalid AEMET coastal XML');
 const blocks=[...xml.matchAll(/<aviso\b[^>]*>([\s\S]*?)<\/aviso>/gi)].map(x=>x[1]);
 if(!blocks.length)throw Error('No Avisos section in coastal XML');
 const avisos=blocks.map(b=>({text:coastalTag(b,'texto'),valid_from_local:coastalTag(b,'inicio'),valid_until_local:coastalTag(b,'fin')}));
 if(avisos.some(a=>!a.text||!a.valid_from_local||!a.valid_until_local||!Number.isFinite(madridLocalMs(a.valid_from_local))||!Number.isFinite(madridLocalMs(a.valid_until_local))))throw Error('Incomplete coastal Avisos validity');
 const current=avisos.filter(a=>nowMs>=madridLocalMs(a.valid_from_local)&&nowMs<madridLocalMs(a.valid_until_local));
 const upcoming=avisos.filter(a=>nowMs<madridLocalMs(a.valid_from_local));
 return {verified:true,source:'AEMET Costa de Illes Balears coastal XML',source_url:AEMET_COASTAL_XML,area:'Costa de Illes Balears',
  avisos:current,upcoming_avisos:upcoming,expired:current.length===0&&upcoming.length===0,
  last_valid_until_local:avisos[avisos.length-1].valid_until_local,
  retrieved_at_utc:new Date(nowMs).toISOString()};
}
async function aemetCoastalAvisos(){
 const ac=new AbortController(),t=setTimeout(()=>ac.abort(),9000);
 try{
  const response=await fetch(AEMET_COASTAL_XML,{signal:ac.signal,headers:{Accept:'application/xml,text/xml'}});
  if(!response.ok)throw Error('Coastal XML HTTP '+response.status);
  const xml=await response.text();
  return parseCoastalAvisos(xml);
 }finally{clearTimeout(t)}
}

async function aemetStatus(env){
 if(!env.AEMET_API_KEY)return {verified:false,error:'AEMET_API_KEY secret missing'};
 const jobs=await Promise.allSettled([aemetResource('/api/prediccion/maritima/costera/costa/44',env),aemetWarnings(env),aemetCoastalAvisos()]);
 const result={checked_at_utc:new Date().toISOString(),verified:false,marine:{verified:false},warnings:{verified:false}};
 if(jobs[0].status==='fulfilled'){
  const r=jobs[0].value;result.marine={verified:true,area:'Illes Balears coastal waters',bulletin:r.content.slice(0,250000),source:'AEMET OpenData coastal area 44',retrieved_at_utc:result.checked_at_utc};
 }else result.marine={verified:false,error:String(jobs[0].reason?.message||'Unavailable')};
 if(jobs[1].status==='fulfilled')result.warnings=jobs[1].value;
 else result.warnings={verified:false,error:String(jobs[1].reason?.message||'CAP archive unavailable')};
 if(jobs[2].status==='fulfilled')result.marine_avisos=jobs[2].value;
 else result.marine_avisos={verified:false,error:String(jobs[2].reason?.message||'AEMET coastal XML unavailable')};
 result.verified=result.marine.verified&&result.warnings.verified&&result.marine_avisos.verified;
 return result;
}


// V5.17 — independent fallback atmospheric forecast for Ibiza/Formentera.
// MET Norway requires an identifying User-Agent; this is an official, attributed API.
// Do not invent gusts, precipitation probabilities or wave data when absent.
const metNumber=x=>Number.isFinite(x)?x:null;
const metCode=s=>{const x=String(s||'').toLowerCase();if(!x)return null;if(x.includes('thunder'))return 95;if(x.includes('rainshowers')||x.includes('sleetshowers')||x.includes('snowshowers'))return 80;if(x.includes('rain')||x.includes('sleet'))return 61;if(x.includes('snow'))return 71;if(x.includes('fog'))return 45;if(x.includes('cloudy')&&!x.includes('partly'))return 3;if(x.includes('partlycloudy'))return 2;if(x.includes('fair'))return 1;if(x.includes('clearsky'))return 0;return null};
function metLocalTime(utc){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(utc)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`}
async function metNorwayForecast(lat,lon){
 const url=`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),13000);
 let data;
 try{
  const r=await fetch(url,{signal:ac.signal,headers:{'User-Agent':'ARAWeatherDesk/5.17 (+https://st44jdh22.github.io/weather-observatory/ara/)','Accept':'application/json'},cf:{cacheEverything:true,cacheTtl:600}});
  if(!r.ok)throw Error('MET Norway HTTP '+r.status);
  data=await r.json();
 }finally{clearTimeout(timer)}
 const rows=data?.properties?.timeseries;
 if(!Array.isArray(rows)||rows.length<12)throw Error('MET Norway timeseries unavailable');
 const issued=data?.properties?.meta?.updated_at||null;
 if(issued&&Number.isFinite(Date.parse(issued))&&Date.now()-Date.parse(issued)>24*3600000)throw Error('MET Norway model issue time is stale');
 const keys=['temperature_2m','relative_humidity_2m','precipitation_probability','precipitation','weather_code','cloud_cover','wind_speed_10m','wind_direction_10m','wind_gusts_10m','pressure_msl'];
 const hourly={time:[]};keys.forEach(k=>hourly[k]=[]);
 const now=Date.now();
 for(const r of rows){
  const when=Date.parse(r.time);if(!Number.isFinite(when)||when<now-5*3600000||when>now+100*3600000)continue;
  const a=r.data?.instant?.details||{},next=r.data?.next_1_hours||{};
  const symbol=next.summary?.symbol_code||r.data?.next_6_hours?.summary?.symbol_code||null;
  const values={
   temperature_2m:metNumber(a.air_temperature),relative_humidity_2m:metNumber(a.relative_humidity),
   precipitation_probability:metNumber(next.details?.probability_of_precipitation),
   precipitation:metNumber(next.details?.precipitation_amount),weather_code:metCode(symbol),
   cloud_cover:metNumber(a.cloud_area_fraction),wind_speed_10m:Number.isFinite(a.wind_speed)?Math.round(a.wind_speed*1.94384449*10)/10:null,
   wind_direction_10m:metNumber(a.wind_from_direction),wind_gusts_10m:Number.isFinite(a.wind_speed_of_gust)?Math.round(a.wind_speed_of_gust*1.94384449*10)/10:null,
   pressure_msl:metNumber(a.air_pressure_at_sea_level)
  };
  hourly.time.push(metLocalTime(r.time));keys.forEach(k=>hourly[k].push(values[k]));
 }
 if(hourly.time.length<8||!hourly.wind_speed_10m.some(Number.isFinite))throw Error('MET Norway forecast has no usable local wind hours');
 return {provider:'MET Norway',source:'MET Norway Locationforecast 2.0 complete (global forecast)',attribution_url:'https://api.met.no/',forecast_issued_at_utc:issued,retrieved_at_utc:new Date().toISOString(),timezone:'Europe/Madrid',latitude:lat,longitude:lon,hourly,missing_values_are_null:true,notes:'Atmospheric forecast only; no wave data. Gusts and 1-hour rain probability may not be supplied in the global model.'};
}

export default {async fetch(request,env){
 const origin=request.headers.get('Origin');if(origin!==ORIGIN)return json({error:'Origin denied'},403);
 const h=cors();if(request.method==='OPTIONS')return new Response(null,{status:204,headers:h});
 const route=new URL(request.url);
 if(request.method==='GET'&&route.pathname==='/aemet'){
  try{return json(await aemetStatus(env),200,{...h,'Cache-Control':'public, max-age=600'});}
  catch{return json({verified:false,error:'AEMET retrieval failed'},502,h);}
 }

 if(request.method==='GET'&&route.pathname==='/forecast'){
  const lat=Number(route.searchParams.get('lat')),lon=Number(route.searchParams.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<38.5||lat>39.3||lon<1.0||lon>1.9)return json({error:'Unsupported forecast coordinates'},400,h);
  try{return json(await metNorwayForecast(lat,lon),200,{...h,'Cache-Control':'public, max-age=600'});}
  catch{return json({error:'MET Norway forecast unavailable'},502,h)}
 }
 if(request.method==='GET'&&route.pathname==='/metar'){
  const deadline=async(url,opts={},ms=9000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opts,signal:c.signal})}finally{clearTimeout(t)}};
  try{
   const upstream=await deadline('https://aviationweather.gov/api/data/metar?ids=LEIB&format=json',{headers:{'Accept':'application/json'}},8500);
   if(!upstream.ok)throw Error('AWC HTTP '+upstream.status);
   const reports=await upstream.json(),observation=Array.isArray(reports)?reports.find(x=>x.icaoId==='LEIB'||x.icao==='LEIB')||reports[0]:null;
   if(!observation)throw Error('No LEIB report from AWC');
   return json({observation,source:'US Aviation Weather Center',retrieved_at:new Date().toISOString()},200,{...h,'Cache-Control':'public, max-age=300'});
  }catch(firstError){
   try{
    const r=await deadline('https://tgftp.nws.noaa.gov/data/observations/metar/stations/LEIB.TXT',{headers:{'Accept':'text/plain'}},8500);
    if(!r.ok)throw Error('NOAA HTTP '+r.status);
    const txt=(await r.text()).trim();if(txt.length>5000)throw Error('NOAA report too large');
    const raw=txt.split(/\r?\n/).find(line=>/^LEIB\s/.test(line.trim()));
    if(!raw)throw Error('NOAA has no LEIB METAR');
    const head=txt.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
    const obsTime=head?new Date(Date.UTC(+head[1],+head[2]-1,+head[3],+head[4],+head[5])).toISOString():null;
    return json({observation:{icaoId:'LEIB',rawOb:raw,obsTime},source:'NOAA NWS raw METAR fallback',retrieved_at:new Date().toISOString()},200,{...h,'Cache-Control':'public, max-age=300'});
   }catch(secondError){return json({error:'METAR sources unavailable',sources:['AWC','NOAA NWS'],checked_at:new Date().toISOString()},502,h)}
  }
 }
 if(request.method!=='POST')return json({error:'Method not allowed'},405,h);
 // The current live ARA website submits briefings to the Worker root.
 // Do not allow POST to the public weather-proxy endpoints or unknown paths.
 if(route.pathname!=='/')return json({error:'Not found'},404,h);
 if(!env.OPENAI_API_KEY||!env.ARA_ACCESS_CODE||!env.AI_USAGE)return json({error:'Missing secrets or KV binding'},503,h);
 if(!eq(request.headers.get('X-ARA-Access')||'',env.ARA_ACCESS_CODE))return json({error:'Access code incorrect'},401,h);
 let d;try{const raw=await request.text();if(raw.length>12000)return json({error:'Request too large'},413,h);d=JSON.parse(raw)}catch{return json({error:'Invalid request JSON'},400,h)}
 if(d===null||typeof d!=='object'||Array.isArray(d))return json({error:'Request JSON must be an object'},400,h);
 for(const k of ['request','date','departure','duration','tolerance'])if(typeof d[k]!=='string'||d[k].length>3000)return json({error:'Invalid '+k},400,h);
 const speed=Number(d.speed_knots),radius=Number(d.max_distance_nm);
 if(!Number.isFinite(speed)||speed<5||speed>50||!Number.isFinite(radius)||radius<1||radius>70)return json({error:'Speed must be 5–50 knots and radius 1–70 NM'},400,h);
 if(typeof d.destination!=='string'||d.destination.length>120)return json({error:'Invalid destination'},400,h);
 const departure=POINTS.find(p=>p.name===d.departure)||POINTS.find(p=>d.departure.startsWith('Sant Antoni')&&p.name.startsWith('Sant Antoni'));
 if(!departure)return json({error:'Unsupported departure; choose a listed port'},400,h);
 const candidates=POINTS.filter(p=>p!==departure&&nm(departure,p)<=radius).map(p=>({name:p.name,straight_line_nm:Number(nm(departure,p).toFixed(1)),planning_minutes_lower_bound:Math.ceil(nm(departure,p)/speed*60)})).sort((a,b)=>a.straight_line_nm-b.straight_line_nm);
 const selected=POINTS.find(p=>p.name===d.destination);
 const selectedStraightLineNm=selected?Number(nm(departure,selected).toFixed(1)):null;
 const selectedExceedsRadius=selectedStraightLineNm!==null&&selectedStraightLineNm>radius;
 const weatherLocations=[departure,...POINTS.filter(p=>candidates.slice(0,14).some(c=>c.name===p.name))].slice(0,15);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date))return json({error:'Select a valid date'},400,h);
 // Cloudflare KV is eventually consistent and get+put is not atomic: this is
 // a soft daily budget, not a guaranteed limit under concurrent requests.
 // Production clearance requires a separate atomic usage-control decision.
 const day=new Date().toISOString().slice(0,10),key='requests:'+day,used=Number(await env.AI_USAGE.get(key)||0);
 if(used>=30)return json({error:'Daily request allowance reached'},429,h);
 await env.AI_USAGE.put(key,String(used+1),{expirationTtl:172800});
 let forecast=null,forecastStatus='unavailable';
 try{forecast=await weather(d.date,d.duration,weatherLocations);forecastStatus=forecast.some(x=>Array.isArray(x.wind)&&x.wind.length)?'Open-Meteo forecast retrieved for selected hours':'No hourly forecast for selected period'}catch(e){forecastStatus='Forecast retrieval failed'}
 const distances=candidates;
 let confidence={percentage:null,label:'Not available',method:'Model comparison not available'};
 try{confidence=await modelAgreement(d.date,d.duration,departure)}catch{}
 const outlook=quickLook(forecast,d.duration,confidence);
 const instructions=`You are Sr. AI Capitán, a concise weather-first marine planning assistant for Ibiza and Formentera. Use clear British English and short sections: Weather; Local implications; Options; Watch-outs. Base advice only on supplied forecasts and user trip details. Distinguish forecasts from observations and official warnings; do not claim AEMET warnings were checked. Do not invent missing wind, gust, sea-state, weather, shelter or warning data. State uncertainty, especially for local gusts, waves and exposure. Never describe straight-line distances as navigable passage distances, give precise ETAs from them, or assert a destination is within the permitted radius without chart-based route verification. Treat user speed as a planning assumption, not a guarantee. If a selected destination's straight-line distance exceeds the permitted radius, explicitly flag this conflict and do not recommend it as an option. Straight lines crossing land are NOT navigable passages; require real chart-based routing and never propose transits through land. Do not assume east-facing coasts are sheltered in strong easterly winds. Model agreement is not forecast accuracy; do not invent confidence figures. Only discuss training, anchoring or swimming if the user asks. For an unspecified destination, offer at most two provisional options when supported by forecast evidence. The captain retains command. Local context: ${KNOWLEDGE}`;
 try{
 const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-5.1',instructions,input:JSON.stringify({trip:d,departure_reference:departure,selected_destination:selected||null,selected_straight_line_nm:selectedStraightLineNm,selected_exceeds_radius:selectedExceedsRadius,forecast_status:forecastStatus,forecast,confidence,outlook,distances,forecast_retrieved_at_utc:new Date().toISOString(),official_AEMET_warnings:'NOT VERIFIED'}),max_output_tokens:2100,store:false})});
 if(!upstream.ok){return json({error:'OpenAI request failed'},502,h)}
 const r=await upstream.json();const briefing=(r.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
 return json({briefing:briefing||'No briefing returned. Retry.',model:r.model||env.OPENAI_MODEL||'gpt-5.1',knowledge_version:'2026-10-16 v0.4',forecast_status:forecastStatus,confidence,outlook,weather_verified:false},200,h)
 }catch{return json({error:'AI request failed'},502,h)}
 }};

