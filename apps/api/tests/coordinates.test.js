import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { optionalCoordinates } from '../src/geo.js';
import { validateTransportRequest } from '../src/requests.js';
import { validateAvailability } from '../src/availability.js';
import { JsonStore } from '../src/store.js';
import { createApp } from '../src/app.js';

const point={latitude:27.7,longitude:85.3};
const future=()=>new Date(Date.now()+20*86400000+345*60000).toISOString().slice(0,10);
test('coordinate pair validation rejects malformed, partial and out-of-range values',()=>{
 assert.deepEqual(optionalCoordinates(null,'startCoordinates').point,null);
 assert.deepEqual(optionalCoordinates(point,'startCoordinates').point,point);
 for(const p of [{latitude:27.7},{longitude:85.3},{latitude:91,longitude:85},{latitude:'27.7',longitude:85},{latitude:0,longitude:Infinity},[]]){
  assert.ok(optionalCoordinates(p,'startCoordinates').fields.startCoordinates);
 }
});
test('request and availability validators preserve optional legacy inputs',()=>{
 const date=future(),base={productName:'Tomatoes',category:'vegetable',handling:'standard',quantityKg:100,pickupAddress:'Bhaktapur Ward 4',marketName:'Kalimati Market',pickupDate:date,pickupTime:'12:00',maxTransitHours:12};
 assert.equal(validateTransportRequest(base).clean.pickupCoordinates,null);
 assert.deepEqual(validateTransportRequest({...base,pickupCoordinates:point,marketCoordinates:point}).clean.marketCoordinates,point);
 assert.ok(validateTransportRequest({...base,pickupCoordinates:{latitude:27.7}}).fields.pickupCoordinates);
 const availability={date,startTime:'09:00',endTime:'17:00',startAddress:'Pokhara Bus Park'};
 assert.equal(validateAvailability(availability).clean.startCoordinates,null);
 assert.ok(validateAvailability({...availability,startCoordinates:{latitude:100,longitude:85}}).fields.startCoordinates);
});
test('Farmer and Driver coordinates persist with role and ownership protection',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atpro-geo-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=new JsonStore(join(dir,'db.json')),server=createApp({store});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',body,token)=>{
  const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json()};
 };
 const auth=async(email,role)=>{
  assert.equal((await call('/api/auth/register','POST',{name:'Coordinate User',email,password:'valid-password-123',role})).status,201);
  const result=await call('/api/auth/login','POST',{email,password:'valid-password-123'});
  assert.equal(result.status,200);return result.data.token;
 };
 const farmer=await auth('coord-f@example.com','farmer'),other=await auth('coord-o@example.com','farmer'),driver=await auth('coord-d@example.com','driver');
 const request={productName:'Tomatoes',category:'vegetable',handling:'standard',quantityKg:100,pickupAddress:'Bhaktapur Ward 4',marketName:'Kalimati Market',pickupDate:future(),pickupTime:'12:00',maxTransitHours:12,pickupCoordinates:point,marketCoordinates:{latitude:27.69,longitude:85.29}};
 assert.equal((await call('/api/farmer/requests','POST',{...request,pickupCoordinates:{latitude:27.7}},farmer)).status,400);
 const created=await call('/api/farmer/requests','POST',request,farmer);assert.equal(created.status,201);
 const id=created.data.request.id,detail='/api/farmer/requests/'+id;
 assert.deepEqual((await call(detail,'GET',undefined,farmer)).data.request.pickupCoordinates,point);
 assert.equal((await call(detail,'GET',undefined,other)).status,404);
 assert.equal((await call(detail,'GET',undefined,driver)).status,403);
 assert.equal((await call(detail,'PATCH',{...request,revision:1,marketCoordinates:{latitude:200,longitude:85}},farmer)).status,400);
 const edited=await call(detail,'PATCH',{...request,revision:1,marketCoordinates:point},farmer);
 assert.equal(edited.status,200);assert.deepEqual(edited.data.request.marketCoordinates,point);
 assert.equal((await call(detail,'PATCH',{...request,revision:1},farmer)).status,409);
 const vehicle=await call('/api/driver/vehicles','POST',{registrationPlate:'BA 01 PA 9922',vehicleType:'mini_truck',bodyType:'covered',maximumWeightKg:500},driver);
 assert.equal(vehicle.status,201);
 const path='/api/driver/vehicles/'+vehicle.data.vehicle.id+'/availability';
 const availability={date:future(),startTime:'09:00',endTime:'17:00',startAddress:'Pokhara Bus Park',startCoordinates:point};
 assert.equal((await call(path,'POST',{...availability,startCoordinates:{longitude:85}},driver)).status,400);
 assert.equal((await call(path,'POST',availability,farmer)).status,403);
 assert.equal((await call(path,'POST',availability,driver)).status,200);
 const list=await call('/api/driver/availability','GET',undefined,driver);
 assert.deepEqual(list.data.availability[0].startCoordinates,point);
 assert.equal((await call('/api/driver/availability','GET',undefined,farmer)).status,403);
 assert.equal((await call(path,'POST',{...availability,startCoordinates:null},driver)).status,200);
 assert.equal((await new JsonStore(join(dir,'db.json')).read()).availability[0].startCoordinates,null);
});
