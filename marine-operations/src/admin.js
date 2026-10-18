import {hmac,randomToken} from './registration.js';
// Tenant-restricted administration. No public registration routes or automatic grants.
const hdr={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:hdr});
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
const id=()=>crypto.randomUUID();
async function requestBody(req){
 const raw=await req.text();if(raw.length>4096)return null;
 try{return JSON.parse(raw)}catch{return null}
}
async function actor(req,env){
 if(!env.DB||!env.AUTH_HMAC_KEY)return null;
 const token=/\biss_fleet=([0-9a-f]{64})\b/.exec(req.headers.get('cookie')||'')?.[1];
 if(!token)return null;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.AUTH_HMAC_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('session:'+token));
 const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 return env.DB.prepare('SELECT u.id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.digest=? AND s.revoked_at IS NULL AND s.expires_at>?').bind(digest,new Date().toISOString()).first();
}
async function adminFor(env,userId,tenantId){
 return env.DB.prepare("SELECT role FROM memberships WHERE tenant_id=? AND user_id=? AND role IN ('owner','manager')").bind(tenantId,userId).first();
}
export async function captainAdminRouter(request,env,url){
 if(!env.DB||!env.AUTH_HMAC_KEY)return response({error:'ADMIN_NOT_CONFIGURED'},503);
 if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)return response({error:'ORIGIN_DENIED'},403);
 const who=await actor(request,env);if(!who)return response({error:'AUTH_REQUIRED'},401);
 const parts=url.pathname.split('/').filter(Boolean);
 if(parts.length===3&&parts.join('/')==='api/admin/tenants'&&request.method==='GET'){
  const rows=await env.DB.prepare("SELECT t.id,t.name,m.role FROM memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=? AND m.role IN ('owner','manager') AND t.status='active'").bind(who.id).all();
  return response({tenants:rows.results||[],actions_enabled:env.ADMIN_ACTIONS_ENABLED==='true'});
 }
 // /api/admin/tenants/{tenant}/applications[/id[/action]]; vessels route below.
 if(parts.length<5||parts[0]!=='api'||parts[1]!=='admin'||parts[2]!=='tenants'||!validId(parts[3])||!['applications','registration-invites'].includes(parts[4]))
  return response({error:'UNKNOWN_ADMIN_ROUTE'},404);
 const tenant=parts[3];
 if(!await adminFor(env,who.id,tenant))return response({error:'FORBIDDEN'},403);
 if(parts.length===5&&parts[4]==='registration-invites'&&request.method==='POST'){
  if(env.ADMIN_ACTIONS_ENABLED!=='true')return response({error:'ADMIN_ACTIONS_DISABLED'},503);
  const secret=randomToken(32),digest=await hmac(env.AUTH_HMAC_KEY,'invite:'+secret);
  await env.DB.prepare('INSERT INTO registration_invites(id,tenant_id,token_digest,created_by,expires_at) VALUES(?,?,?,?,?)').bind(id(),tenant,digest,who.id,new Date(Date.now()+7*86400000).toISOString()).run();
  return response({invitation:secret,expires_in_days:7,share_privately:true},201);
 }

 if(parts.length===5&&request.method==='GET'){
  // Application queue only; vessel list is restricted to matching tenant.

  const rows=await env.DB.prepare('SELECT id,full_name,email,status,submitted_at,reviewed_at,email_verified_at FROM captain_applications WHERE tenant_id=? ORDER BY submitted_at DESC LIMIT 100').bind(tenant).all();
  return response({applications:rows.results||[]});
 }
 if(parts.length===6&&parts[5]==='vessels'&&request.method==='GET'){
  const rows=await env.DB.prepare('SELECT id,name FROM vessels WHERE tenant_id=? ORDER BY name').bind(tenant).all();
  return response({vessels:rows.results||[]});
 }
 const application=parts[5];if(!validId(application))return response({error:'NOT_FOUND'},404);
 const a=await env.DB.prepare('SELECT * FROM captain_applications WHERE tenant_id=? AND id=?').bind(tenant,application).first();
 if(!a)return response({error:'NOT_FOUND'},404);
 if(parts.length===6&&request.method==='GET'){
  const [quals,time,documents,approvals,events]=await Promise.all([
   env.DB.prepare('SELECT id,qualification_type,title,issuing_body,issue_date,expiry_date,verification_status FROM captain_qualifications WHERE application_id=?').bind(application).all(),
   env.DB.prepare('SELECT vessel_class,hours_declared,verified_hours FROM captain_sea_time WHERE application_id=?').bind(application).all(),
   env.DB.prepare('SELECT id,type,mime_type,bytes,scan_status FROM captain_documents WHERE application_id=?').bind(application).all(),
   env.DB.prepare('SELECT vessel_id,status,approved_at,expires_at FROM captain_vessel_approvals WHERE application_id=? AND tenant_id=?').bind(application,tenant).all(),
   env.DB.prepare('SELECT action,note,recorded_at FROM captain_application_events WHERE application_id=? AND tenant_id=? ORDER BY recorded_at DESC LIMIT 50').bind(application,tenant).all()
  ]);
  const {review_note,...limited}=a;
  return response({application:{...limited,review_note},qualifications:quals.results||[],sea_time:time.results||[],documents:documents.results||[],vessel_approvals:approvals.results||[],events:events.results||[]});
 }
 if(parts.length!==7||request.method!=='POST')return response({error:'UNKNOWN_ADMIN_ROUTE'},404);
 // Change operations are feature-gated until applicant verification, review UI and operator audit are tested in staging.
 if(env.ADMIN_ACTIONS_ENABLED!=='true')return response({error:'ADMIN_ACTIONS_DISABLED',message:'Staging approval writes have not been enabled.'},503);
 const b=await requestBody(request);if(!b)return response({error:'INVALID_BODY'},400);
 const action=parts[6],note=typeof b.note==='string'?b.note.trim().slice(0,500):'';
 if(action==='review'){
  if(!['pending','under_review'].includes(a.status))return response({error:'STALE_APPLICATION'},409);
  if(!['under_review','rejected'].includes(b.status))return response({error:'INVALID_STATUS'},400);
  const changes=await env.DB.batch([
   env.DB.prepare("UPDATE captain_applications SET status=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND tenant_id=? AND status IN ('pending','under_review')").bind(b.status,who.id,new Date().toISOString(),note,application,tenant),
   env.DB.prepare('INSERT INTO captain_application_events(id,tenant_id,application_id,reviewer_id,action,note) VALUES (?,?,?,?,?,?)').bind(id(),tenant,application,who.id,b.status==='rejected'?'reject':'under_review',note)
  ]);
  if(!changes[0].meta?.changes)return response({error:'STALE_APPLICATION'},409);
  return response({status:b.status});
 }
 if(action==='verify-qualification'){
  if(!validId(b.qualification_id)||!['verified','rejected'].includes(b.verdict))return response({error:'INVALID_QUALIFICATION'},400);
  const result=await env.DB.prepare('UPDATE captain_qualifications SET verification_status=?,verified_by=?,verified_at=? WHERE id=? AND application_id=?').bind(b.verdict,who.id,new Date().toISOString(),b.qualification_id,application).run();
  if(result.meta?.changes!==1)return response({error:'NOT_FOUND'},404);
  await env.DB.prepare('INSERT INTO captain_application_events(id,tenant_id,application_id,reviewer_id,action,note) VALUES(?,?,?,?,?,?)').bind(id(),tenant,application,who.id,b.verdict==='verified'?'qualification_verified':'qualification_rejected',note).run();
  return response({status:b.verdict});
 }
 if(action==='approve'){
  // Approval does not itself create vessel permissions.
  if(!a.email_verified_at)return response({error:'EMAIL_NOT_VERIFIED'},409);
  if(!['pending','under_review'].includes(a.status))return response({error:'INVALID_STATUS'},409);
  const validQual=await env.DB.prepare("SELECT COUNT(*) AS n FROM captain_qualifications WHERE application_id=? AND verification_status='verified' AND (expiry_date IS NULL OR expiry_date>=date('now'))").bind(application).first();
  if(!validQual?.n)return response({error:'NO_VERIFIED_QUALIFICATION'},409);
  // Creates a user if absent, but no vessel access. Membership and individual vessels are granted explicitly.
  const existing=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(a.email).first();
  const userId=existing?.id||id();
  const updates=[];
  if(!existing)updates.push(env.DB.prepare('INSERT INTO users(id,email,name) VALUES(?,?,?)').bind(userId,a.email,a.full_name));
  updates.push(env.DB.prepare("INSERT INTO memberships(tenant_id,user_id,role) VALUES(?,?,'captain') ON CONFLICT(tenant_id,user_id) DO NOTHING").bind(tenant,userId));
  updates.push(env.DB.prepare("UPDATE captain_applications SET status='approved',approved_user_id=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND tenant_id=? AND status IN ('pending','under_review') AND email_verified_at IS NOT NULL").bind(userId,who.id,new Date().toISOString(),note,application,tenant));
  updates.push(env.DB.prepare("INSERT INTO captain_application_events(id,tenant_id,application_id,reviewer_id,action,note) VALUES (?,?,?,?,?,?)").bind(id(),tenant,application,who.id,'approve',note));
  const result=await env.DB.batch(updates);
  if(result[result.length-2].meta?.changes!==1)return response({error:'STALE_APPLICATION'},409);
  return response({status:'approved',vessels_authorised:0});
 }
 if(action==='assign-vessel'){
  if(a.status!=='approved'||!a.approved_user_id)return response({error:'CAPTAIN_NOT_APPROVED'},409);
  if(!validId(b.vessel_id))return response({error:'INVALID_VESSEL'},400);
  const vessel=await env.DB.prepare('SELECT id FROM vessels WHERE tenant_id=? AND id=?').bind(tenant,b.vessel_id).first();
  if(!vessel)return response({error:'VESSEL_NOT_IN_TENANT'},404);
  const member=await env.DB.prepare("SELECT 1 AS ok FROM memberships WHERE tenant_id=? AND user_id=? AND role='captain'").bind(tenant,a.approved_user_id).first();
  if(!member)return response({error:'CAPTAIN_MEMBERSHIP_MISSING'},409);
  await env.DB.batch([
   env.DB.prepare('INSERT INTO vessel_access(tenant_id,vessel_id,user_id) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(tenant,vessel.id,a.approved_user_id),
   env.DB.prepare("INSERT INTO captain_vessel_approvals(id,application_id,tenant_id,vessel_id,approved_by,status) VALUES (?,?,?,?,?,'approved') ON CONFLICT(application_id,tenant_id,vessel_id) DO UPDATE SET status='approved',approved_by=excluded.approved_by,approved_at=CURRENT_TIMESTAMP").bind(id(),application,tenant,vessel.id,who.id),
   env.DB.prepare('INSERT INTO captain_application_events(id,tenant_id,application_id,reviewer_id,action,note) VALUES(?,?,?,?,?,?)').bind(id(),tenant,application,who.id,'vessel_authorised',note)
  ]);
  return response({status:'vessel_authorised',vessel_id:vessel.id});
 }
 if(action==='revoke-vessel'){
  if(!validId(b.vessel_id)||!a.approved_user_id)return response({error:'INVALID_VESSEL'},400);
  const approved=await env.DB.prepare("SELECT id FROM captain_vessel_approvals WHERE application_id=? AND tenant_id=? AND vessel_id=? AND status='approved'").bind(application,tenant,b.vessel_id).first();
  if(!approved)return response({error:'VESSEL_APPROVAL_NOT_FOUND'},404);
  await env.DB.batch([
   env.DB.prepare('DELETE FROM vessel_access WHERE tenant_id=? AND vessel_id=? AND user_id=?').bind(tenant,b.vessel_id,a.approved_user_id),
   env.DB.prepare("UPDATE captain_vessel_approvals SET status='revoked' WHERE application_id=? AND tenant_id=? AND vessel_id=?").bind(application,tenant,b.vessel_id),
   env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(new Date().toISOString(),a.approved_user_id),
   env.DB.prepare('INSERT INTO captain_application_events(id,tenant_id,application_id,reviewer_id,action,note) VALUES(?,?,?,?,?,?)').bind(id(),tenant,application,who.id,'vessel_revoked',note)
  ]);
  return response({status:'vessel_revoked'});
 }
 return response({error:'UNKNOWN_ADMIN_ACTION'},404);
}
