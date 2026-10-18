import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import worker,{parseCoastalAvisos} from '../worker.js';

const base='https://example.workers.dev',origin='https://st44jdh22.github.io';
const realFetch=globalThis.fetch;afterEach(()=>globalThis.fetch=realFetch);
const request=(path='/',method='GET',body=null,headers={})=>new Request(base+path,{method,headers:{Origin:origin,...headers},...(method==='POST'?{body:body??'{}'}:{})});
const env=()=>{const kv=new Map();return {OPENAI_API_KEY:'fake-test-key',AEMET_API_KEY:'fake-aemet-key',ARA_ACCESS_CODE:'test-access',AI_USAGE:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v)},kv};};
const trip={request:'Forecast please',date:'2026-10-17',departure:'Sant Antoni Marina D6',duration:'Morning',tolerance:'Medium',speed_knots:20,max_distance_nm:2,destination:'Portinatx'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
test('origin rejected without weakening CORS; allowed preflight',async()=>{assert.equal((await worker.fetch(new Request(base+'/metar'),env())).status,403);assert.equal((await worker.fetch(request('/metar','GET',null,{Origin:'https://wrong.example'}),env())).status,403);const r=await worker.fetch(request('/','OPTIONS'),env());assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);});
test('METAR direct success and fallback success',async()=>{globalThis.fetch=async u=>String(u).includes('aviationweather.gov')?json([{icaoId:'LEIB',rawOb:'LEIB TEST'}]):json({});assert.equal((await worker.fetch(request('/metar'),env())).status,200);globalThis.fetch=async u=>String(u).includes('aviationweather.gov')?new Response('upstream down',{status:503}):new Response('2026/10/17 12:00\nLEIB 171200Z 06010KT CAVOK');const r=await worker.fetch(request('/metar'),env());assert.equal(r.status,200);assert.match((await r.json()).source,/NOAA/);});
test('METAR both providers down',async()=>{globalThis.fetch=async()=>new Response('unavailable',{status:503});assert.equal((await worker.fetch(request('/metar'),env())).status,502);});
test('forecast rejects out-of-area and masks external error details',async()=>{assert.equal((await worker.fetch(request('/forecast?lat=4&lon=3'),env())).status,400);globalThis.fetch=async()=>{throw Error('UPSTREAM_PRIVATE_ERROR');};const r=await worker.fetch(request('/forecast?lat=38.9&lon=1.4'),env());assert.equal(r.status,502);assert.equal((await r.text()).includes('UPSTREAM_PRIVATE_ERROR'),false);});
test('AEMET failure remains explicitly unverified',async()=>{globalThis.fetch=async()=>new Response('unavailable',{status:503});const r=await worker.fetch(request('/aemet'),env());assert.equal(r.status,200);assert.equal((await r.json()).verified,false);});
test('authorization and strict POST paths',async()=>{assert.equal((await worker.fetch(request('/','POST',JSON.stringify(trip)),env())).status,401);for(const path of ['/metar','/aemet','/forecast','/unknown','/briefing']){const r=await worker.fetch(request(path,'POST',JSON.stringify(trip),{'X-ARA-Access':'test-access'}),env());assert.equal(r.status,404,path);}});
test('null, primitives, arrays and malformed input return controlled HTTP 400',async()=>{for(const data of ['null','[]','true','12','"hello"','{bad','{}']){const r=await worker.fetch(request('/','POST',data,{'X-ARA-Access':'test-access'}),env());assert.equal(r.status,400,data);}});
test('authenticated AI briefing and restored marine safeguards',async()=>{let payload;globalThis.fetch=async(u,o)=>{if(String(u).includes('api.openai.com')){payload=JSON.parse(o.body);return json({output:[{content:[{type:'output_text',text:'Briefing OK'}]}],model:'test'});}return json({hourly:{time:[]}});};const r=await worker.fetch(request('/','POST',JSON.stringify(trip),{'X-ARA-Access':'test-access'}),env());assert.equal(r.status,200);assert.equal(payload!==undefined,true);assert.equal(JSON.parse(payload.input).selected_exceeds_radius,true);for(const phrase of ['crossing land','strong easterly','permitted radius','not forecast accuracy','do not claim AEMET warnings'])assert.match(payload.instructions,new RegExp(phrase,'i'));});
test('soft KV daily limit prevents requests at nominal cap',async()=>{const e=env(),key='requests:'+new Date().toISOString().slice(0,10);await e.AI_USAGE.put(key,'30');const r=await worker.fetch(request('/','POST',JSON.stringify(trip),{'X-ARA-Access':'test-access'}),e);assert.equal(r.status,429);});
test('upstream AI provider failure hides status',async()=>{globalThis.fetch=async u=>String(u).includes('api.openai.com')?new Response('failed',{status:429}):json({hourly:{time:[]}});const r=await worker.fetch(request('/','POST',JSON.stringify(trip),{'X-ARA-Access':'test-access'}),env());assert.equal(r.status,502);assert.deepEqual(await r.json(),{error:'OpenAI request failed'});});

const officialCoastalXml=(text='En Ibiza, Formentera y sur de Mallorca, precipitaciones muy fuertes con tormenta a partir de la madrugada.',end='2026-10-18T20:00:00')=>
  '<root id="FQXX44"><origen><productor>AEMET</productor></origen><aviso id="A807"><inicio>2026-10-17T20:00:00</inicio><fin>'+end+'</fin><texto>'+text+'</texto></aviso></root>';
test('extracts exact coastal Avisos text and CET/CEST validity, never CAP summary',()=>{
 const now=Date.parse('2026-10-18T00:00:00Z');
 const p=parseCoastalAvisos(officialCoastalXml(),now);
 assert.equal(p.verified,true);
 assert.equal(p.expired,false);
 assert.equal(p.avisos.length,1);
 assert.match(p.avisos[0].text,/precipitaciones muy fuertes con tormenta/);
 assert.equal(p.avisos[0].valid_until_local,'2026-10-18T20:00:00');
 assert.equal(p.source_url,'https://www.aemet.es/xml/maritima/FQXX44MM.xml');
});
test('expired coastal warnings cannot appear as active maritime warnings',()=>{
 const p=parseCoastalAvisos(officialCoastalXml(),Date.parse('2026-10-19T12:00:00Z'));
 assert.equal(p.expired,true);assert.equal(p.avisos.length,0);
 assert.equal(p.last_valid_until_local,'2026-10-18T20:00:00');
});
test('future coastal Avisos remain upcoming, not current',()=>{
 const p=parseCoastalAvisos(officialCoastalXml(),Date.parse('2026-10-17T12:00:00Z'));
 assert.equal(p.avisos.length,0);assert.equal(p.upcoming_avisos.length,1);assert.equal(p.expired,false);
});
test('malformed and incomplete coastal XML fail closed',()=>{
 for(const xml of ['<html>Blocked</html>','<root><origen/></root>','<root><origen></origen><aviso><texto>Storm</texto></aviso></root>']){
  assert.throws(()=>parseCoastalAvisos(xml,Date.now()));
 }
});
test('coastal warning retrieval is independent of CAP and OpenData failures',async()=>{
 globalThis.fetch=async u=>String(u).includes('/xml/maritima/FQXX44MM.xml')
  ?new Response(officialCoastalXml('Aviso oficial de temporal.'),{status:200,headers:{'Content-Type':'application/xml'}})
  :new Response('Service unavailable',{status:503});
 const r=await worker.fetch(request('/aemet'),env());assert.equal(r.status,200);
 const response=await r.json();
 assert.equal(response.marine_avisos.verified,true);
 assert.equal(response.marine_avisos.source,'AEMET Costa de Illes Balears coastal XML');
 assert.equal(response.warnings.verified,false);
 assert.equal(response.marine.verified,false);
 assert.equal(response.verified,false);
});
test('XML endpoint failure is explicit and cannot masquerade as all-clear',async()=>{
 globalThis.fetch=async()=>new Response('unavailable',{status:503});
 const r=await worker.fetch(request('/aemet'),env());assert.equal(r.status,200);
 const body=await r.json();assert.equal(body.marine_avisos.verified,false);
 assert.match(body.marine_avisos.error,/HTTP 503/);
});

test('Ibiza Sea School page parses every inline JavaScript block and keeps maritime warnings independent',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const html=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(x=>!/\bsrc\s*=/.test(x[1])&&!/type\s*=\s*["'](?:application\/json|importmap)/i.test(x[1]));
 assert.ok(scripts.length>8,'expected existing weather-desk scripts');
 for(const [index,script] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(script[2],{filename:'ara-inline-'+index+'.js'}));
 assert.match(html,/coastalAvisos=d\.marine_avisos\|\|null/);
 assert.match(html,/const coastal=coastalAvisos/);
 assert.match(html,/coastal\.expired/);
 assert.match(html,/CAP colour alerts are supplementary/);
});
test('public coastal warnings remain available without an OpenData API key',async()=>{
 globalThis.fetch=async u=>String(u).includes('/xml/maritima/FQXX44MM.xml')?new Response(officialCoastalXml(),{status:200}):new Response('unavailable',{status:503});
 const e=env();delete e.AEMET_API_KEY;
 const r=await worker.fetch(request('/aemet'),e);
 const body=await r.json();
 assert.equal(body.marine_avisos.verified,true);
 assert.equal(body.marine.verified,false);
 assert.equal(body.warnings.verified,false);
 assert.equal(body.marine_avisos.avisos.length>0,true);
});

test('a verbatim No hay avisos statement is not classified as a maritime alert',()=>{
 const result=parseCoastalAvisos(officialCoastalXml('No hay avisos.'),Date.parse('2026-10-18T00:00:00Z'));
 assert.equal(result.no_warnings_current,true);
 assert.equal(result.avisos.length,1);
 assert.equal(result.avisos[0].text,'No hay avisos.');
 assert.equal(result.expired,false);
 const dangerous=parseCoastalAvisos(officialCoastalXml('En Ibiza, temporal marítimo.'),Date.parse('2026-10-18T00:00:00Z'));
 assert.equal(dangerous.no_warnings_current,false);
});
test('invalid warning validity chronology is rejected rather than displayed',()=>{
 const invalid=officialCoastalXml('Aviso.', '2026-10-17T10:00:00');
 assert.throws(()=>parseCoastalAvisos(invalid,Date.parse('2026-10-18T00:00:00Z')),/validity/);
});
test('maritime interface includes an explicit official No hay avisos status',async()=>{
 const fs=await import('node:fs/promises');
 const page=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.match(page,/coastal\.no_warnings_current/);
 assert.match(page,/No hay avisos \(no maritime warnings issued\)/);
 assert.match(page,/AEMET coastal maritime warning/);
});

test('Ibiza Sea School masthead removes private vessel branding and retains edition',async()=>{
 const fs=await import('node:fs/promises');
 const html=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.match(html,/<title>Ibiza Sea School/);
 assert.match(html,/<header class="hero">[\s\S]*ibiza-sea-school-logo\.webp/);
 assert.match(html,/CAPTAIN'S WEATHER &amp; MARITIME DESK/);
 assert.match(html,/EDITION V5\.33/);
 for(const forbidden of [/<h1>ARA<\/h1>/i,/WALLYPOWER\s*58/i,/Private vessel operations/i,/assets\/ara-hero\.jpg/i,/ARA Weather App/i])assert.doesNotMatch(html,forbidden);
 const logo=await fs.readFile(new URL('../../ibiza-sea-school/assets/ibiza-sea-school-logo.webp',import.meta.url));
 assert.equal(logo.subarray(0,4).toString(),'RIFF');
 assert.equal(logo.subarray(8,12).toString(),'WEBP');
});
test('Ibiza Sea School weather route keeps local app files and valid inline scripts',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const root=new URL('../../ibiza-sea-school/',import.meta.url);
 const html=await fs.readFile(new URL('index.html',root),'utf8');
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(x=>!/\bsrc\s*=/.test(x[1]));
 for(const [i,tag] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(tag[2],{filename:'iss-'+i}));
 assert.match(html,/window\.issGetMetForecast/);
 assert.doesNotMatch(html,/window\.araGetMetForecast/);
 const app=await fs.readFile(new URL('app.js',root),'utf8');
 assert.doesNotThrow(()=>new vm.Script(app));
 assert.doesNotMatch(app,/ARA CAPTAIN WEATHER REVIEW/);
 const manifest=JSON.parse(await fs.readFile(new URL('manifest.webmanifest',root),'utf8'));
 assert.match(manifest.name,/Ibiza Sea School/);
 for(const item of ['app.js','manifest.webmanifest','service-worker.js','assets/ibiza-sea-school-icon.svg'])assert.ok((await fs.stat(new URL(item,root))).isFile(),item);
});
test('retired public weather route redirects to branded path and clears old shell',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const legacy=new URL('../../ara/',import.meta.url);
 const html=await fs.readFile(new URL('index.html',legacy),'utf8');
 assert.match(html,/<meta http-equiv="refresh" content="0;url=\.\.\/ibiza-sea-school\/"/);
 assert.match(html,/location\.replace\('\.\.\/ibiza-sea-school\/'\)/);
 assert.doesNotMatch(html,/WALLYPOWER|Private vessel|<h1>ARA<\/h1>/i);
 const sw=await fs.readFile(new URL('service-worker.js',legacy),'utf8');
 assert.doesNotThrow(()=>new vm.Script(sw));
 assert.match(sw,/caches\.delete/);
 for(const obsolete of ['app.js','manifest.webmanifest','assets/ara-hero.jpg','assets/icon-180.png','assets/icon-192.png','assets/icon-512.png']){
  await assert.rejects(fs.stat(new URL(obsolete,legacy)),{code:'ENOENT'},'legacy asset still published: '+obsolete);
 }
});

test('personal observatory stays unchanged and weather desk has no cross-site navigation',async()=>{
 const fs=await import('node:fs/promises');
 const root=await fs.readFile(new URL('../../index.html',import.meta.url),'utf8');
 assert.match(root,/STEPHEN'S WEATHER &amp; MARINE OBSERVATORY/);
 assert.match(root,/href="\.\/ara\/"/); // private personal site is unchanged
 const branded=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(branded,/Stephen.s Observatory|observatory-nav|href="\.\.\/"/i);
 assert.match(branded,/Ibiza Sea School — Captain.s Weather/);
});

test('Ibiza Sea School light theme matches official logo and places the language selector above AEMET',async()=>{
 const fs=await import('node:fs/promises'),assertStrict=assert;
 const page=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 const header=page.slice(page.indexOf('<header class="hero">'),page.indexOf('</header>',page.indexOf('<header class="hero">'))+9);
 const aemet=page.slice(page.indexOf('<section class="alert aemet-fixed"'),page.indexOf('</section>',page.indexOf('<section class="alert aemet-fixed"'))+10);
 assertStrict.doesNotMatch(header,/id="global-(en|es)"/);
 assertStrict.match(page,/<div class="iss-language-bar"[^>]*>[\s\S]*?id="global-en"[\s\S]*?id="global-es"[\s\S]*?<\/div>[\s\S]*?<section class="alert aemet-fixed"/);
 assertStrict.doesNotMatch(aemet,/id="global-(en|es)"/);
 assertStrict.equal((page.match(/id="global-en"/g)||[]).length,1);
 assertStrict.equal((page.match(/id="global-es"/g)||[]).length,1);
 assertStrict.match(page,/--iss-blue:#202c76/);
 assertStrict.match(page,/--iss-red:#d10049/);
 assertStrict.match(page,/\.aemet-fixed\{[\s\S]*?background:#fff!important/);
 assertStrict.match(page,/<meta name="theme-color" content="#ffffff">/);
 assertStrict.match(page,/\.aemet-fixed \.aemet-warning-value\{color:#99163d!important\}/);
 assertStrict.match(page,/coastalAvisos=d\.marine_avisos\|\|null/);
 const install=JSON.parse(await fs.readFile(new URL('../../ibiza-sea-school/manifest.webmanifest',import.meta.url),'utf8'));
 assertStrict.equal(install.background_color,'#ffffff');
 assertStrict.equal(install.theme_color,'#ffffff');
});
test('Ibiza Sea School styling leaves personal observatory and retired legacy redirect untouched',async()=>{
 const fs=await import('node:fs/promises');
 const personal=await fs.readFile(new URL('../../index.html',import.meta.url),'utf8');
 assert.match(personal,/STEPHEN'S WEATHER &amp; MARINE OBSERVATORY/);
 const legacy=await fs.readFile(new URL('../../ara/index.html',import.meta.url),'utf8');
 assert.match(legacy,/url=\.\.\/ibiza-sea-school\//);
});

test('site theme finish preserves accountabilities, removes redundant review and uses honest warnings',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const html=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.match(html,/id="command-report"/);
 assert.doesNotMatch(html,/id="review"/);
 assert.doesNotMatch(html,/id="copyReview"/);
 assert.match(html,/Command, accountability &amp; reporting/);
 assert.match(html,/class="airport-plane"/);
 assert.match(html,/\.airport-plane\{color:#d10049!important/);
 assert.match(html,/\.airport-stat\{background:#f7f9fc!important/);
 assert.match(html,/\.iss-now-caution\{background:#fff2f5!important/);
 assert.match(html,/\.day \.day-stat\{background:#f7f9fc!important/);
 assert.match(html,/#coastalCamera\s*option\{background:#fff;color:#202c76\}/);
 assert.match(html,/const englishAviso=\(spanish\)=>/);
 assert.match(html,/p.textContent=original;p.lang='es'/);
 assert.match(html,/English translation unavailable for this wording/);
 assert.match(html,/warningParagraph\(aviso\)/);
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(a=>!/\bsrc\s*=/.test(a[1]));
 for(const [i,a] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(a[2],{filename:'ibiza-script-'+i}));
});

test('raw METAR fallback parser handles recognised wind and temperature only',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const html=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 const m=html.match(/function airportDecoded\(x\)\{[\s\S]*?\n\}\nfunction airportPressure/);
 assert.ok(m,'METAR decoder present');
 const context=vm.createContext({});
 vm.runInContext(m[0].slice(0,-'function airportPressure'.length),context);
 const raw={rawOb:'LEIB 181130Z 08012G23KT 9999 FEW030 21/14 Q1015'};
 const decoded=context.airportDecoded(raw);
 assert.equal(decoded.wspd,12);
 assert.equal(decoded.wdir,80);
 assert.equal(decoded.temp,21);
 const variable=context.airportDecoded({rawOb:'LEIB 181200Z VRB03KT CAVOK M02/M05 Q1015'});
 assert.equal(variable.wspd,3);
 assert.equal(variable.wdir,'VRB');
 assert.equal(variable.temp,-2);
 const absent=context.airportDecoded({rawOb:'LEIB 181200Z CAVOK Q1015'});
 assert.equal(absent.wspd,undefined);
 assert.equal(absent.temp,undefined);
 const preferred=context.airportDecoded({rawOb:raw.rawOb,wdir:190,wspd:8,temp:19});
 assert.equal(preferred.wdir,190);assert.equal(preferred.wspd,8);assert.equal(preferred.temp,19);
});

test('V5.27 edition, upper controls and Captain summary branding match release',async()=>{
 const fs=await import('node:fs/promises');
 const page=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 const sw=await fs.readFile(new URL('../../ibiza-sea-school/service-worker.js',import.meta.url),'utf8');
 assert.match(page,/EDITION V5\.33/);
 assert.match(page,/Weather Summary <span class="iss-version">V5\.33/);
 assert.match(page,/Ibiza Sea School Weather · V5\.33/);
 assert.doesNotMatch(page,/V5\.25/);
 assert.match(sw,/ibiza-sea-school-weather-v5\.33-20261018/);
 assert.match(page,/\.iss-toolbar \.iss-signoff\{justify-self:center!important/);
 assert.match(page,/\.iss-toolbar #iss-ai-launch\{justify-self:end!important/);
 assert.match(page,/\.iss-area-controls \.select\{padding-left:9px!important/);
 assert.match(page,/#captain-weather-summary\{\s*background:#fff!important/);
 assert.match(page,/border-top:5px solid #d10049!important/);
});

test('AEMET warning always displays the Spanish original and offers English separately',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const html=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 const fn=html.slice(html.indexOf('  const englishAviso=(spanish)=>{'),html.indexOf('  const warningParagraph=(aviso)=>'));
 assert.ok(fn.startsWith('  const englishAviso='));
 const translate=vm.runInNewContext(fn+'\nenglishAviso');
 const original='Precipitaciones muy fuertes con tormenta. en aguas costeras del nordeste y noroeste de Mallorca, Ibiza y canal de Mallorca, temporalmente NE 7 y olas de 3 m.';
 assert.match(translate(original),/Very heavy precipitation with thunderstorms/);
 assert.match(translate(original.replace('tormenta. en','tormentas, en')),/Very heavy precipitation/);
 assert.equal(translate('Rachas variables de intensidad no verificada.'),null);
 assert.match(html,/p\.textContent=original;p\.lang='es'/);
 assert.match(html,/English translation: /);
 assert.match(html,/English translation unavailable for this wording/);
 assert.doesNotMatch(html,/Original AEMET Spanish wording'\s*:/);
});
test('Captain caution above AEMET, model methodology folded away, airport warning legible',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const html=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 const c=html.indexOf('<p id="cs-caution"'),a=html.indexOf('<section class="alert aemet-fixed"');
 assert.ok(c>0&&c<a);
 assert.equal((html.match(/id="cs-caution"/g)||[]).length,1);
 assert.match(html,/class="iss-model-footnote"/);
 assert.match(html,/<p id="cs-model-detail" aria-live="polite">/);
 assert.match(html,/\.airport-location-warning strong\{color:#d10049!important\}/);
 assert.match(html,/EDITION V5\.33/);
 assert.match(html,/Weather Summary <span class="iss-version">V5\.33/);
 const sw=await fs.readFile(new URL('../../ibiza-sea-school/service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/ibiza-sea-school-weather-v5\.33-20261018/);
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1]));
 for(const m of scripts)assert.doesNotThrow(()=>new vm.Script(m[2]));
});

test('Ibiza-local day/night windows span midnight correctly and respect chosen date',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const page=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 const start=page.indexOf('const changeDay=(day,offset)=>');
 const end=page.indexOf('let activeWindow=null;',start);
 assert.ok(start>0&&end>start);
 const helpers=page.slice(start,end);
 const ctx=vm.createContext({});vm.runInContext(helpers+'\nthis.getWindow=resolveShift;this.getPeriod=periodLabel;',ctx);
 const day=ctx.getWindow('2026-10-18','day',{day:'2026-10-18',hour:12});
 assert.equal(day.start,'2026-10-18T08:00');assert.equal(day.end,'2026-10-18T20:00');
 const night=ctx.getWindow('2026-10-18','night',{day:'2026-10-18',hour:18});
 assert.equal(night.start,'2026-10-18T20:00');assert.equal(night.end,'2026-10-19T08:00');
 assert.match(ctx.getPeriod(night),/20:00–08:00 next day/);
 const autoLate=ctx.getWindow('2026-10-18','auto',{day:'2026-10-18',hour:21});
 assert.equal(autoLate.mode,'night');
 const autoEarly=ctx.getWindow('2026-10-18','auto',{day:'2026-10-19',hour:3});
 assert.equal(autoEarly.start,'2026-10-18T20:00');
 assert.equal(autoEarly.end,'2026-10-19T08:00');
 const autoSix=ctx.getWindow('2026-10-19','auto',{day:'2026-10-19',hour:8});
 assert.equal(autoSix.mode,'day');assert.equal(autoSix.start,'2026-10-19T08:00');
 const autoBoundary=ctx.getWindow('2026-10-19','auto',{day:'2026-10-19',hour:20});
 assert.equal(autoBoundary.mode,'night');
 assert.match(page,/id="iss-shift"/);
 assert.match(page,/&start_date=\$\{window.startDay\}&end_date=\$\{window.endDay\}/);
 assert.match(page,/x\.time>=activeWindow\.start&&x\.time<activeWindow\.end/);
 assert.match(page,/x\.time>=window\.start&&x\.time<window\.end/);
 assert.match(page,/sampleHour=window\.mode==='night'\?'21:00':'12:00'/);
});
test('V5.28 wind compass, expanded weather labels and actual-observations badge',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const page=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.match(page,/EDITION V5\.33/);
 assert.match(page,/id="cs-wind-compass"/);
 assert.match(page,/id="cs-wind-needle"/);
 assert.match(page,/Forecast wind FROM/);
 assert.match(page,/\.captain-summary-card:nth-child\(-n\+2\) strong\{font-size:22px!important/);
 assert.match(page,/class="airport-observed-badge">ACTUAL OBSERVATIONS/);
 assert.match(page,/LIVE LEIB METAR/);
 const sw=await fs.readFile(new URL('../../ibiza-sea-school/service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/ibiza-sea-school-weather-v5\.33-20261018/);
 const scripts=[...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1]));
 for(const [i,m] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(m[2],{filename:'inline'+i}));
});

test('V5.30 Captain card typography and Beaufort-only summary regressions',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const page=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.match(page,/EDITION V5\.33/);
 assert.match(page,/\.captain-summary-card small\{font-size:13px!important;font-weight:750!important/);
 assert.match(page,/\.captain-summary-card:nth-child\(-n\+2\) strong\{font-size:27px!important/);
 assert.match(page,/\$\('cs-wind-force'\)\.textContent=numbers\.length>=2\?'F'\+beaufort\(numbers\[0\]\)\+'–F'\+beaufort\(numbers\[1\]\)\+' \(Beaufort\)'/);
 assert.doesNotMatch(page,/function force\(kn\)/);
 const sw=await fs.readFile(new URL('../../ibiza-sea-school/service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/ibiza-sea-school-weather-v5\.33-20261018/);
 const scripts=[...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1]));
 for(const [i,m] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(m[2],{filename:'inline'+i}));
});

test('V5.31 summary metrics align, warnings stay distinct from daily forecast descriptions',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const html=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.match(html,/EDITION V5\.33/);
 assert.match(html,/\.captain-summary-card>div\{grid-column:2;grid-row:1 \/ span 3;display:grid!important/);
 assert.match(html,/\.captain-summary-card small\{grid-row:1!important/);
 assert.match(html,/\.captain-summary-card strong\{grid-row:2!important/);
 assert.match(html,/class="captain-alert-icon"/);
 assert.match(html,/captain-caution-message/);
 assert.match(html,/\.iss-now-weather #sky\{font-size:clamp\(21px,2\.2vw,31px\)!important/);
 assert.match(html,/#iss-now-force,#iss-now-gust-force\{font-size:clamp\(25px,2\.7vw,38px\)!important/);
 assert.match(html,/\.day \.day-weather\{font-size:16px!important;font-weight:800!important;color:#bb1548!important/);
 assert.doesNotMatch(html,/\.day \.day-weather:before\{content:"⚠ "/);
 const sw=await fs.readFile(new URL('../../ibiza-sea-school/service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/ibiza-sea-school-weather-v5\.33-20261018/);
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1]));
 for(const [i,m] of scripts.entries())assert.doesNotThrow(()=>new vm.Script(m[2],{filename:'inline'+i}));
});

test('Ibiza Sea School V5.32 improves three-day and detailed forecast readability',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const page=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.match(page,/EDITION V5\.33/);
 assert.match(page,/\.day \.day-coverage\{font-size:14px!important;font-weight:700!important;color:#415578!important/);
 assert.match(page,/\.day \.day-icon\{font-size:55px!important/);
 assert.match(page,/\.day \.day-weather\{font-size:19px!important;font-weight:850!important;color:#bf1248!important/);
 assert.match(page,/\.day \.day-stat small\{font-size:13px!important/);
 assert.match(page,/\.iss-hourly-table\{font-size:14px!important;color:#202c76!important/);
 assert.match(page,/\.iss-hourly-table tbody td\[style\]\{color:#20345c!important/);
 const sw=await fs.readFile(new URL('../../ibiza-sea-school/service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/ibiza-sea-school-weather-v5\.33-20261018/);
 const scripts=[...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1]));
 for(const m of scripts)assert.doesNotThrow(()=>new vm.Script(m[2]));
});

test('captain passage V5.33 has restricted vessel and captain choices and does not claim live delivery',async()=>{
 const fs=await import('node:fs/promises'),vm=await import('node:vm');
 const page=await fs.readFile(new URL('../../ibiza-sea-school/index.html',import.meta.url),'utf8');
 assert.match(page,/id="rv-captain" required/);assert.match(page,/Other Captain/);
 for(const n of ['Dominic','Craig','Jaime','007','A58','HYGGELIG','LARISSA'])assert.ok(page.includes(n));
 assert.match(page,/id="rv-vessel" required/);
 assert.match(page,/id="rv-email-other-wrap" hidden/);
 assert.match(page,/id="rv-submit"[^>]*disabled/);
 assert.doesNotMatch(page,/id="rv-whatsapp"/);
 assert.doesNotMatch(page,/id="rv-copy"/);
 assert.match(page,/NOT SENT\. Secure email delivery has not been activated/);
 assert.match(page,/EDITION V5\.33/);
 const worker=await fs.readFile(new URL('../../ibiza-sea-school/service-worker.js',import.meta.url),'utf8');
 assert.match(worker,/ibiza-sea-school-weather-v5\.33-20261018/);
 const scripts=[...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1]));
 for(const a of scripts)assert.doesNotThrow(()=>new vm.Script(a[2]));
});
