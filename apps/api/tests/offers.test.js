import test from 'node:test';
import assert from 'node:assert/strict';
import { offerReadiness, proposedOffer, transitionOffer } from '../src/offers.js';
import { createApp } from '../src/app.js';
import { JsonStore } from '../src/store.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const now=Date.parse('2029-06-01T00:00:00Z');
const id={r:'11111111-1111-4111-8111-111111111111',v:'22222222-2222-4222-8222-222222222222'};
const point=(latitude,longitude)=>({latitude,longitude});
const request=()=>({id:id.r,farmerId:'farmer',revision:1,status:'pending',marketName:'Kalanki',
  pickupAt:'2029-06-15T03:15:00.000Z',quantityKg:100,category:'vegetable',handling:'standard',
  maxTransitHours:4,pickupCoordinates:point(27.7,85.3),marketCoordinates:point(27.71,85.31)});
const fixture=()=>({users:[],sessions:[],requests:[request()],vehicles:[{id:id.v,driverId:'driver',
  status:'registered',vehicleType:'mini_truck',bodyType:'covered',maximumWeightKg:500}],
  availability:[{vehicleId:id.v,driverId:'driver',date:'2029-06-15',startTime:'08:00',
    endTime:'17:00',startCoordinates:point(27.72,85.32)}]});
const matrix=()=>({distancesMeters:[[0,1000,3000],[1000,0,1000],[3000,1000,0]],
  durationsSeconds:[[0,300,900],[300,0,300],[900,300,0]]});
test('proposal is a feasible directed single-pickup offer and leaves store unchanged',()=>{
  const db=fixture(),before=structuredClone(db),ready=offerReadiness(db,db.requests[0],id.v,now);
  assert.ok(!ready.error);
  const result=proposedOffer(db,db.requests[0],ready,matrix(),now);
  assert.ok(result.offer);assert.equal(result.offer.distanceMeters,2000);
  assert.equal(result.offer.status,'proposed');assert.deepEqual(db,before);
});
test('accept creates exactly one trip and assignment, rejects replay and duplicate vehicle date',()=>{
  const db=fixture(),ready=offerReadiness(db,db.requests[0],id.v,now);
  const offer=proposedOffer(db,db.requests[0],ready,matrix(),now).offer;db.offers=[offer];
  const first=transitionOffer(db,offer.id,'driver','accept',now);
  assert.equal(first.status,200);assert.equal(db.trips.length,1);assert.equal(db.tripAssignments.length,1);
  assert.equal(db.requests[0].status,'assigned');
  assert.equal(transitionOffer(db,offer.id,'driver','accept',now).status,409);
  assert.equal(transitionOffer(db,offer.id,'other','accept',now).status,404);
});
test('stale request, expired offer, unavailable vehicle and decline do not book',()=>{
  for(const change of [
    (db,offer)=>{db.requests[0].revision++;},
    (db,offer)=>{offer.expiresAt=new Date(now-1).toISOString();},
    (db,offer)=>{db.vehicles[0].maximumWeightKg=50;},
    (db,offer)=>{db.trips=[{vehicleId:id.v,pickupDate:'2029-06-15',status:'accepted'}];}
  ]) {
    const db=fixture(),offer=proposedOffer(db,db.requests[0],offerReadiness(db,db.requests[0],id.v,now),matrix(),now).offer;
    db.offers=[offer];change(db,offer);
    assert.equal(transitionOffer(db,offer.id,'driver','accept',now).status,409);
    assert.equal((db.tripAssignments??[]).length,0);
  }
  const db=fixture(),offer=proposedOffer(db,db.requests[0],offerReadiness(db,db.requests[0],id.v,now),matrix(),now).offer;
  db.offers=[offer];assert.equal(transitionOffer(db,offer.id,'driver','decline',now).status,200);
  assert.equal(db.requests[0].status,'pending');assert.equal((db.trips??[]).length,0);
});
test('API enforces role, owner and Driver-only decisions with persisted offer',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'atpro-offers-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new JsonStore(join(dir,'db.json'));
  const server=createApp({store,now:()=>now,matrixProvider:async()=>matrix()});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(path,method='GET',body,token)=>{
    const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),
      ...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json()};
  };
  const auth=async(email,role)=>{
    assert.equal((await call('/api/auth/register','POST',{name:'Test User',email,password:'valid-password-123',role})).status,201);
    const login=await call('/api/auth/login','POST',{email,password:'valid-password-123'});
    assert.equal(login.status,200);return login.data;
  };
  const farmer=await auth('farmer@example.com','farmer');
  const driver=await auth('driver@example.com','driver');
  const other=await auth('other@example.com','driver');
  const db=fixture();db.requests[0].farmerId=farmer.user.id;
  db.vehicles[0].driverId=driver.user.id;db.availability[0].driverId=driver.user.id;
  await store.transaction(data=>{Object.assign(data,{requests:db.requests,vehicles:db.vehicles,availability:db.availability});return {write:true};});
  const url='/api/farmer/requests/'+id.r+'/offers';
  assert.equal((await call(url,'POST',{vehicleId:id.v})).status,401);
  assert.equal((await call(url,'POST',{vehicleId:id.v},driver.token)).status,403);
  assert.equal((await call(url,'POST',{vehicleId:id.v,driverId:'fake'},farmer.token)).status,400);
  const created=await call(url,'POST',{vehicleId:id.v},farmer.token);
  assert.equal(created.status,201);
  assert.equal((await call(url,'POST',{vehicleId:id.v},farmer.token)).status,409);
  assert.equal((await call('/api/driver/offers','GET',undefined,other.token)).data.offers.length,0);
  assert.equal((await call('/api/driver/offers','GET',undefined,driver.token)).data.offers.length,1);
  const accept='/api/driver/offers/'+created.data.offer.id+'/accept';
  assert.equal((await call(accept,'POST',{},other.token)).status,404);
  assert.equal((await call(accept,'POST',{},farmer.token)).status,403);
  assert.equal((await call(accept,'POST',{},driver.token)).status,200);
  assert.equal((await call(accept,'POST',{},driver.token)).status,409);
  const saved=await store.read();
  assert.equal(saved.trips.length,1);assert.equal(saved.tripAssignments.length,1);
});
