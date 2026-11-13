import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { JsonStore } from '../src/store.js';
import { validateAvailability, previewVehicleEligibility } from '../src/availability.js';

const futureDate=()=>{const d=new Date(Date.now()+10*86400000+345*60000);return d.toISOString().slice(0,10);};
test('availability rejects malformed windows, addresses and dates',()=>{
  const date=futureDate();
  for(const data of [{date:'2026-02-30'},{startTime:'18:00',endTime:'12:00'},{startAddress:'a'},{endTime:'25:00'}]){
    const input={date,startTime:'09:00',endTime:'17:00',startAddress:'Pokhara Bus Park',...data};
    assert.ok(Object.keys(validateAvailability(input).fields).length);
  }
});
test('preliminary eligibility covers weight, time boundary and missing declaration',()=>{
 const date=futureDate(),v={status:'registered',maximumWeightKg:500},a={date,startTime:'09:00',endTime:'17:00'};
 assert.equal(previewVehicleEligibility(v,a,{date,time:'12:00',weightKg:500}).eligible,true);
 assert.equal(previewVehicleEligibility(v,a,{date,time:'17:00',weightKg:500}).eligible,false);
 assert.equal(previewVehicleEligibility(v,a,{date,time:'12:00',weightKg:501}).eligible,false);
 assert.equal(previewVehicleEligibility(v,null,{date,time:'12:00',weightKg:1}).eligible,false);
});
test('Driver availability and eligibility enforce role, ownership, persistence and validation',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atpro-availability-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=new JsonStore(join(dir,'db.json')),server=createApp({store});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',body,token)=>{
  const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json()};
 };
 const auth=async(email,role)=>{
  assert.equal((await call('/api/auth/register','POST',{name:'Driver Test',email,password:'valid-password-123',role})).status,201);
  const r=await call('/api/auth/login','POST',{email,password:'valid-password-123'});assert.equal(r.status,200);return r.data.token;
 };
 const a=await auth('availability-a@example.com','driver'),b=await auth('availability-b@example.com','driver'),f=await auth('availability-f@example.com','farmer');
 const created=await call('/api/driver/vehicles','POST',{registrationPlate:'BA 01 PA 1001',vehicleType:'mini_truck',bodyType:'covered',maximumWeightKg:500},a);
 assert.equal(created.status,201);
 const id=created.data.vehicle.id,date=futureDate(),path='/api/driver/vehicles/'+id+'/availability';
 const data={date,startTime:'09:00',endTime:'17:00',startAddress:'Pokhara Bus Park',driverId:'forged'};
 assert.equal((await call(path,'POST',data)).status,401);
 assert.equal((await call(path,'POST',data,f)).status,403);
 assert.equal((await call(path,'POST',data,b)).status,404);
 assert.equal((await call(path,'POST',{...data,endTime:'08:00'},a)).status,400);
 const saved=await call(path,'POST',data,a);assert.equal(saved.status,200);
 assert.equal(saved.data.availability.driverId!== 'forged',true);
 const changed=await call(path,'POST',{...data,startAddress:'Kathmandu Kalanki'},a);assert.equal(changed.status,200);
 const records=(await call('/api/driver/availability','GET',undefined,a)).data.availability;
 assert.equal(records.length,1);assert.equal(records[0].startAddress,'Kathmandu Kalanki');
 assert.equal((await call('/api/driver/availability','GET',undefined,b)).data.availability.length,0);
 const eligibility='/api/driver/vehicles/'+id+'/eligibility?date='+date+'&time=10%3A00&weightKg=450';
 const eligible=await call(eligibility,'GET',undefined,a);assert.equal(eligible.status,200);assert.equal(eligible.data.eligible,true);
 assert.equal((await call(eligibility.replace('450','600'),'GET',undefined,a)).data.eligible,false);
 assert.equal((await call(eligibility.replace('450','nope'),'GET',undefined,a)).status,400);
 assert.equal((await call(eligibility,'GET',undefined,b)).status,404);
 assert.equal((await call(eligibility,'GET',undefined,f)).status,403);
 assert.equal((await call(eligibility,'GET')).status,401);
 assert.equal((await new JsonStore(join(dir,'db.json')).read()).availability.length,1);
});
