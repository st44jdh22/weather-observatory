import {actor,adminFor} from './admin.js';
const hdr={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:hdr});
const goodId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const validDate=v=>v===null||(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
async function body(request){try{const text=await request.text();return text.length<=6000?JSON.parse(text):null}catch{return null}}
const optional=(x,max=120)=>x===undefined||x===null||String(x).trim()===''?null:String(x).trim().slice(0,max);
const number=(x,max)=>x===undefined||x===null||x===''?null:(typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max?x:NaN);
export async function vesselRouter(request,env,url){
 if(!env.DB||!env.AUTH_HMAC_KEY)return response({error:'VESSEL_SERVICE_NOT_CONFIGURED'},503);
 if(!['GET','POST'].includes(request.method))return response({error:'METHOD_NOT_ALLOWED'},405);
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return response({error:'ORIGIN_DENIED'},403);
 const who=await actor(request,env);if(!who)return response({error:'AUTH_REQUIRED'},401);
 const parts=url.pathname.split('/').filter(Boolean);
 if(parts.length<5||parts.length>6||parts[0]!=='api'||parts[1]!=='admin'||parts[2]!=='tenants'||!goodId(parts[3])||parts[4]!=='vessels')return response({error:'NOT_FOUND'},404);
 const tenant=parts[3];
 if(!await adminFor(env,who.id,tenant))return response({error:'FORBIDDEN'},403);
 if(parts.length===5&&request.method==='GET'){
  const rows=await env.DB.prepare('SELECT id,name,status,make,model,loa_metres,beam_metres,insurance_expiry FROM vessels WHERE tenant_id=? ORDER BY name LIMIT 100').bind(tenant).all();
  return response({vessels:rows.results||[]});
 }
 if(parts.length===6&&request.method==='GET'&&goodId(parts[5])){
  const item=await env.DB.prepare('SELECT * FROM vessels WHERE tenant_id=? AND id=?').bind(tenant,parts[5]).first();
  if(!item)return response({error:'NOT_FOUND'},404);
  const docs=await env.DB.prepare('SELECT id,type,display_name,mime_type,expires_on,scan_status FROM vessel_documents WHERE tenant_id=? AND vessel_id=? ORDER BY type').bind(tenant,parts[5]).all();
  const photos=await env.DB.prepare('SELECT id,mime_type,uploaded_at FROM vessel_photos WHERE tenant_id=? AND vessel_id=?').bind(tenant,parts[5]).all();
  return response({vessel:item,documents:docs.results||[],photos:photos.results||[],document_uploads_enabled:false});
 }
 if(request.method!=='POST')return response({error:'NOT_FOUND'},404);
 if(env.VESSEL_WRITE_ENABLED!=='true')return response({error:'VESSEL_WRITES_DISABLED'},503);
 const data=await body(request);if(!data)return response({error:'INVALID_BODY'},400);
 const name=String(data.name||'').trim(),loa=number(data.loa_metres,500),beam=number(data.beam_metres,100),draft=number(data.draft_metres,40);
 const built=number(data.year_built,2200);
 if(name.length<2||name.length>140||[loa,beam,draft,built].some(Number.isNaN)||built!==null&&built<1850||loa===0||beam===0||!validDate(data.insurance_expiry??null))return response({error:'INVALID_VESSEL_DATA'},400);
 const values=[
 name,optional(data.registration_number),optional(data.flag_state,70),optional(data.make),optional(data.model),
 built,loa,beam,draft,optional(data.mmsi,20),optional(data.call_sign,40),optional(data.hin_cin,80),
 optional(data.insurance_expiry,10)
 ];
 if(parts.length===5){
  const id=crypto.randomUUID();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO vessels(id,tenant_id,name,registration_number,flag_state,make,model,year_built,loa_metres,beam_metres,draft_metres,mmsi,call_sign,hin_cin,insurance_expiry) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,tenant,...values),
   env.DB.prepare('INSERT INTO audit_events(id,tenant_id,actor_id,action) VALUES(?,?,?,?)').bind(crypto.randomUUID(),tenant,who.id,'vessel_created:'+id)
  ]);
  return response({id,status:'created',document_uploads_enabled:false},201);
 }
 if(parts.length===6&&goodId(parts[5])){
  const existed=await env.DB.prepare('SELECT id FROM vessels WHERE tenant_id=? AND id=?').bind(tenant,parts[5]).first();
  if(!existed)return response({error:'NOT_FOUND'},404);
  await env.DB.batch([
   env.DB.prepare('UPDATE vessels SET name=?,registration_number=?,flag_state=?,make=?,model=?,year_built=?,loa_metres=?,beam_metres=?,draft_metres=?,mmsi=?,call_sign=?,hin_cin=?,insurance_expiry=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?').bind(...values,tenant,parts[5]),
   env.DB.prepare('INSERT INTO audit_events(id,tenant_id,actor_id,action) VALUES(?,?,?,?)').bind(crypto.randomUUID(),tenant,who.id,'vessel_updated:'+parts[5])
  ]);
  return response({id:parts[5],status:'updated'},200);
 }
 return response({error:'NOT_FOUND'},404);
}
