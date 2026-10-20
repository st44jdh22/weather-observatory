import {pickForecasts,compareModels,compass} from './model-agreement.js';
import {SYNTHETIC_ONLY,TEST_VALID_TIMES,TEST_RECORDS} from './synthetic-fixture.js';
const $=id=>document.getElementById(id);
const fmtDate=x=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x));
const fmt=x=>typeof x==='number'?Number(x).toFixed(1):'—';
const text=(tag,content)=>{const el=document.createElement(tag);el.textContent=content;return el};
for(const time of TEST_VALID_TIMES)$('hour').add(new Option(fmtDate(time),time));
function render(){
 if(SYNTHETIC_ONLY!==true)throw new Error('Fixture status not verified');
 const spot=$('spot').value,validTime=$('hour').value;
 const rows=pickForecasts(TEST_RECORDS,{spot,validTime}),summary=compareModels(rows);
 if(summary.status!=='ok')throw new Error('No matching synthetic model set');
 $('agreement').textContent=summary.agreement;
 $('similar').textContent=summary.similarPairs+'/'+summary.pairCount+' model pairs similar ('+summary.similarPairPercent+'%)';
 $('winds').textContent=fmt(summary.windSpeeds.min)+'–'+fmt(summary.windSpeeds.max)+' kn';
 $('spread').textContent=String(Math.round(summary.maxDirectionGap))+'°';
 $('models').textContent=String(summary.modelCount);
 $('agreement').className=summary.similarPairPercent>=80?'highlight':summary.similarPairPercent<50?'warn':'';
 const body=$('rows');body.replaceChildren();
 for(const row of rows){
  const tr=document.createElement('tr');
  const values=[
   row.model,fmt(row.wind_kn)+' kn',compass(row.wind_from_deg)+' · '+fmt(row.wind_from_deg)+'°',
   fmt(row.gust_kn)+' kn',row.wave_m==null?'—':fmt(row.wave_m)+' m',
   row.swell_m==null?'—':fmt(row.swell_m)+' m',
   row.wave_period_s==null?'—':fmt(row.wave_period_s)+' s',fmtDate(row.run_time)
  ];
  for(let i=0;i<values.length;i++){const td=text('td',values[i]);if(i===0)td.className='model';tr.append(td)}
  body.append(tr);
 }
}
$('spot').addEventListener('change',render);
$('hour').addEventListener('change',render);
render();