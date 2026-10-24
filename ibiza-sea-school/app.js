'use strict';
/* Ibiza Sea School Weather App V2 — source-visible demonstration. No backend, login or compliance audit. */
const SPOTS={
 san:{name:'Sant Antoni · Ibiza',land:[38.9801,1.3036],sea:[38.984,1.247],zone:'Europe/Madrid',caption:'Approx. offshore model grid west of Sant Antoni · not harbour conditions'},
 ibiza:{name:'Ibiza Town · Ibiza',land:[38.9067,1.4206],sea:[38.883,1.465],zone:'Europe/Madrid',caption:'Approx. offshore model grid outside Ibiza harbour · not berth conditions'},
 vedr:{name:'Es Vedrà · Ibiza',land:[38.869,1.196],sea:[38.845,1.173],zone:'Europe/Madrid',caption:'Exposed waters near Es Vedrà · model grid, not observed conditions'},
 form:{name:'Formentera · Balearics',land:[38.6964,1.4531],sea:[38.68,1.464],zone:'Europe/Madrid',caption:'Approx. offshore model grid near Formentera · not harbour conditions'},
 mallorca_sw:{name:'Southwest Mallorca · Puerto Portals',land:[39.535,2.59],sea:[39.51,2.59],zone:'Europe/Madrid',caption:'Approx. coastal forecast grid off Puerto Portals · not marina or berth conditions'},
 mallorca_n:{name:'North Mallorca · Alcúdia Bay',land:[39.84,3.13],sea:[39.87,3.17],zone:'Europe/Madrid',caption:'Approx. forecast grid in Alcúdia Bay · not harbour conditions'}
};
const $=id=>document.getElementById(id);
const fmt=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(d):'—';
const card=(n,u,d=0)=>n==null||!Number.isFinite(n)?'—':`${fmt(n,d)} <em>${u}</em>`;
const dir=x=>typeof x==='number'&&Number.isFinite(x)?['N','NE','E','SE','S','SW','W','NW'][Math.round((x%360)/45)%8]:'—';
const direction=x=>Number.isFinite(x)?`${dir(x)} · ${Math.round(x)}° (from)`:'Direction unavailable';
const codeLabel={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorm',96:'Thunderstorm / hail',99:'Severe thunderstorm / hail'};
const sky=x=>codeLabel[x]||'Conditions not classified';
const clampText=(s,len=160)=>String(s??'').slice(0,len);
let forecast=null,marine=null,pressureHistory=[],selectedHours=72,selectedMap='wind',mapLoaded=false,requestSeq=0,pendingInstall=null,nowHour=0;
let lastUpdate=null;
function currentSpot(){return SPOTS[$('location').value]||SPOTS.san}
function localDay(date){return new Date(date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
function todayIndex(times,time){let i=times.findIndex(t=>t>=time.slice(0,13)+':00');return i>=0?i:Math.max(0,times.length-1)}
function safeIndex(arr,i){return Array.isArray(arr)&&i>=0&&i<arr.length?arr[i]:null}
async function getJSON(url){const res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout?AbortSignal.timeout(14000):undefined});if(!res.ok)throw Error(`HTTP ${res.status}`);const json=await res.json();if(json.error)throw Error(json.reason||'Provider response error');return json}
function setHTML(id,html){$(id).innerHTML=html}
function resetWeather(){for(const id of ['wind','gust','wave','wavePeriod','press','swell','temp','rain'])$(id).textContent='—';for(const id of ['windDir','waveDir','waveSource','swellDir','pressureTrend','sky','rainSub','gustSub'])$(id).textContent='Awaiting current model data';$('quickRead').textContent='Weather forecast data unavailable. Check primary official sources directly.';$('days').innerHTML='<div class="day">Current forecast unavailable. Open AEMET.</div>';$('hourly').textContent='No current model data available.';for(const id of ['ecmwf','ukmo'])$(id).textContent='Model comparison unavailable.';pressureHistory=[];drawBarograph()}
function forecastUrl(s){const p=new URLSearchParams({latitude:s.land[0],longitude:s.land[1],timezone:s.zone,wind_speed_unit:'kn',past_days:'7',forecast_days:'4',current:'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl',hourly:'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,precipitation_probability,pressure_msl',daily:'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,precipitation_probability_max'});return 'https://api.open-meteo.com/v1/forecast?'+p}
function marineUrl(s){const p=new URLSearchParams({latitude:s.sea[0],longitude:s.sea[1],timezone:s.zone,cell_selection:'sea',forecast_days:'4',current:'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period',hourly:'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period'});return 'https://marine-api.open-meteo.com/v1/marine?'+p}
function modelUrl(s,model){const p=new URLSearchParams({latitude:s.land[0],longitude:s.land[1],timezone:s.zone,wind_speed_unit:'kn',forecast_days:'4',daily:'precipitation_sum,wind_gusts_10m_max',models:model});return 'https://api.open-meteo.com/v1/forecast?'+p}
async function refresh(){const seq=++requestSeq,s=currentSpot();forecast=null;marine=null;lastUpdate=null;resetWeather();$('areaName').textContent=s.name;$('dataIndicator').innerHTML='<span class="dot"></span> Retrieving forecasts';$('dataUpdated').textContent='Fetching latest model guidance…';$('refresh').disabled=true;updateMapLinks();const results=await Promise.allSettled([getJSON(forecastUrl(s)),getJSON(marineUrl(s))]);if(seq!==requestSeq)return;
 const weatherOK=results[0].status==='fulfilled';const seaOK=results[1].status==='fulfilled';
 if(weatherOK)forecast=results[0].value;
 if(seaOK)marine=results[1].value;
 if(weatherOK||seaOK){lastUpdate=new Date();renderWeather();$('dataIndicator').innerHTML=`<span class="dot ${weatherOK&&seaOK?'ok':'bad'}"></span> ${weatherOK&&seaOK?'Weather and marine models loaded':'Partial forecast data'}`;$('dataUpdated').textContent=`Fetched ${lastUpdate.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:s.zone})} Ibiza time · ${s.caption}`;}
 else{$('dataIndicator').innerHTML='<span class="dot bad"></span> Forecast retrieval failed';$('dataUpdated').textContent='No current models available. Check internet and use AEMET direct links.';}
 $('refresh').disabled=false;loadModelComparisons(s,seq);
}
function nearestMarine(){if(!marine)return null;const c=marine.current;if(c&&typeof c.wave_height==='number')return c;const h=marine.hourly;if(!h||!h.time)return null;const offset=h.time.findIndex(t=>t>=new Date().toLocaleString('sv-SE',{timeZone:currentSpot().zone}).replace(' ','T').slice(0,13));const ix=offset<0?h.time.length-1:offset;return {wave_height:safeIndex(h.wave_height,ix),wave_direction:safeIndex(h.wave_direction,ix),wave_period:safeIndex(h.wave_period,ix),swell_wave_height:safeIndex(h.swell_wave_height,ix),swell_wave_direction:safeIndex(h.swell_wave_direction,ix),swell_wave_period:safeIndex(h.swell_wave_period,ix)};}
function getTend(h){const len=pressureHistory.length;if(len<=h)return null;const old=pressureHistory[len-1-h]?.p,newest=pressureHistory[len-1]?.p;return Number.isFinite(old)&&Number.isFinite(newest)?newest-old:null}
function change(v){return v==null?'—':(v>0?'+':'')+fmt(v,1)}
function renderWeather(){const s=currentSpot(),w=forecast?.current||{},h=forecast?.hourly||{},m=nearestMarine()||{};
 nowHour=forecast?.current?.time?todayIndex(h.time||[],forecast.current.time):0;
 $('wind').innerHTML=card(w.wind_speed_10m,'kn',0);$('windDir').textContent=direction(w.wind_direction_10m);
 $('gust').innerHTML=card(w.wind_gusts_10m,'kn',0);$('gustSub').textContent='Gust speed at forecast model time';
 $('wave').innerHTML=card(m.wave_height,'m',1);$('waveDir').textContent=direction(m.wave_direction);
 $('wavePeriod').innerHTML=card(m.wave_period,'s',0);$('waveSource').textContent=s.caption;
 $('swell').textContent=Number.isFinite(m.swell_wave_height)?`${fmt(m.swell_wave_height,1)} m`:'—';$('swellDir').textContent=direction(m.swell_wave_direction);
 $('press').textContent=Number.isFinite(w.pressure_msl)?`${fmt(w.pressure_msl,1)} hPa`:'—';$('temp').textContent=Number.isFinite(w.temperature_2m)?`${fmt(w.temperature_2m,1)} °C`:'—';$('sky').textContent=sky(w.weather_code);
 const chance=safeIndex(h.precipitation_probability,nowHour);$('rain').textContent=Number.isFinite(chance)?`${fmt(chance)} %`:'—';$('rainSub').textContent='At modelled forecast hour';
 if(Array.isArray(h.time)){
  const now=forecast.current?.time||'';
  pressureHistory=h.time.map((t,i)=>({t,p:safeIndex(h.pressure_msl,i)})).filter(q=>q.t<=now&&Number.isFinite(q.p));
 }else pressureHistory=[];
 $('pressureTrend').textContent=`3 h ${change(getTend(3))} · 6 h ${change(getTend(6))} · 24 h ${change(getTend(24))}`;
 renderQuickRead(w,m,h);renderDays();renderHourly();drawBarograph();
}
function renderQuickRead(w,m,h){const bits=[];
 if(Number.isFinite(w.wind_gusts_10m)){if(w.wind_gusts_10m>=30)bits.push('Strong modelled gusts: assess exposure, manoeuvring margins and local squalls.');else if(w.wind_gusts_10m>=20)bits.push('Notable forecast gusts: consider exposed berths and planned activities.');else bits.push('Forecast gusts appear relatively modest at the selected land grid; local conditions may differ.');}else bits.push('Wind gust guidance unavailable.');
 if(Number.isFinite(m.wave_height)){if(m.wave_height>=2)bits.push('Significant offshore waves forecast: examine routing, swell period and vessel motion.');else if(m.wave_height>=1)bits.push('Meaningful offshore wave activity forecast: compare sheltered and exposed passages.');else bits.push('Offshore wave-height model is relatively low; it does not describe wave conditions at the berth.');}else bits.push('Marine wave guidance unavailable.');
 const probability=safeIndex(h.precipitation_probability,nowHour);if(Number.isFinite(probability)&&probability>=60)bits.push('Rain likelihood is elevated around the selected forecast hour.');
 if([95,96,99].includes(w.weather_code))bits.push('Thunderstorm conditions indicated by model: consult official warnings immediately.');
 bits.push('Official AEMET marine warnings remain unverified in this app.');
 $('quickRead').innerHTML=bits.map(t=>`<p style="margin:0 0 9px">• ${t}</p>`).join('');}
function renderDays(){const d=forecast?.daily;if(!d){$('days').innerHTML='<div class="day">Three-day forecast currently unavailable.</div>';return;}const localToday=new Date().toLocaleDateString('sv-SE',{timeZone:currentSpot().zone});let start=d.time.indexOf(localToday);if(start<0)start=0;
 $('days').innerHTML=d.time.slice(start,start+3).map((day,k)=>{const i=start+k;return `<div class="day"><h3>${localDay(day)}</h3><div class="detail">${sky(safeIndex(d.weather_code,i))}</div><div class="temp">${fmt(safeIndex(d.temperature_2m_max,i))}° <span>/ ${fmt(safeIndex(d.temperature_2m_min,i))}°C</span></div><div class="rowinfo">Max wind ${fmt(safeIndex(d.wind_speed_10m_max,i))} kn · gust ${fmt(safeIndex(d.wind_gusts_10m_max,i))} kn</div><div class="rowinfo">Rain ${fmt(safeIndex(d.precipitation_sum,i),1)} mm · probability ${fmt(safeIndex(d.precipitation_probability_max,i))}%</div></div>`}).join('');}
function marineAt(hourTime){const h=marine?.hourly;if(!h?.time)return {};const idx=h.time.indexOf(hourTime);return idx<0?{}:{wave:safeIndex(h.wave_height,idx),dir:safeIndex(h.wave_direction,idx),swell:safeIndex(h.swell_wave_height,idx),swellDir:safeIndex(h.swell_wave_direction,idx)}}
function renderHourly(){const h=forecast?.hourly;if(!h?.time){$('hourly').textContent='Three-hour forecast unavailable.';return}let rows=[];const start=Math.max(0,nowHour);for(let i=start;i<h.time.length&&rows.length<24;i+=3){const t=h.time[i],m=marineAt(t);rows.push(`<tr><td>${t.slice(5,10)} ${t.slice(11,16)}</td><td>${sky(safeIndex(h.weather_code,i))}</td><td>${fmt(safeIndex(h.temperature_2m,i))}°</td><td>${dir(safeIndex(h.wind_direction_10m,i))}</td><td>${fmt(safeIndex(h.wind_speed_10m,i))}</td><td>${fmt(safeIndex(h.wind_gusts_10m,i))}</td><td>${fmt(m.wave,1)} / ${dir(m.dir)}</td><td>${fmt(m.swell,1)}</td><td>${fmt(safeIndex(h.precipitation,i),1)}</td><td>${fmt(safeIndex(h.precipitation_probability,i))}%</td></tr>`)}
 setHTML('hourly','<table><thead><tr><th>Ibiza time</th><th>Conditions</th><th>°C</th><th>Wind dir.</th><th>Wind kn</th><th>Gust kn</th><th>Waves m / dir.</th><th>Swell m</th><th>Rain mm/h</th><th>Rain %</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>');}
async function loadModelComparisons(s,seq){await Promise.all([['ecmwf','ecmwf_ifs025'],['ukmo','ukmo_global_deterministic_10km']].map(async([target,model])=>{try{const d=await getJSON(modelUrl(s,model));if(seq!==requestSeq)return;const daily=d.daily;if(!daily?.time)throw Error('No model daily variables');const today=new Date().toLocaleDateString('sv-SE',{timeZone:s.zone});const from=Math.max(0,daily.time.indexOf(today));$(target).innerHTML=daily.time.slice(from,from+3).map((day,k)=>{const i=from+k;return `<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #29424c;padding:11px 0"><span>${localDay(day)}</span><span>Rain ${fmt(safeIndex(daily.precipitation_sum,i),1)} mm · Gust ${fmt(safeIndex(daily.wind_gusts_10m_max,i))} kn</span></div>`}).join('')+`<div class="footnote">${model} · model-derived forecast</div>`;}catch(e){if(seq===requestSeq)$(target).textContent='This model comparison is unavailable. No values inferred.'}}));}
function drawBarograph(){const cvs=$('barograph');if(!cvs)return;const cssw=cvs.clientWidth,cssh=cvs.clientHeight;if(cssw<=0||cssh<=0)return;const dpr=Math.min(window.devicePixelRatio||1,2),w=cssw,h=cssh;cvs.width=Math.round(w*dpr);cvs.height=Math.round(h*dpr);const c=cvs.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#f2e9d6';c.fillRect(0,0,w,h);const l=47,r=15,t=15,b=31;const pw=w-l-r,ph=h-t-b;const y=v=>t+(1050-v)/100*ph;
 for(let p=950;p<=1050;p+=5){const major=p%10===0;c.beginPath();c.strokeStyle=major?'#cc8585':'#e4afaa';c.lineWidth=major?.7:.42;c.moveTo(l,y(p));c.lineTo(w-r,y(p));c.stroke();if(major){c.font='10px Georgia';c.fillStyle='#735c5b';c.fillText(String(p),5,y(p)+3)}}
 for(let k=0;k<=12;k++){const x=l+pw*k/12;c.beginPath();c.strokeStyle=k%3===0?'#cc8585':'#e4afaa';c.lineWidth=k%3===0?.75:.45;c.moveTo(x,t);c.lineTo(x,h-b);c.stroke();}
 const data=pressureHistory.slice(-selectedHours);if(data.length>1){c.save();c.beginPath();c.rect(l,t,pw,ph);c.clip();c.strokeStyle='#772440';c.lineWidth=2.2;c.lineJoin='round';c.lineCap='round';c.beginPath();data.forEach((o,i)=>{const x=l+pw*i/(data.length-1),py=y(o.p);if(i)c.lineTo(x,py);else c.moveTo(x,py)});c.stroke();c.restore();}
 c.font='11px Georgia';c.fillStyle='#735c5b';c.fillText(selectedHours===168?'7 DAYS AGO':`${selectedHours} HOURS AGO`,l,h-9);c.fillText('NOW',w-r-28,h-9);
 const out=data.some(x=>x.p<950||x.p>1050);$('baroNote').textContent=out?'WARNING: pressure outside 950–1050 hPa fixed scale · clipped trace · historical model data':data.length?'950–1050 hPa fixed scale · historical model-derived pressure (not an observed station trace)':'Historical data unavailable · awaiting live model response';}
function updateMapLinks(){const s=currentSpot(),base=`https://www.windy.com/${s.land[0].toFixed(3)}/${s.land[1].toFixed(3)}`;$('windyLink').href=base;$('windySource').href=base; if(mapLoaded)showMap();}
function showMap(){mapLoaded=true;const s=currentSpot();const layers={wind:'wind',waves:'waves',pressure:'pressure'};const qs=new URLSearchParams({type:'map',location:'coordinates',metricRain:'default',metricTemp:'default',metricWind:'kt',zoom:'8',overlay:layers[selectedMap],product:'ecmwf',level:'surface',lat:String(s.land[0]),lon:String(s.land[1]),pressure:'true'});const src='https://embed.windy.com/embed.html?'+qs;$('mapHost').className='';$('mapHost').innerHTML='';const frame=document.createElement('iframe');frame.className='map-frame';frame.title=`Windy ${selectedMap} forecast map near ${s.name}`;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;frame.src=src;$('mapHost').appendChild(frame)}
function prepareReview(){const labels=[['checkAemet','AEMET official marine bulletin and warnings personally checked'],['checkWeather','Wind/wave forecast and intended route reviewed'],['checkReality','Onboard observations and limitations considered']];const complete=labels.every(([id])=>$(id).checked),assessment=$('assess').value,person=$('reviewName').value.trim();if(!complete||!assessment||!person){$('copyStatus').textContent='Complete all three review checks, captain name and provisional assessment first.';return null;}
 const s=currentSpot(),lines=['IBIZA SEA SCHOOL CAPTAIN WEATHER REVIEW — UNVERIFIED DRAFT','Not an authenticated signature or authoritative operational record.','',`Generated locally: ${new Date().toISOString()}`,`Captain entered: ${person} (not verified)`,`Area: ${s.name}`,`Model request: ${lastUpdate?lastUpdate.toISOString():'Unsuccessful / not loaded'}`,'AEMET bulletin issue time: NOT CAPTURED OR VERIFIED BY THIS APP','AEMET active warnings: NOT CAPTURED OR VERIFIED BY THIS APP',...labels.map(([,v])=>'Self-declared: '+v),`Captain provisional assessment: ${assessment}`,`Comments: ${$('comments').value.trim()||'None entered'}`,'','Captain retains full responsibility for the decision. Transfer any required record to existing approved vessel reporting system.'];return lines.join('\n')}
async function copyReview(){const text=prepareReview();if(!text)return;try{await navigator.clipboard.writeText(text);$('copyStatus').textContent='Draft copied. Paste into the existing approved operations channel if required. No secure sign-off was recorded.'}catch(_){const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Ibiza_Sea_School_Weather_Review_DRAFT.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);$('copyStatus').textContent='Draft exported as text. No secure sign-off was recorded.'}}
function clearReview(){['checkAemet','checkWeather','checkReality'].forEach(id=>$(id).checked=false);$('assess').value='';$('reviewName').value='';$('comments').value='';$('copyStatus').textContent='Checklist cleared. No data is retained by this form.'}
function setupSectionJump(){
 const picker=$('iss-section-jump');if(!picker)return;
 const navigate=()=>{
  const target=picker.value;if(!target)return;
  const section=document.getElementById(target);
  if(section){
   const sticky=document.querySelector('.iss-section-nav');
   const offset=(sticky?sticky.getBoundingClientRect().height:0)+12;
   const top=window.scrollY+section.getBoundingClientRect().top-offset;
   window.scrollTo({top:Math.max(0,top),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  picker.selectedIndex=0;
 };
 picker.addEventListener('change',navigate);
 picker.addEventListener('input',navigate);
}
function setup(){setupSectionJump();for(const b of document.querySelectorAll('#periods button'))b.addEventListener('click',()=>{selectedHours=Number(b.dataset.hours);document.querySelectorAll('#periods button').forEach(x=>x.classList.toggle('selected',x===b));drawBarograph()});$('refresh').addEventListener('click',refresh);$('location').addEventListener('change',refresh);window.addEventListener('resize',()=>drawBarograph());$('loadMap').addEventListener('click',showMap);for(const b of document.querySelectorAll('[data-map]'))b.addEventListener('click',()=>{selectedMap=b.dataset.map;document.querySelectorAll('[data-map]').forEach(x=>x.classList.toggle('selected',x===b));if(mapLoaded)showMap()});$('copyReview').addEventListener('click',copyReview);$('resetReview').addEventListener('click',clearReview);
 window.addEventListener('offline',()=>{$('offlineNote').hidden=false;$('dataIndicator').innerHTML='<span class="dot bad"></span> Offline · no current verification';resetWeather();});window.addEventListener('online',()=>{$('offlineNote').hidden=true;refresh()});if(!navigator.onLine)$('offlineNote').hidden=false;
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pendingInstall=e;$('install').hidden=false});$('install').addEventListener('click',async()=>{if(pendingInstall){pendingInstall.prompt();await pendingInstall.userChoice;pendingInstall=null;$('install').hidden=true}});
 if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
 refresh();}
setup();
