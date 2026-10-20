/**
 * Windguru model comparison domain layer (provider-neutral and credential-free).
 *
 * Normalised records ONLY. Provider parsing and API access are deliberately absent until
 * the beta API's exact response schema and licensing are verified in an isolated backend.
 * Forecast model agreement is NOT the probability that a forecast will be correct.
 */
export const SPOTS=Object.freeze({
 san:{name:'Sant Antoni · Ibiza',lat:38.984,lon:1.247},
 vedr:{name:'Es Vedrà · Ibiza',lat:38.845,lon:1.173},
 form:{name:'Formentera · Balearics',lat:38.68,lon:1.464},
 ibiza:{name:'Ibiza Town · Ibiza',lat:38.883,lon:1.465}
});
export function angleDifference(a,b){
 if(!Number.isFinite(a)||!Number.isFinite(b))return null;
 const d=Math.abs(((a-b)%360+360)%360);
 return Math.min(d,360-d);
}
export function compass(degrees){
 if(!Number.isFinite(degrees))return '—';
 const names=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
 return names[Math.round((((degrees%360)+360)%360)/22.5)%16];
}
const isIso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s)&&Number.isFinite(Date.parse(s));
function validRecord(x){
 if(!x||typeof x!=='object'||typeof x.model!=='string'||!/^[\w.-]{2,35}$/.test(x.model))return false;
 if(!isIso(x.valid_time)||!isIso(x.run_time)||Date.parse(x.run_time)>Date.parse(x.valid_time))return false;
 if(typeof x.spot!=='string'||!Object.hasOwn(SPOTS,x.spot))return false;
 for(const name of ['wind_kn','gust_kn','wind_from_deg']){
  if(typeof x[name]!=='number'||!Number.isFinite(x[name]))return false;
 }
 if(x.wind_kn<0||x.wind_kn>250||x.gust_kn<x.wind_kn||x.gust_kn>300||x.wind_from_deg<0||x.wind_from_deg>=360)return false;
 if(x.wave_m!=null&&(!Number.isFinite(x.wave_m)||x.wave_m<0||x.wave_m>35))return false;
 if(x.swell_m!=null&&(!Number.isFinite(x.swell_m)||x.swell_m<0||x.swell_m>35))return false;
 if(x.wave_period_s!=null&&(!Number.isFinite(x.wave_period_s)||x.wave_period_s<0||x.wave_period_s>50))return false;
 return true;
}
export function pickForecasts(records,{spot,validTime}){
 if(!Array.isArray(records)||!Object.hasOwn(SPOTS,spot)||!isIso(validTime))return [];
 const byModel=new Map();
 for(const x of records){
  if(!validRecord(x)||x.spot!==spot||x.valid_time!==validTime)continue;
  const old=byModel.get(x.model);
  if(!old||x.run_time>old.run_time)byModel.set(x.model,x);
 }
 return [...byModel.values()].sort((a,b)=>a.model.localeCompare(b.model));
}
function minmax(values){
 const a=values.filter(Number.isFinite);
 return a.length?{min:Math.min(...a),max:Math.max(...a)}:null;
}
export function compareModels(rows){
 // This is an agreement heuristic, NOT a calibrated forecast skill or probability.
 if(!Array.isArray(rows))return {status:'invalid',reason:'Invalid model list'};
 const models=[...new Set(rows.map(r=>r?.model))];
 if(models.length!==rows.length||rows.some(x=>!validRecord(x)))return {status:'invalid',reason:'Invalid, malformed or repeated model'};
 if(rows.length<2)return {status:'insufficient',models:rows.length,reason:'At least two models at one valid time are needed'};
 const same=rows.every(x=>x.spot===rows[0].spot&&x.valid_time===rows[0].valid_time);
 if(!same)return {status:'invalid',reason:'Do not compare differing spots or valid times'};
 const pairs=[];let close=0;
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j];
  const speedGap=Math.abs(a.wind_kn-b.wind_kn);
  const dirGap=angleDifference(a.wind_from_deg,b.wind_from_deg);
  // When both forecasts are almost calm, the reported direction is unstable.
  const calm=a.wind_kn<4&&b.wind_kn<4;
  const similar=speedGap<=5&&(dirGap<=45||calm);
  pairs.push({a:a.model,b:b.model,speedGap,directionGap:dirGap,directionIgnoredForCalm:calm,similar});
  if(similar)close++;
 }
 const ratio=close/pairs.length;
 const label=ratio>=.8?'Strong agreement':ratio>=.5?'Mixed agreement':'Low agreement';
 const windSpeeds=minmax(rows.map(x=>x.wind_kn));
 const gusts=minmax(rows.map(x=>x.gust_kn));
 const waves=minmax(rows.map(x=>x.wave_m));
 const maxDirectionGap=Math.max(...pairs.map(x=>x.directionGap));
 const runDates=rows.map(x=>x.run_time).sort();
 return {
  status:'ok',modelCount:rows.length,pairCount:pairs.length,similarPairs:close,
  similarPairPercent:Math.round(ratio*100),agreement:label,
  spot:rows[0].spot,validTime:rows[0].valid_time,
  windSpeeds,gusts,waves,maxDirectionGap,
  runTimeEarliest:runDates[0],runTimeLatest:runDates.at(-1),
  pairs,interpretation:'Pairwise proximity at this hour (speed within 5 kn and direction within 45°, except when both near calm). NOT a probability, confidence level or past accuracy score.'
 };
}
