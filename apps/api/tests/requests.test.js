import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { JsonStore } from '../src/store.js';
import { nepalPickupAt, validateTransportRequest } from '../src/requests.js';

const nextDay = () => {
  const date = new Date(Date.now() + 2 * 86400_000 + 345 * 60_000);
  return { pickupDate: date.toISOString().slice(0,10), pickupTime: '14:00' };
};
const valid = () => ({
  productName:'Tomatoes',category:'vegetable',handling:'fragile',quantityKg:150.5,
  pickupAddress:'Ward 4, Bhaktapur',marketName:'Kalimati Market',...nextDay(),maxTransitHours:5,
});
test('Nepal date parser rejects calendar overflow and preserves UTC conversion', () => {
  assert.equal(nepalPickupAt('2026-02-30','10:00'),null);
  assert.equal(nepalPickupAt('2027-02-29','10:00'),null);
  assert.equal(nepalPickupAt('2028-02-29','10:00'),'2028-02-29T04:15:00.000Z');
  assert.equal(nepalPickupAt('2028-02-29','25:00'),null);
});
test('request validator enforces weight, category, perishability and time', () => {
  const invalid={...valid(),quantityKg:0,category:'livestock',handling:'unknown',maxTransitHours:0,pickupDate:'2026-02-30'};
  const result=validateTransportRequest(invalid);
  for(const field of ['quantityKg','category','handling','maxTransitHours','pickupDate']) assert.ok(result.fields[field],field);
});
test('Farmer request POST and GET enforce ownership, roles and durable persistence',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'atpro-requests-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'db.json'),store=new JsonStore(file);
  const app=createApp({store});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>app.close(resolve)));
  const base='http://127.0.0.1:'+app.address().port;
  const call=async(path,method='GET',body,token)=>{
    const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  };
  const signup=async(email,role)=>{
    const r=await call('/api/auth/register','POST',{name:'Test User',email,password:'valid-password-123',role});
    assert.equal(r.status,201);
    const login=await call('/api/auth/login','POST',{email,password:'valid-password-123'});
    assert.equal(login.status,200);
    return {token:login.data.token,user:r.data.user};
  };
  const alice=await signup('alice@sample.org','farmer');
  const bob=await signup('bob@sample.org','farmer');
  const driver=await signup('driver@sample.org','driver');
  const endpoint='/api/farmer/requests';
  assert.equal((await call(endpoint,'POST',valid())).status,401);
  assert.equal((await call(endpoint,'GET')).status,401);
  assert.equal((await call(endpoint,'POST',valid(),driver.token)).status,403);
  assert.equal((await call(endpoint,'GET',undefined,driver.token)).status,403);
  assert.equal((await call(endpoint,'POST',{...valid(),quantityKg:-1},alice.token)).status,400);
  assert.deepEqual((await call(endpoint,'GET',undefined,alice.token)).data.requests,[]);
  const created=await call(endpoint,'POST',{...valid(),farmerId:bob.user.id,status:'delivered',id:'injected'},alice.token);
  assert.equal(created.status,201);
  assert.equal(created.data.request.farmerId,alice.user.id);
  assert.equal(created.data.request.status,'pending');
  assert.notEqual(created.data.request.id,'injected');
  assert.equal(created.data.request.pickupAt,nepalPickupAt(valid().pickupDate,valid().pickupTime));
  const list=await call(endpoint,'GET',undefined,alice.token);
  assert.equal(list.status,200);
  assert.equal(list.data.requests.length,1);
  assert.equal((await call(endpoint,'GET',undefined,bob.token)).data.requests.length,0);
  assert.equal((await call('/api/farmer/overview','GET',undefined,alice.token)).data.summary.pendingRequests,1);
  const disk=await new JsonStore(file).read();
  assert.equal(disk.requests.length,1);
  assert.equal(disk.requests[0].farmerId,alice.user.id);
  await call('/api/auth/logout','POST',undefined,alice.token);
  assert.equal((await call(endpoint,'GET',undefined,alice.token)).status,401);
});
