import test from 'node:test';
import assert from 'node:assert/strict';
import {angleDifference,compass,compareModels,pickForecasts} from '../public/weather-models/model-agreement.js';
import {SYNTHETIC_ONLY,TEST_VALID_TIMES,TEST_RECORDS} from '../public/weather-models/synthetic-fixture.js';
import {readFile} from 'node:fs/promises';
const record=(model,wind_kn,wind_from_deg,other={})=>({
 source:'SIMULATED_FIXTURE_NOT_WINDGURU',model,spot:'san',
 valid_time:'2026-10-27T10:00:00Z',run_time:'2026-10-26T12:00:00Z',
 wind_kn,gust_kn:wind_kn+3,wind_from_deg,wave_m:1,...other
});
test('wind direction comparison correctly wraps north (359° and 1° are 2° apart)',()=>{
 assert.equal(angleDifference(359,1),2);
 assert.equal(angleDifference(1,359),2);
 assert.equal(angleDifference(0,180),180);
 assert.equal(compass(359),'N');
 assert.equal(compass(181),'S');
});
test('forecast comparison aligns EXACT valid hour and spot, chooses latest run per model',()=>{
 const t='2026-10-27T10:00:00Z';
 const arr=[
 record('GFS',10,5,{run_time:'2026-10-26T00:00:00Z'}),
 record('GFS',11,7,{run_time:'2026-10-26T06:00:00Z'}),
 record('ICON',14,33),
 record('GFS',90,180,{spot:'vedr'}),
 record('IFS-HRES',12,15,{valid_time:'2026-10-27T11:00:00Z'})
 ];
 const picked=pickForecasts(arr,{spot:'san',validTime:t});
 assert.deepEqual(picked.map(x=>x.model),['GFS','ICON']);
 assert.equal(picked[0].wind_kn,11);
});
test('similar wind directions around north produce strong agreement',()=>{
 const s=compareModels([record('GFS',10,359),record('ICON',11,1),record('WRF',12,15)]);
 assert.equal(s.agreement,'Strong agreement');
 assert.equal(s.similarPairPercent,100);
 assert.equal(s.maxDirectionGap,16);
 assert.deepEqual(s.windSpeeds,{min:10,max:12});
});
test('north versus south produces low agreement and a visible 180° discrepancy',()=>{
 const s=compareModels([record('GFS',8,0),record('IFS-HRES',8,180),record('ICON',12,315)]);
 assert.equal(s.agreement,'Low agreement');
 assert.equal(s.similarPairPercent,33);
 assert.equal(s.maxDirectionGap,180);
 assert.equal(s.pairCount,3);
});
test('near-calm forecast directions are ignored only when both winds under 4 kn',()=>{
 let s=compareModels([record('GFS',1,0),record('ICON',3,180)]);
 assert.equal(s.similarPairPercent,100);
 assert.equal(s.pairs[0].directionIgnoredForCalm,true);
 s=compareModels([record('GFS',1,0),record('ICON',8,180)]);
 assert.equal(s.similarPairPercent,0);
});
test('bad/misaligned/duplicated rows cannot be scored as comparable forecasts',()=>{
 assert.equal(compareModels([record('GFS',8,1)]).status,'insufficient');
 assert.equal(compareModels([record('GFS',8,1),record('GFS',10,3)]).status,'invalid');
 assert.equal(compareModels([record('GFS',8,1),record('WRF',8,2,{spot:'vedr'})]).status,'invalid');
 assert.equal(compareModels([record('GFS',8,1),record('WRF',8,2,{valid_time:'2026-10-27T11:00:00Z'})]).status,'invalid');
 assert.equal(compareModels([record('GFS',8,1),record('WRF',8,2,{wind_from_deg:360})]).status,'invalid');
});
test('synthetic fixture NEVER masquerades as live Windguru weather',async()=>{
 assert.equal(SYNTHETIC_ONLY,true);
 assert.ok(TEST_RECORDS.length>=30);
 for(const row of TEST_RECORDS)assert.equal(row.source,'SIMULATED_FIXTURE_NOT_WINDGURU');
 for(const spot of ['san','vedr','form','ibiza']){
  const selected=pickForecasts(TEST_RECORDS,{spot,validTime:TEST_VALID_TIMES[0]});
  assert.equal(selected.length,5);
  assert.equal(compareModels(selected).status,'ok');
 }
 const html=await readFile(new URL('../public/weather-models/index.html',import.meta.url),'utf8');
 const client=await readFile(new URL('../public/weather-models/lab.js',import.meta.url),'utf8');
 assert.match(html,/DEMONSTRATION ONLY/);
 assert.match(html,/NOT actual weather/);
 assert.match(html,/No Windguru API key or live service is connected/);
 assert.match(client,/SYNTHETIC_ONLY/);
 assert.doesNotMatch(client,/Authorization|windguru.cz\/api|localStorage|sessionStorage|navigator\.sendBeacon/);
});
