import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import worker from '../src/worker.js';
import {hmac,randomToken} from '../src/registration.js';
const dir=dirname(fileURLToPath(import.meta.url));
function createDB(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;');
 for(const name of readdirSync(join(dir,'../db/migrations')).sort())if(name.endsWith('.sql'))db.exec(readFileSync(join(dir,'../db/migrations',name),'utf8'));
 return {
  raw:db,
  prepare(sql){
   let args=[];
   return {
    bind(...v){args=v;return this},
    async first(){return db.prepare(sql).get(...args)||null},
    async all(){return {results:db.prepare(sql).all(...args)}},
    async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}},
    _run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}
   };
  },
  async batch(statements){
   db.exec('BEGIN IMMEDIATE');
   try{const results=statements.map(s=>s._run());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}
  }
 };
}
async function req(env,path,{method='GET',payload,cookie,origin='https://staging.invalid'}={}){
 const headers={Origin:origin,...(payload?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})};
 const response=await worker.fetch(new Request('https://staging.invalid'+path,{method,headers,...(payload?{body:JSON.stringify(payload)}:{})}),env);
 const body=await response.json();
 return {code:response.status,body,cookie:response.headers.get('set-cookie')};
}
test('full D1-backed pilot: invite, verify, manually approve, grant/revoke only selected vessel',async()=>{
 const DB=createDB(),raw=DB.raw;
 raw.prepare("INSERT INTO tenants(id,name) VALUES (?,?)").run('boat-tenant-a','Ibiza Yacht Client A');
 raw.prepare("INSERT INTO tenants(id,name) VALUES (?,?)").run('boat-tenant-b','Ibiza Yacht Client B');
 raw.prepare("INSERT INTO vessels(id,tenant_id,name) VALUES (?,?,?)").run('boat-a','boat-tenant-a','HYGGELIG');
 raw.prepare("INSERT INTO vessels(id,tenant_id,name) VALUES (?,?,?)").run('boat-b','boat-tenant-b','A58');
 raw.prepare("INSERT INTO users(id,email,name) VALUES (?,?,?)").run('admin-a','manager@example.test','Test Manager');
 raw.prepare("INSERT INTO memberships(tenant_id,user_id,role) VALUES (?,?,?)").run('boat-tenant-a','admin-a','owner');
 const key='local-test-key-not-a-real-secret',token=randomToken(),hash=await hmac(key,'session:'+token);
 raw.prepare("INSERT INTO sessions(id,user_id,digest,expires_at) VALUES(?,?,?,?)").run('sess-admin','admin-a',hash,new Date(Date.now()+1e7).toISOString());
 const ownerCookie='iss_fleet='+token;
 const sent=[];
 const env={DB,AUTH_HMAC_KEY:key,REGISTRATION_ENABLED:'true',ADMIN_ACTIONS_ENABLED:'true',OTP_MAILER:{async send(msg){sent.push(msg);return {providerId:'local-mock'}}}};
 // Anonymous submissions cannot self-provision a vessel.
 const blocked=await req(env,'/api/admin/tenants/boat-tenant-a/registration-invites',{method:'POST',payload:{}});
 assert.equal(blocked.code,401);
 const other=await req(env,'/api/admin/tenants/boat-tenant-b/registration-invites',{method:'POST',payload:{},cookie:ownerCookie});
 assert.equal(other.code,403);
 const invitation=await req(env,'/api/admin/tenants/boat-tenant-a/registration-invites',{method:'POST',payload:{},cookie:ownerCookie});
 assert.equal(invitation.code,201);
 assert.match(invitation.body.invitation,/^[a-f0-9]{64}$/);
 const application=await req(env,'/api/registration/apply',{method:'POST',payload:{invitation:invitation.body.invitation,full_name:'Test Captain',email:'captain@example.test',qualification_type:'RYA_PB2',qualification_title:'Powerboat Level 2',sea_hours:400,confirm_accuracy:true}});
 assert.equal(application.code,202);
 assert.equal(sent.length,1);
 const code=/code is (\d{6})/.exec(sent[0].text)?.[1];
 assert.match(code,/^\d{6}$/);
 const repeated=await req(env,'/api/registration/apply',{method:'POST',payload:{invitation:invitation.body.invitation,full_name:'Test Captain',email:'captain@example.test',confirm_accuracy:true}});
 assert.notEqual(repeated.code,202);
 const id=application.body.application_id,base='/api/admin/tenants/boat-tenant-a/applications/'+id;
 const queue=await req(env,'/api/admin/tenants/boat-tenant-a/applications',{cookie:ownerCookie});
 assert.equal(queue.code,200);
 assert.equal(queue.body.applications.length,1);
 const tooEarly=await req(env,base+'/approve',{method:'POST',payload:{},cookie:ownerCookie});
 assert.equal(tooEarly.code,409);
 assert.equal(tooEarly.body.error,'EMAIL_NOT_VERIFIED');
 const verify=await req(env,'/api/registration/verify-email',{method:'POST',payload:{application_id:id,challenge_id:application.body.challenge_id,code}});
 assert.equal(verify.code,200);
 assert.equal(verify.body.status,'email_verified_pending_administrator_review');
 const replay=await req(env,'/api/registration/verify-email',{method:'POST',payload:{application_id:id,challenge_id:application.body.challenge_id,code}});
 assert.equal(replay.code,401);
 const qualId=raw.prepare('SELECT id FROM captain_qualifications WHERE application_id=?').get(id).id;
 const qual=await req(env,base+'/verify-qualification',{method:'POST',payload:{qualification_id:qualId,verdict:'verified'},cookie:ownerCookie});
 assert.equal(qual.code,200);
 const approve=await req(env,base+'/approve',{method:'POST',payload:{note:'Certificates inspected in test fixture'},cookie:ownerCookie});
 assert.equal(approve.code,200);
 assert.equal(approve.body.vessels_authorised,0);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM vessel_access').get().n,0);
 const candidate=await req(env,'/api/auth/request-code',{method:'POST',payload:{email:'captain@example.test'}});
 assert.equal(candidate.code,200);
 assert.equal(sent.length,2);
 const loginOtp=/code is (\d{6})/.exec(sent[1].text)?.[1];
 const login=await req(env,'/api/auth/verify-code',{method:'POST',payload:{challenge_id:candidate.body.challenge_id,code:loginOtp}});
 assert.equal(login.code,200);
 const captainCookie=login.cookie.split(';')[0];
 const initially=await req(env,'/api/auth/me',{cookie:captainCookie});
 assert.equal(initially.code,401,'approved captain without vessel access must be denied');
 const wrongVessel=await req(env,base+'/assign-vessel',{method:'POST',payload:{vessel_id:'boat-b'},cookie:ownerCookie});
 assert.equal(wrongVessel.code,404);
 const grant=await req(env,base+'/assign-vessel',{method:'POST',payload:{vessel_id:'boat-a'},cookie:ownerCookie});
 assert.equal(grant.code,200);
 const permitted=await req(env,'/api/auth/me',{cookie:captainCookie});
 assert.equal(permitted.code,200);
 assert.deepEqual(permitted.body.vessels.map(v=>v.id),['boat-a']);
 const revoke=await req(env,base+'/revoke-vessel',{method:'POST',payload:{vessel_id:'boat-a'},cookie:ownerCookie});
 assert.equal(revoke.code,200);
 const after=await req(env,'/api/auth/me',{cookie:captainCookie});
 assert.equal(after.code,401);
 assert.ok(raw.prepare("SELECT COUNT(*) n FROM captain_application_events WHERE application_id=?").get(id).n>=3);
});
