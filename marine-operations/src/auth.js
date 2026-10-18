// Passwordless fleet login. Staging only: no account seeded, provider unconfigured.
// All decisions are made server-side. A public four-digit UI selector has no security role.
const noStore={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const reply=(data,status=200,more={})=>new Response(JSON.stringify(data),{status,headers:{...noStore,...more}});
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function digest(key,message){
 const cryptoKey=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(message)));
}
function token(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return hex(a)}
function otp(){
 // Uniform six digits from crypto random with rejection to eliminate modulo bias.
 const ceiling=Math.floor(4294967296/1000000)*1000000;let n;
 do {const a=new Uint32Array(1);crypto.getRandomValues(a);n=a[0]}while(n>=ceiling);
 return String(n%1000000).padStart(6,'0');
}
async function bodyJSON(request){
 if(Number(request.headers.get('content-length'))>4096)return null;
 try{const body=await request.text();return body.length<=4096?JSON.parse(body):null}catch{return null}
}
function configured(env){return !!(env.DB&&env.AUTH_HMAC_KEY&&env.OTP_MAILER&&typeof env.OTP_MAILER.send==='function')}
const general={message:'If this email is authorised, a verification code will be sent.'};
export async function authRouter(request,env,path){
 if(!configured(env))return reply({error:'AUTH_NOT_CONFIGURED',message:'Secure fleet login is not active.'},503);
 const origin=new URL(request.url).origin;
 if(request.method==='POST'&&request.headers.get('origin')!==origin)return reply({error:'ORIGIN_DENIED'},403);
 if(path==='/api/auth/request-code'&&request.method==='POST'){
  const b=await bodyJSON(request);const email=String(b?.email||'').trim().toLowerCase();
  if(!/^[^\s@]{1,100}@[^\s@]{1,200}\.[^\s@]{2,}$/.test(email)||email.length>254)return reply({error:'INVALID_EMAIL'},400);
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  // Both email and IP limits are shared among Worker instances via D1.
  const keys=[await digest(env.AUTH_HMAC_KEY,'email:'+email),await digest(env.AUTH_HMAC_KEY,'ip:'+ip)];
  const now=Date.now(),expires=now+3600000;
  for(const key of keys){
   const count=await env.DB.prepare('SELECT count,expires_ms FROM auth_throttles WHERE key=?').bind(key).first();
   if(count&&count.expires_ms>now&&count.count>=6)return reply(general,200);
  }
  for(const key of keys){
   await env.DB.prepare('INSERT INTO auth_throttles (key,count,expires_ms) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_ms<=? THEN 1 ELSE count+1 END,expires_ms=CASE WHEN expires_ms<=? THEN ? ELSE expires_ms END').bind(key,expires,now,now,expires).run();
  }
  const user=await env.DB.prepare("SELECT u.id FROM users u WHERE u.email=? AND EXISTS(SELECT 1 FROM memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=u.id AND m.role IN ('owner','manager','captain') AND t.status='active') LIMIT 1").bind(email).first();
  if(!user)return reply(general);
  const id=token(16),code=otp(),hash=await digest(env.AUTH_HMAC_KEY,id+':'+user.id+':'+code);
  await env.DB.prepare('INSERT INTO login_challenges (id,user_id,digest,expires_at,attempts) VALUES (?,?,?,?,0)').bind(id,user.id,hash,new Date(now+600000).toISOString()).run();
  try{
   await env.OTP_MAILER.send({to:email,subject:'Ibiza Sea School — Captain sign-in code',text:'Your verification code is '+code+'. It expires in 10 minutes. If you did not request it, ignore this message.'});
  }catch{
   await env.DB.prepare('UPDATE login_challenges SET consumed_at=? WHERE id=?').bind(new Date().toISOString(),id).run();
   return reply({error:'EMAIL_UNAVAILABLE',message:'Verification email could not be accepted. Try later.'},503);
  }
  return reply({message:general.message,challenge_id:id});
 }
 if(path==='/api/auth/verify-code'&&request.method==='POST'){
  const b=await bodyJSON(request),id=String(b?.challenge_id||''),code=String(b?.code||'');
  if(!/^[a-f0-9]{32}$/.test(id)||!/^\d{6}$/.test(code))return reply({error:'INVALID_CODE'},400);
  // Atomic attempt consumption prevents concurrent guessing bypasses.
  const nowISO=new Date().toISOString();
  const result=await env.DB.prepare('UPDATE login_challenges SET attempts=attempts+1 WHERE id=? AND consumed_at IS NULL AND expires_at>? AND attempts<5').bind(id,nowISO).run();
  if((result.meta?.changes||0)!==1)return reply({error:'INVALID_OR_EXPIRED_CODE'},401);
  const challenge=await env.DB.prepare('SELECT id,user_id,digest FROM login_challenges WHERE id=?').bind(id).first();
  const hash=await digest(env.AUTH_HMAC_KEY,id+':'+challenge.user_id+':'+code);
  if(hash!==challenge.digest)return reply({error:'INVALID_OR_EXPIRED_CODE'},401);
  const consumed=await env.DB.prepare('UPDATE login_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').bind(nowISO,id).run();
  if((consumed.meta?.changes||0)!==1)return reply({error:'INVALID_OR_EXPIRED_CODE'},401);
  const session=token(32),sessionHash=await digest(env.AUTH_HMAC_KEY,'session:'+session);
  await env.DB.prepare('INSERT INTO sessions (id,user_id,digest,expires_at) VALUES (?,?,?,?)').bind(token(16),challenge.user_id,sessionHash,new Date(Date.now()+12*3600000).toISOString()).run();
  return reply({message:'Verified'},200,{'set-cookie':'iss_fleet='+session+'; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=43200'});
 }
 if(path==='/api/auth/me'&&request.method==='GET'){
  const match=/\biss_fleet=([a-f0-9]{64})\b/.exec(request.headers.get('cookie')||'');
  if(!match)return reply({authenticated:false},401);
  const hash=await digest(env.AUTH_HMAC_KEY,'session:'+match[1]);
  const vessels=await env.DB.prepare("SELECT v.id,v.name,v.tenant_id FROM sessions s JOIN vessel_access a ON a.user_id=s.user_id JOIN vessels v ON v.id=a.vessel_id AND v.tenant_id=a.tenant_id JOIN tenants t ON t.id=v.tenant_id WHERE s.digest=? AND s.revoked_at IS NULL AND s.expires_at>? AND t.status='active'").bind(hash,new Date().toISOString()).all();
  if(!vessels.results?.length)return reply({authenticated:false},401);
  return reply({authenticated:true,vessels:vessels.results});
 }
 if(path==='/api/auth/logout'&&request.method==='POST'){
  const match=/\biss_fleet=([a-f0-9]{64})\b/.exec(request.headers.get('cookie')||'');
  if(match){const hash=await digest(env.AUTH_HMAC_KEY,'session:'+match[1]);await env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE digest=?').bind(new Date().toISOString(),hash).run()}
  return reply({message:'Signed out'},200,{'set-cookie':'iss_fleet=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0'});
 }
 return reply({error:'UNKNOWN_AUTH_ROUTE'},404);
}
