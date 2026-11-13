import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { JsonStore } from '../src/store.js';
import { previewRequestMatches } from '../src/matching.js';

const at = (date, time) => new Date(Date.parse(date + 'T' + time + ':00Z') - 345*60000).toISOString();
const date = '2030-06-15';
const req = (id,marketName,pickupAt,status='pending',quantityKg=100)=>({
 id,farmerId:'owner',marketName,pickupAt,status,quantityKg,category:'vegetable',handling:'fragile'
});
test('compatibility and market grouping are read-only and do not leak other farmers',()=>{
 const vehicles=[
  {id:'open',driverId:'d1',vehicleType:'truck',bodyType:'open',maximumWeightKg:500,status:'registered'},
  {id:'covered',driverId:'d2',vehicleType:'mini_truck',bodyType:'covered',maximumWeightKg:500,status:'registered'},
  {id:'cold',driverId:'d3',vehicleType:'truck',bodyType:'refrigerated',maximumWeightKg:80,status:'registered'},
 ];
 const availability=vehicles.map(v=>({vehicleId:v.id,driverId:v.driverId,date,startTime:'09:00',endTime:'18:00'}));
 const mine=req('mine',' Kalanki  Market ',at(date,'10:00'));
 const other={...req('secret','kalanki market',at(date,'11:00')),farmerId:'another'};
 const db={vehicles,availability,requests:[mine,other,req('different','Kalanki Market',at('2030-06-16','10:00')),
  req('cancelled','Kalanki Market',at(date,'10:00'),'cancelled'),req('othermarket','Pokhara',at(date,'10:00'))]};
 const out=previewRequestMatches(db,mine,Date.parse('2029-01-01'));
 assert.equal(out.group.pendingRequestCount,2);
 assert.equal(out.group.totalWeightKg,200);
 assert.equal(out.candidates.find(v=>v.vehicleId==='open').eligible,false);
 assert.equal(out.candidates.find(v=>v.vehicleId==='covered').eligible,true);
 assert.equal(out.candidates.find(v=>v.vehicleId==='cold').eligible,false);
 assert.ok(!JSON.stringify(out).includes('secret'));
 assert.ok(!JSON.stringify(out).includes('another'));
 mine.handling='chilled';
 const chilled=previewRequestMatches(db,mine,Date.parse('2029-01-01'));
 assert.equal(chilled.candidates.find(v=>v.vehicleId==='covered').eligible,false);
 mine.quantityKg=50;
 assert.equal(previewRequestMatches(db,mine,Date.parse('2029-01-01')).candidates.find(v=>v.vehicleId==='cold').eligible,true);
 assert.equal(db.requests.length,5);
});
test('Farmer match endpoint enforces session, role, ownership, status and privacy',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atpro-matches-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=new JsonStore(join(dir,'db.json')),server=createApp({store});
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
  return {token:login.data.token,user:login.data.user};
 };
 const a=await auth('match-a@example.com','farmer'),b=await auth('match-b@example.com','farmer'),driver=await auth('match-d@example.com','driver');
 const id='11111111-1111-4111-8111-111111111111';
 await store.transaction(db=>{db.requests=[{...req(id,'Kalanki',at(date,'10:00')),farmerId:a.user.id}];return {write:true};});
 const path='/api/farmer/requests/'+id+'/matches';
 assert.equal((await call(path)).status,401);
 assert.equal((await call(path,'GET',undefined,driver.token)).status,403);
 assert.equal((await call(path,'GET',undefined,b.token)).status,404);
 const ok=await call(path,'GET',undefined,a.token);
 assert.equal(ok.status,200);assert.equal(ok.data.group.pendingRequestCount,1);
 assert.deepEqual(ok.data.candidates,[]);
 await store.transaction(db=>{db.requests[0].status='cancelled';return {write:true};});
 assert.equal((await call(path,'GET',undefined,a.token)).status,409);
});
