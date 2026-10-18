// Staging-only Captain Passport registration. Public routes never create memberships or vessel access.
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export const randomToken=(n=32)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return hex(b)};
export async function hmac(key,value){
 const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',k,enc.encode(value)));
}
const code6=()=>{const a=new Uint32Array(1),cap=Math.floor(4294967296/1e6)*1e6;do{crypto.getRandomValues(a)}while(a[0]>=cap);return String(a[0]%1e6).padStart(6,'0')};
const emailOk=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
async function parse(req){const s=await req.text();if(s.length>12000)return null;try{return JSON.parse(s)}catch{return null}}
export async function registerRouter(request,env,path){
 if(!env.DB||!env.AUTH_HMAC_KEY||!env.OTP_MAILER?.send||env.REGISTRATION_ENABLED!=='true')return out({error:'REGISTRATION_NOT_CONFIGURED'},503);
 if(request.method!=='POST')return out({error:'METHOD_NOT_ALLOWED'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return out({error:'ORIGIN_DENIED'},403);
 const b=await parse(request);if(!b)return out({error:'INVALID_BODY'},400);
 if(path==='/api/registration/apply'){
  const invite=String(b.invitation||'').trim(),email=String(b.email||'').trim().toLowerCase(),name=String(b.full_name||'').trim();
  if(!/^[a-f0-9]{64}$/.test(invite)||!emailOk(email)||name.length<2||name.length>150)return out({error:'INVALID_APPLICATION'},400);
  if(b.confirm_accuracy!==true)return out({error:'CONFIRM_ACCURACY_REQUIRED'},400);
  const summary=String(b.experience_summary||'').slice(0,1800),phone=String(b.phone||'').slice(0,40);
  const allowed=['RYA_PB2','RYA_DAY_SKIPPER','RYA_COASTAL_SKIPPER','YACHTMASTER_COASTAL','YACHTMASTER_OFFSHORE','YACHTMASTER_OCEAN','STCW','PWC_INSTRUCTOR','FIRST_AID','SRC_VHF','COMMERCIAL_ENDORSEMENT','OTHER'];
  const qualType=String(b.qualification_type||'OTHER');
  if(!allowed.includes(qualType))return out({error:'INVALID_QUALIFICATION'},400);
  const date=x=>typeof x==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(x)?x:null;
  const hours=Number(b.sea_hours||0);
  if(!Number.isFinite(hours)||hours<0||hours>100000)return out({error:'INVALID_SEA_TIME'},400);
  const tokenHash=await hmac(env.AUTH_HMAC_KEY,'invite:'+invite);
  // Claim invitation atomically, before creating any applicant record; invalid/used invites do not disclose tenants.
  const found=await env.DB.prepare('SELECT id,tenant_id FROM registration_invites WHERE token_digest=? AND consumed_at IS NULL AND expires_at>?').bind(tokenHash,new Date().toISOString()).first();
  if(!found)return out({error:'INVALID_OR_EXPIRED_INVITATION'},400);
  const consumed=await env.DB.prepare('UPDATE registration_invites SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>?').bind(new Date().toISOString(),found.id,new Date().toISOString()).run();
  if(consumed.meta?.changes!==1)return out({error:'INVALID_OR_EXPIRED_INVITATION'},409);
  const applicationId=crypto.randomUUID(),challengeId=randomToken(16),otp=code6();
  const hashed=await hmac(env.AUTH_HMAC_KEY,'applicant:'+challengeId+':'+applicationId+':'+otp);

  await env.DB.batch([
   env.DB.prepare("INSERT INTO captain_applications(id,tenant_id,email,full_name,phone,experience_summary,status) VALUES (?,?,?,?,?,?,'pending')").bind(applicationId,found.tenant_id,email,name,phone,summary),
   env.DB.prepare('INSERT INTO captain_qualifications(id,application_id,qualification_type,title) VALUES (?,?,?,?)').bind(crypto.randomUUID(),applicationId,qualType,String(b.qualification_title||qualType).slice(0,120)),
   env.DB.prepare('INSERT INTO applicant_email_challenges(id,application_id,digest,expires_at) VALUES (?,?,?,?)').bind(challengeId,applicationId,hashed,new Date(Date.now()+600000).toISOString()),
   env.DB.prepare('INSERT INTO captain_medical_attestations(application_id,medical_certificate_held,last_medical_date,medical_certificate_expiry) VALUES (?,?,?,?)').bind(applicationId,b.medical_date?1:0,date(b.medical_date),date(b.medical_expiry)),
   env.DB.prepare('INSERT INTO captain_sea_time(id,application_id,vessel_class,hours_declared,notes) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),applicationId,String(b.vessel_classes||'Not specified').slice(0,300),hours,String(b.requested_vessels||'').slice(0,450))
  ]);
  try{await env.OTP_MAILER.send({to:email,subject:'Captain Passport — verify your email',text:'Your Captain Passport email verification code is '+otp+'. It expires in 10 minutes.'})}
  catch{return out({error:'EMAIL_UNAVAILABLE',message:'Registration stored, but the verification email was not accepted. Contact the administrator.'},503)}
  return out({application_id:applicationId,challenge_id:challengeId,status:'awaiting_email_verification'},202);
 }
 if(path==='/api/registration/verify-email'){
  const app=String(b.application_id||''),cid=String(b.challenge_id||''),code=String(b.code||'');
  if(!/^[0-9a-f-]{36}$/.test(app)||!/^[0-9a-f]{32}$/.test(cid)||!/^\d{6}$/.test(code))return out({error:'INVALID_CODE'},400);
  const updated=await env.DB.prepare('UPDATE applicant_email_challenges SET attempts=attempts+1 WHERE id=? AND application_id=? AND attempts<5 AND consumed_at IS NULL AND expires_at>?').bind(cid,app,new Date().toISOString()).run();
  if(updated.meta?.changes!==1)return out({error:'INVALID_OR_EXPIRED_CODE'},401);
  const challenge=await env.DB.prepare('SELECT digest FROM applicant_email_challenges WHERE id=? AND application_id=?').bind(cid,app).first();
  if(!challenge||challenge.digest!==await hmac(env.AUTH_HMAC_KEY,'applicant:'+cid+':'+app+':'+code))return out({error:'INVALID_OR_EXPIRED_CODE'},401);
  const used=await env.DB.prepare('UPDATE applicant_email_challenges SET consumed_at=? WHERE id=? AND application_id=? AND consumed_at IS NULL').bind(new Date().toISOString(),cid,app).run();
  if(used.meta?.changes!==1)return out({error:'INVALID_OR_EXPIRED_CODE'},401);
  await env.DB.prepare('UPDATE captain_applications SET email_verified_at=? WHERE id=? AND email_verified_at IS NULL').bind(new Date().toISOString(),app).run();
  return out({status:'email_verified_pending_administrator_review'});
 }
 return out({error:'UNKNOWN_REGISTRATION_ROUTE'},404);
}
