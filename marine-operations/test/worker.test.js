import test from 'node:test';import assert from 'node:assert/strict';import worker from '../src/worker.js';
test('health reports inactive state',async()=>{const r=await worker.fetch(new Request('https://test.invalid/api/health'),{});assert.equal(r.status,200);assert.equal((await r.json()).delivery,'disabled');});
test('API write routes fail closed',async()=>{for(const p of ['/api/auth/start','/api/declarations','/api/email/send']){const r=await worker.fetch(new Request('https://test.invalid'+p,{method:'POST',body:'{}'}),{});assert.equal(r.status,503);}});

test('captain authentication fails closed without provisioning',async()=>{
 for(const [path,method] of [['/api/auth/request-code','POST'],['/api/auth/verify-code','POST'],['/api/auth/me','GET'],['/api/auth/logout','POST']]){
  const req=new Request('https://test.invalid'+path,{method,headers:method==='POST'?{Origin:'https://test.invalid'}:{},...(method==='POST'?{body:'{}'}:{})});
  const res=await worker.fetch(req,{});
  assert.equal(res.status,503,path);
  assert.equal((await res.json()).error,'AUTH_NOT_CONFIGURED');
 }
});
test('OTP accepts no requests with cross-origin headers',async()=>{
 const stub={DB:{},AUTH_HMAC_KEY:'test-key',OTP_MAILER:{send:async()=>{throw Error('never')}}};
 const req=new Request('https://test.invalid/api/auth/request-code',{method:'POST',headers:{Origin:'https://malicious.invalid'},body:JSON.stringify({email:'user@example.com'})});
 const res=await worker.fetch(req,stub);
 assert.equal(res.status,403);
});
test('malformed OTP code cannot create a session',async()=>{
 const stub={DB:{},AUTH_HMAC_KEY:'test-key',OTP_MAILER:{send:async()=>{throw Error('never')}}};
 const req=new Request('https://test.invalid/api/auth/verify-code',{method:'POST',headers:{Origin:'https://test.invalid'},body:JSON.stringify({challenge_id:'invalid',code:'123456'})});
 const res=await worker.fetch(req,stub);
 assert.equal(res.status,400);
 assert.ok(!res.headers.get('set-cookie'));
});

test('Captain Passport preview never transmits or grants vessel access',async()=>{
 const fs=await import('node:fs/promises');
 const html=await fs.readFile(new URL('../public/captain-passport/index.html',import.meta.url),'utf8');
 const script=await fs.readFile(new URL('../public/captain-passport/passport.js',import.meta.url),'utf8');
 const migration=await fs.readFile(new URL('../db/migrations/0003_captain_passport.sql',import.meta.url),'utf8');
 assert.match(html,/Captain Passport/);
 assert.match(html,/type="file"[^>]*disabled/);
 assert.match(html,/id="email" type="email"/);
 assert.match(html,/last first-aid course date/i);
 assert.match(html,/medical certificate expiry/i);
 assert.match(html,/commercial endorsement/i);
 assert.match(html,/VHF\/SRC certificate/i);
 assert.match(html,/No application submitted/);
 assert.doesNotMatch(script,/fetch\s*\(|XMLHttpRequest|sendBeacon/);
 assert.match(script,/NOT SUBMITTED — NO VESSEL ACCESS GRANTED/);
 assert.match(migration,/CREATE TABLE captain_applications/);
 assert.match(migration,/CREATE TABLE captain_qualifications/);
 assert.match(migration,/CREATE TABLE captain_vessel_approvals/);
 assert.match(migration,/FOREIGN KEY \(tenant_id,vessel_id\) REFERENCES vessels\(tenant_id,id\)/);
});
