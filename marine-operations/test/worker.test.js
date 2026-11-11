import test from 'node:test';import assert from 'node:assert/strict';import worker from '../src/worker.js';
test('health reports inactive state',async()=>{const r=await worker.fetch(new Request('https://test.invalid/api/health'),{});assert.equal(r.status,200);assert.equal((await r.json()).delivery,'disabled');});
test('API write routes fail closed',async()=>{for(const p of ['/api/auth/start','/api/declarations','/api/email/send']){const r=await worker.fetch(new Request('https://test.invalid'+p,{method:'POST',body:'{}'}),{});assert.equal(r.status,503);}});
