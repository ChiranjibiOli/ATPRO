import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { JsonStore } from '../src/store.js';
import { routeReadiness, summarizeRoadMatrix } from '../src/route-preview.js';
import { RoutingUnavailableError } from '../src/osrm.js';

const date = '2030-06-15';
const pickupAt = '2030-06-15T04:15:00.000Z'; // 10:00 Nepal
const now = Date.parse('2029-06-01T00:00:00.000Z');
const point = (latitude, longitude) => ({ latitude, longitude });
const ownRequest = (id, farmerId) => ({
  id, farmerId, status: 'pending', marketName: 'Kalanki', pickupAt,
  quantityKg: 100, category: 'vegetable', handling: 'standard',
  pickupCoordinates: point(27.7, 85.3), marketCoordinates: point(27.71, 85.31),
});
const vehicle = (id, driverId) => ({
  id, driverId, vehicleType: 'mini_truck', bodyType: 'covered',
  maximumWeightKg: 500, status: 'registered',
});
const available = (vehicleId, driverId) => ({
  vehicleId, driverId, date, startTime: '08:00', endTime: '17:00',
  startCoordinates: point(27.72, 85.32),
});
const ids = {
  request: '11111111-1111-4111-8111-111111111111',
  other: '22222222-2222-4222-8222-222222222222',
  vehicle: '33333333-3333-4333-8333-333333333333',
};
const fixture = (farmerId = 'f1', driverId = 'd1') => ({
  requests: [ownRequest(ids.request, farmerId), { ...ownRequest(ids.other, 'another'), pickupCoordinates: point(26, 80) }],
  vehicles: [vehicle(ids.vehicle, driverId)],
  availability: [available(ids.vehicle, driverId)],
});
test('readiness rejects missing coordinates, ineligible vehicles, missing start, and never mutates storage', () => {
  const db = fixture();
  const before = structuredClone(db);
  const ready = routeReadiness(db, db.requests[0], { now });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.points, [db.availability[0].startCoordinates, db.requests[0].pickupCoordinates, db.requests[0].marketCoordinates]);
  assert.deepEqual(db, before);
  delete db.requests[0].pickupCoordinates;
  assert.deepEqual(routeReadiness(db, db.requests[0], { now }).reasons, ['missing_pickup_coordinates']);
  db.requests[0].pickupCoordinates = point(27.7,85.3);
  delete db.requests[0].marketCoordinates;
  assert.deepEqual(routeReadiness(db, db.requests[0], { now }).reasons, ['missing_market_coordinates']);
  db.requests[0].marketCoordinates = point(27.71,85.31);
  delete db.availability[0].startCoordinates;
  assert.deepEqual(routeReadiness(db, db.requests[0], { now }).reasons, ['missing_driver_start_coordinates']);
  db.availability[0].startCoordinates = point(27.72,85.32);
  assert.deepEqual(routeReadiness(db, db.requests[0], { vehicleId: ids.other, now }).reasons, ['vehicle_not_eligible']);
  db.vehicles[0].maximumWeightKg = 50;
  assert.deepEqual(routeReadiness(db, db.requests[0], { now }).reasons, ['no_eligible_vehicle']);
});
test('directed road legs use 0->1 and 1->2, not reverse edges', () => {
  const result = summarizeRoadMatrix({
    distancesMeters: [[0,1000,9999],[9000,0,2000],[3000,4000,0]],
    durationsSeconds: [[0,120,999],[900,0,240],[300,400,0]],
  }, ids.vehicle, 'mini_truck');
  assert.equal(result.totalDistanceMeters, 3000);
  assert.equal(result.totalDurationSeconds, 360);
  assert.deepEqual(result.legs.map(l=>l.distanceMeters), [1000,2000]);
  assert.ok(!JSON.stringify(result).includes('9999'));
  assert.throws(() => summarizeRoadMatrix({distancesMeters:[[0]],durationsSeconds:[[0]]},ids.vehicle,'mini_truck'), TypeError);
});
test('route-preview API enforces owner/role/status, no location leak, error states and read-only routing', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'atpro-road-preview-'));
  t.after(() => rm(dir,{recursive:true,force:true}));
  const store = new JsonStore(join(dir,'db.json'));
  let calls = 0, pointsReceived;
  const matrixProvider = async points => {
    calls++; pointsReceived = points;
    return {distancesMeters:[[0,1100,9999],[9000,0,2200],[3000,4000,0]],
      durationsSeconds:[[0,180,999],[900,0,360],[300,400,0]]};
  };
  const server = createApp({store, now:()=>now, matrixProvider});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(path,method='GET',body,token)=>{
    const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:res.status,data:await res.json()};
  };
  const auth=async(email,role)=>{
    assert.equal((await call('/api/auth/register','POST',{name:'Test Account',email,password:'valid-password-123',role})).status,201);
    const login=await call('/api/auth/login','POST',{email,password:'valid-password-123'});
    assert.equal(login.status,200);
    return login.data;
  };
  const farmer=await auth('road-a@example.com','farmer');
  const stranger=await auth('road-b@example.com','farmer');
  const driver=await auth('road-d@example.com','driver');
  await store.transaction(db=>{
    Object.assign(db,fixture(farmer.user.id,driver.user.id));
    return {write:true};
  });
  const path='/api/farmer/requests/'+ids.request+'/route-preview';
  assert.equal((await call(path)).status,401);
  assert.equal((await call(path,'GET',undefined,driver.token)).status,403);
  assert.equal((await call(path,'GET',undefined,stranger.token)).status,404);
  assert.equal((await call(path+'?url=https://evil.example','GET',undefined,farmer.token)).status,400);
  assert.equal((await call(path+'?vehicleId=bad','GET',undefined,farmer.token)).status,400);
  const before=await store.read();
  const result=await call(path,'GET',undefined,farmer.token);
  assert.equal(result.status,200); assert.equal(result.data.ready,true);
  assert.equal(result.data.totalDistanceMeters,3300);
  assert.equal(result.data.totalDurationSeconds,540);
  assert.equal(calls,1);
  assert.deepEqual(pointsReceived,[before.availability[0].startCoordinates,before.requests[0].pickupCoordinates,before.requests[0].marketCoordinates]);
  assert.ok(!JSON.stringify(result.data).includes('another'));
  assert.ok(!JSON.stringify(result.data).includes('26'));
  assert.ok(!JSON.stringify(result.data).includes('latitude'));
  assert.deepEqual(await store.read(),before);
  await store.transaction(db=>{delete db.requests[0].pickupCoordinates;return {write:true};});
  const missing=await call(path,'GET',undefined,farmer.token);
  assert.equal(missing.status,200);assert.equal(missing.data.ready,false);
  assert.deepEqual(missing.data.reasons,['missing_pickup_coordinates']);
  assert.equal(calls,1);
  await store.transaction(db=>{db.requests[0].pickupCoordinates=point(27.7,85.3);db.requests[0].status='cancelled';return {write:true};});
  assert.equal((await call(path,'GET',undefined,farmer.token)).status,409);
});
test('road routing failure is a sanitized 503', async t => {
  const dir=await mkdtemp(join(tmpdir(),'atpro-road-error-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new JsonStore(join(dir,'db.json'));
  const server=createApp({store,now:()=>now,matrixProvider:async()=>{throw new RoutingUnavailableError('private upstream URL');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(path,data)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return res.json();};
  await post('/api/auth/register',{name:'Test Farmer',email:'road-f@example.com',password:'valid-password-123',role:'farmer'});
  const login=await post('/api/auth/login',{email:'road-f@example.com',password:'valid-password-123'});
  await store.transaction(db=>{Object.assign(db,fixture(login.user.id));return {write:true};});
  const res=await fetch(base+'/api/farmer/requests/'+ids.request+'/route-preview',{headers:{Authorization:'Bearer '+login.token}});
  assert.equal(res.status,503);
  const body=await res.json();
  assert.ok(!JSON.stringify(body).includes('private upstream'));
});
