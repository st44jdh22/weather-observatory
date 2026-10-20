/* SYNTHETIC fixture only. These values are invented for UI/testing and are NOT
 * forecasts supplied by Windguru or any live weather service.
 * Synthetic records are deliberately tagged so they can never be confused
 * with a real provider response during acceptance.
 */
export const SYNTHETIC_ONLY=true;
const base=[
 {model:'GFS',wind_kn:8,gust_kn:13,wind_from_deg:0,wave_m:1.0,swell_m:0.5,wave_period_s:6},
 {model:'IFS-HRES',wind_kn:3,gust_kn:7,wind_from_deg:180,wave_m:0.7,swell_m:0.4,wave_period_s:6},
 {model:'ICON',wind_kn:6,gust_kn:11,wind_from_deg:315,wave_m:0.9,swell_m:0.6,wave_period_s:7},
 {model:'WRF',wind_kn:9,gust_kn:15,wind_from_deg:337.5,wave_m:1.1,swell_m:0.7,wave_period_s:7},
 {model:'Zephr-HD',wind_kn:7,gust_kn:12,wind_from_deg:22.5,wave_m:0.8,swell_m:0.5,wave_period_s:6}
];
export const TEST_VALID_TIMES=['2026-10-27T10:00:00Z','2026-10-27T14:00:00Z'];
export const TEST_RECORDS=Object.freeze(
 Object.keys({san:true,vedr:true,form:true,ibiza:true}).flatMap((spot,siteIndex)=>
  TEST_VALID_TIMES.flatMap((valid_time,h)=>
   base.map((row,m)=>({
     ...row,
     source:'SIMULATED_FIXTURE_NOT_WINDGURU',
     spot,valid_time,
     run_time:'2026-10-26T12:00:00Z',
     wind_kn:Math.max(0,row.wind_kn+(siteIndex===1?2:0)+(siteIndex===2?1:0)+h*2),
     gust_kn:row.gust_kn+(siteIndex===1?2:0)+(siteIndex===2?1:0)+h*2,
     wind_from_deg:((row.wind_from_deg+siteIndex*7+h*16)%360),
     wave_m:Math.round((row.wave_m+siteIndex*.1+h*.2)*10)/10,
     swell_m:Math.round((row.swell_m+siteIndex*.1)*10)/10
   }))
  )
 )
);
