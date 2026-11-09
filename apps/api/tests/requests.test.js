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

test('Farmer detail/edit/cancel enforces ownership, revision and pending lifecycle',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'atpro-lifecycle-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'db.json'),store=new JsonStore(file),app=createApp({store});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>app.close(resolve)));
  const base='http://127.0.0.1:'+app.address().port;
  const call=async(path,method='GET',body,token)=>{
    const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  };
  const signup=async(email,role)=>{
    assert.equal((await call('/api/auth/register','POST',{name:'Test User',email,password:'valid-password-123',role})).status,201);
    return (await call('/api/auth/login','POST',{email,password:'valid-password-123'})).data.token;
  };
  const alice=await signup('edit-alice@example.org','farmer'),bob=await signup('edit-bob@example.org','farmer'),driver=await signup('edit-driver@example.org','driver');
  const created=await call('/api/farmer/requests','POST',valid(),alice);
  assert.equal(created.status,201);
  const id=created.data.request.id,route='/api/farmer/requests/'+id;
  assert.equal((await call(route)).status,401);
  assert.equal((await call(route,'GET',undefined,driver)).status,403);
  assert.equal((await call(route,'GET',undefined,bob)).status,404);
  assert.equal((await call(route,'PATCH',{...valid(),revision:1},bob)).status,404);
  assert.equal((await call(route+'/cancel','POST',{revision:1},bob)).status,404);
  const detail=await call(route,'GET',undefined,alice);
  assert.equal(detail.status,200);
  assert.equal(detail.data.request.revision,1);
  assert.equal((await call(route,'PATCH',{...valid(),quantityKg:-5,revision:1},alice)).status,400);
  assert.equal((await call(route,'PATCH',{...valid(),revision:2},alice)).status,409);
  const edited=await call(route,'PATCH',{...valid(),productName:'Fresh tomatoes',quantityKg:175,revision:1,status:'delivered',farmerId:'forged'},alice);
  assert.equal(edited.status,200);
  assert.equal(edited.data.request.revision,2);
  assert.equal(edited.data.request.quantityKg,175);
  assert.equal(edited.data.request.status,'pending');
  assert.equal((await call(route+'/cancel','POST',{revision:1},alice)).status,409);
  const cancelled=await call(route+'/cancel','POST',{revision:2},alice);
  assert.equal(cancelled.status,200);
  assert.equal(cancelled.data.request.status,'cancelled');
  assert.equal(cancelled.data.request.revision,3);
  assert.equal((await call(route+'/cancel','POST',{revision:3},alice)).status,409);
  assert.equal((await call(route,'PATCH',{...valid(),revision:3},alice)).status,409);
  assert.equal((await call('/api/farmer/overview','GET',undefined,alice)).data.summary.pendingRequests,0);
  const disk=await new JsonStore(file).read();
  assert.equal(disk.requests[0].status,'cancelled');
  assert.equal(disk.requests[0].quantityKg,175);
  await call('/api/auth/logout','POST',undefined,alice);
  assert.equal((await call(route,'GET',undefined,alice)).status,401);
});
