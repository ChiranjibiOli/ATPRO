import test from 'node:test';
import assert from 'node:assert/strict';
import { previewGroupAllocation, previewRequestMatches } from '../src/matching.js';

const date='2030-06-15';
const pickup=(time='10:00')=>new Date(Date.parse(date+'T'+time+':00Z')-345*60000).toISOString();
const request=(id,weight,handling='standard',time='10:00')=>({
  id,farmerId:'private-'+id,status:'pending',marketName:'Kalanki',pickupAt:pickup(time),
  quantityKg:weight,handling,category:'vegetable',pickupAddress:'private farm '+id,
});
const vehicle=(id,capacity,bodyType='covered')=>({
  id,driverId:'private-driver-'+id,vehicleType:'mini_truck',bodyType,
  maximumWeightKg:capacity,status:'registered',
});
const availability=(vehicles)=>vehicles.map(v=>({
  vehicleId:v.id,driverId:v.driverId,date,startTime:'09:00',endTime:'18:00',startAddress:'private home',
}));
const now=Date.parse('2029-01-01');
test('500 kg capacity is never exceeded and overflow is unassigned',()=>{
 const v=[vehicle('v1',500)],r=[request('a',300),request('b',200),request('c',100)];
 const db={requests:r,vehicles:v,availability:availability(v)};
 const before=JSON.stringify(db);
 const result=previewGroupAllocation(db,r,v,now);
 assert.deepEqual([result.assignedRequestCount,result.unassignedRequestCount,result.assignedWeightKg,result.unassignedWeightKg],[2,1,500,100]);
 assert.deepEqual(result.vehicles,[{vehicleId:'v1',allocatedRequestCount:2,allocatedWeightKg:500,remainingWeightKg:0}]);
 assert.equal(JSON.stringify(db),before);
 assert.deepEqual(previewGroupAllocation(db,[...r].reverse(),[...v].reverse(),now),result);
});
test('compatibility and declared availability apply to each allocated request',()=>{
 const v=[vehicle('cold',500,'refrigerated'),vehicle('open',500,'open')];
 const r=[request('chilled',250,'chilled'),request('fragile',250,'fragile'),request('standard',200)];
 const db={requests:r,vehicles:v,availability:availability(v)};
 const out=previewGroupAllocation(db,r,v,now);
 assert.equal(out.assignedRequestCount,3);
 assert.equal(out.vehicles.find(x=>x.vehicleId==='cold').allocatedWeightKg,500);
 assert.equal(out.vehicles.find(x=>x.vehicleId==='open').allocatedWeightKg,200);
 const noAvailability=previewGroupAllocation({...db,availability:[]},r,v,now);
 assert.equal(noAvailability.assignedRequestCount,0);
 assert.equal(noAvailability.unassignedRequestCount,3);
});
test('different pickup times and handling constraints can leave requests unassigned',()=>{
 const v=[vehicle('v',500,'open')],r=[request('fragile',100,'fragile'),request('late',100,'standard','19:00')];
 const out=previewGroupAllocation({availability:availability(v)},r,v,now);
 assert.equal(out.assignedRequestCount,0);
});
test('group preview uses one market/date, excludes cancelled, and leaks no private details',()=>{
 const v=[vehicle('v',500)],r=[request('mine',250),request('other',250),request('overflow',100)];
 const different={...request('different',100),marketName:'Pokhara'};
 const cancelled={...request('cancelled',100),status:'cancelled'};
 const db={requests:[...r,different,cancelled],vehicles:v,availability:availability(v)};
 const out=previewRequestMatches(db,r[0],now);
 assert.equal(out.group.pendingRequestCount,3);
 assert.equal(out.allocation.assignedRequestCount,2);
 assert.equal(out.allocation.unassignedRequestCount,1);
 assert.equal(out.allocation.unassignedWeightKg,100);
 const serialized=JSON.stringify(out);
 assert.ok(!serialized.includes('private farm'));
 assert.ok(!serialized.includes('private-driver'));
 assert.ok(!serialized.includes('other'));
 assert.ok(!serialized.includes('overflow'));
});
test('fractional kg never overfills capacity',()=>{
 const v=[vehicle('v',0.3)],r=[request('a',0.1),request('b',0.2),request('c',0.001)];
 const out=previewGroupAllocation({availability:availability(v)},r,v,now);
 assert.equal(out.assignedWeightKg,0.3);
 assert.equal(out.unassignedWeightKg,0.001);
 assert.equal(out.vehicles[0].remainingWeightKg,0);
});
