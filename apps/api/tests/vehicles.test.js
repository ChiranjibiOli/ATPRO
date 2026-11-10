import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';
import {JsonStore} from '../src/store.js';
import {validateVehicle} from '../src/vehicles.js';

test('vehicle validation rejects unsafe values',()=>{
  for(const v of [{vehicleType:'plane'},{maximumWeightKg:-1},{maximumWeightKg:Infinity},{registrationPlate:'<>?'},{vehicleType:'bike',bodyType:'refrigerated'}]){
    const {fields}=validateVehicle({registrationPlate:'BA 12 PA 1234',vehicleType:'truck',bodyType:'covered',maximumWeightKg:500,...v});
    assert.ok(Object.keys(fields).length);
  }
});
test('driver overview and registration enforce role, ownership, duplicates and persistence',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'atpro-driver-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'db.json'),store=new JsonStore(file),server=createApp({store});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(path,method='GET',body,token)=>{
    const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,body:await r.json()};
  };
  const auth=async(email,role)=>{
    assert.equal((await call('/api/auth/register','POST',{name:'Test User',email,password:'valid-password-123',role})).status,201);
    const r=await call('/api/auth/login','POST',{email,password:'valid-password-123'});assert.equal(r.status,200);return r.body.token;
  };
  const a=await auth('driver-a@example.com','driver'),b=await auth('driver-b@example.com','driver'),farmer=await auth('farmer-a@example.com','farmer');
  assert.equal((await call('/api/driver/overview')).status,401);
  assert.equal((await call('/api/driver/overview','GET',undefined,farmer)).status,403);
  assert.equal((await call('/api/driver/overview','GET',undefined,a)).body.summary.totalVehicles,0);
  const input={registrationPlate:'ba 12 pa 1234',vehicleType:'mini_truck',bodyType:'covered',maximumWeightKg:500,maximumVolumeM3:3,driverId:'injected',status:'approved'};
  const added=await call('/api/driver/vehicles','POST',input,a);
  assert.equal(added.status,201);
  assert.equal(added.body.vehicle.registrationPlate,'BA 12 PA 1234');
  assert.equal(added.body.vehicle.status,'registered');
  assert.notEqual(added.body.vehicle.driverId,'injected');
  assert.equal((await call('/api/driver/vehicles','POST',input,b)).status,409);
  assert.equal((await call('/api/driver/vehicles','POST',{...input,maximumWeightKg:0},a)).status,400);
  assert.equal((await call('/api/driver/vehicles','POST',input,farmer)).status,403);
  assert.equal((await call('/api/driver/overview','GET',undefined,a)).body.summary.totalVehicles,1);
  assert.equal((await call('/api/driver/overview','GET',undefined,b)).body.summary.totalVehicles,0);
  assert.equal((await new JsonStore(file).read()).vehicles.length,1);
});
