import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { JsonStore } from '../src/store.js';
import { optimizedFarmerPreview } from '../src/optimized-preview.js';
import { RoutingUnavailableError } from '../src/osrm.js';

const now=Date.parse('2029-06-01T00:00:00Z');
const ids={a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',v:'33333333-3333-4333-8333-333333333333'};
const point=(latitude,longitude)=>({latitude,longitude});
const request=(id,farmerId,pickupCoordinates)=>({
 id,farmerId,status:'pending',marketName:'Kalanki',pickupAt:'2030-06-15T04:15:00.000Z',
 quantityKg:100,category:'vegetable',handling:'standard',maxTransitHours:4,
 pickupCoordinates,marketCoordinates:point(27.71,85.31)
});
const fixture=(farmerId='f1',driverId='d1')=>({
 requests:[request(ids.a,farmerId,point(27.7,85.3)),request(ids.b,'other',point(27.72,85.32))],
 vehicles:[{id:ids.v,driverId,vehicleType:'mini_truck',bodyType:'covered',maximumWeightKg:500,status:'registered'}],
 availability:[{vehicleId:ids.v,driverId,date:'2030-06-15',startTime:'08:00',endTime:'17:00',startCoordinates:point(27.73,85.33)}]
});
const matrix=points=>({
 distancesMeters:points.map((_,i)=>points.map((_,j)=>i===j?0:1000)),
 durationsSeconds:points.map((_,i)=>points.map((_,j)=>i===j?0:300))
});
test('multi-pickup preview preserves fixed endpoints, minimizes without mutating and hides other farmers',async()=>{
 const db=fixture(),before=structuredClone(db);let received;
 const result=await optimizedFarmerPreview(db,db.requests[0],{now,matrixProvider:async points=>{received=points;return matrix(points);}});
 assert.equal(result.ready,true);assert.equal(result.pickupCount,2);assert.equal(result.ownPickupPosition>=1,true);
 assert.equal(result.totalWeightKg,200);
 assert.deepEqual(received,[db.availability[0].startCoordinates,db.requests[0].pickupCoordinates,db.requests[1].pickupCoordinates,db.requests[0].marketCoordinates]);
 assert.ok(!JSON.stringify(result).includes(ids.b));
 assert.ok(!JSON.stringify(result).includes('latitude'));
 assert.deepEqual(db,before);
});
test('one market, handling and capacity boundaries exclude unsafe requests',async()=>{
 const db=fixture();db.requests.push({...request('44444444-4444-4444-8444-444444444444','other',point(27.8,85.4)),marketName:'Other'});
 db.requests.push({...request('55555555-5555-4555-8555-555555555555','other',point(27.8,85.4)),handling:'chilled'});
 db.vehicles[0].maximumWeightKg=100;
 const result=await optimizedFarmerPreview(db,db.requests[0],{now,matrixProvider:async points=>matrix(points)});
 assert.equal(result.ready,true);assert.equal(result.pickupCount,1);
 assert.equal(result.totalWeightKg,100);
});
test('missing coordinates and unavailable vehicles return not-ready without OSRM calls',async()=>{
 const db=fixture();delete db.requests[0].pickupCoordinates;let calls=0;
 const result=await optimizedFarmerPreview(db,db.requests[0],{now,matrixProvider:async()=>{calls++;return matrix([])}});
 assert.equal(result.ready,false);assert.ok(result.reasons.includes('missing_pickup_coordinates'));assert.equal(calls,0);
});
test('authenticated endpoint enforces ownership and never returns another Farmer pickup data',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atpro-optimized-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=new JsonStore(join(dir,'db.json'));let calls=0;
 const server=createApp({store,now:()=>now,matrixProvider:async points=>{calls++;return matrix(points);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',body,token)=>{
  const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json()};
 };
 const auth=async(email,role)=>{
  assert.equal((await call('/api/auth/register','POST',{name:'Test User',email,password:'valid-password-123',role})).status,201);
  return (await call('/api/auth/login','POST',{email,password:'valid-password-123'})).data;
 };
 const farmer=await auth('opt-f@example.com','farmer');
 const other=await auth('opt-o@example.com','farmer');
 const driver=await auth('opt-d@example.com','driver');
 await store.transaction(db=>{Object.assign(db,fixture(farmer.user.id,driver.user.id));return {write:true};});
 const path='/api/farmer/requests/'+ids.a+'/optimized-preview';
 assert.equal((await call(path)).status,401);
 assert.equal((await call(path,'GET',undefined,driver.token)).status,403);
 assert.equal((await call(path,'GET',undefined,other.token)).status,404);
 assert.equal((await call(path+'?url=https://evil.example','GET',undefined,farmer.token)).status,400);
 assert.equal((await call(path+'?vehicleId=invalid','GET',undefined,farmer.token)).status,400);
 const before=await store.read();
 const response=await call(path,'GET',undefined,farmer.token);
 assert.equal(response.status,200);assert.equal(response.data.ready,true);assert.equal(response.data.pickupCount,2);
 assert.ok(!JSON.stringify(response.data).includes(ids.b));
 assert.ok(!JSON.stringify(response.data).includes('pickupCoordinates'));
 assert.equal(calls,1);assert.deepEqual(await store.read(),before);
 await store.transaction(db=>{db.requests[0].status='cancelled';return {write:true};});
 assert.equal((await call(path,'GET',undefined,farmer.token)).status,409);
});
test('routing failures are sanitized and return 503',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atpro-optimized-error-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=new JsonStore(join(dir,'db.json'));
 const server=createApp({store,now:()=>now,matrixProvider:async()=>{throw new RoutingUnavailableError('secret upstream');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json()};
 await post('/api/auth/register',{name:'Test User',email:'opt-error@example.com',password:'valid-password-123',role:'farmer'});
 const user=await post('/api/auth/login',{email:'opt-error@example.com',password:'valid-password-123'});
 await store.transaction(db=>{Object.assign(db,fixture(user.user.id));return {write:true};});
 const r=await fetch(base+'/api/farmer/requests/'+ids.a+'/optimized-preview',{headers:{Authorization:'Bearer '+user.token}});
 assert.equal(r.status,503);assert.ok(!JSON.stringify(await r.json()).includes('secret upstream'));
});
