import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';
import {JsonStore} from '../src/store.js';

const valid=()=>{
 const day=new Date(Date.now()+3*86400_000+345*60_000).toISOString().slice(0,10);
 return {productName:'Tomatoes',category:'vegetable',handling:'fragile',quantityKg:120,
 pickupAddress:'Ward 4 Bhaktapur',marketName:'Kalimati Market',pickupDate:day,pickupTime:'14:00',maxTransitHours:5};
};
test('Farmer detail/edit/cancel enforce ownership, revision, status and durable storage',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atpro-lifecycle-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=new JsonStore(join(dir,'db.json')),server=createApp({store});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',body,token)=>{
  const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json()};
 };
 const signup=async(email,role)=>{
  assert.equal((await call('/api/auth/register','POST',{name:'Test Account',email,password:'valid-password-123',role})).status,201);
  const res=await call('/api/auth/login','POST',{email,password:'valid-password-123'});
  assert.equal(res.status,200);return res.data.token;
 };
 const farmer=await signup('lifecycle-a@example.org','farmer');
 const other=await signup('lifecycle-b@example.org','farmer');
 const driver=await signup('lifecycle-driver@example.org','driver');
 const created=await call('/api/farmer/requests','POST',valid(),farmer);
 assert.equal(created.status,201);
 const id=created.data.request.id, endpoint='/api/farmer/requests/'+id;
 assert.equal(created.data.request.revision,1);
 assert.equal((await call(endpoint)).status,401);
 assert.equal((await call(endpoint,'GET',undefined,driver)).status,403);
 assert.equal((await call(endpoint,'GET',undefined,other)).status,404);
 assert.equal((await call(endpoint,'PATCH',{...valid(),revision:1},other)).status,404);
 assert.equal((await call(endpoint+'/cancel','POST',{revision:1},other)).status,404);
 assert.equal((await call(endpoint,'GET',undefined,farmer)).status,200);
 assert.equal((await call(endpoint,'PATCH',{...valid(),revision:0},farmer)).status,400);
 assert.equal((await call(endpoint,'PATCH',{...valid(),revision:1,quantityKg:-3},farmer)).status,400);
 const edited=await call(endpoint,'PATCH',{...valid(),revision:1,quantityKg:160,farmerId:'injected',status:'delivered'},farmer);
 assert.equal(edited.status,200);assert.equal(edited.data.request.quantityKg,160);
 assert.equal(edited.data.request.revision,2);
 assert.equal(edited.data.request.farmerId,created.data.request.farmerId);
 assert.equal(edited.data.request.status,'pending');
 assert.ok(edited.data.request.updatedAt);
 assert.equal((await call(endpoint,'PATCH',{...valid(),revision:1},farmer)).status,409);
 assert.equal((await call(endpoint+'/cancel','POST',{revision:1},farmer)).status,409);
 const cancelled=await call(endpoint+'/cancel','POST',{revision:2},farmer);
 assert.equal(cancelled.status,200);assert.equal(cancelled.data.request.status,'cancelled');assert.equal(cancelled.data.request.revision,3);
 assert.equal((await call(endpoint+'/cancel','POST',{revision:3},farmer)).status,409);
 assert.equal((await call(endpoint,'PATCH',{...valid(),revision:3},farmer)).status,409);
 const after=await new JsonStore(join(dir,'db.json')).read();
 const saved=after.requests.find(r=>r.id===id);
 assert.equal(saved.quantityKg,160);assert.equal(saved.status,'cancelled');assert.equal(saved.revision,3);
 assert.equal((await call('/api/farmer/overview','GET',undefined,farmer)).data.summary.pendingRequests,0);
 assert.equal((await call(endpoint,'GET',undefined,farmer)).data.request.status,'cancelled');
});
