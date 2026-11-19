import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRoutingProblem, evaluatePickupRoute, clarkeWrightOpenRoutes, improveFixedEndpointTwoOpt } from '../src/optimization.js';
const problem=(weights=[100,100,100],capacity=500)=>{
 const n=weights.length+2;
 const d=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:10));
 return {pickups:weights.map((w,i)=>({id:`p${i+1}`,weightKg:w})),vehicleCapacityKg:capacity,distancesMeters:d,durationsSeconds:d.map(r=>[...r])};
};
test('directed savings merges pickups without moving endpoints or mutating inputs',()=>{
 const p=problem();p.distancesMeters[1][2]=1;p.distancesMeters[2][3]=1;
 const before=JSON.stringify(p);
 const result=clarkeWrightOpenRoutes(p);
 assert.equal(result.routes.length,1);
 assert.equal(result.routes[0].order.length,3);
 assert.equal(result.routes[0].distanceMeters,22);
 assert.equal(JSON.stringify(p),before);
});
test('capacity and compatibility prevent unsafe merging',()=>{
 const p=problem([300,200,100],500);
 const result=clarkeWrightOpenRoutes(p);
 assert.equal(result.routes.reduce((s,r)=>s+r.order.length,0),3);
 assert.ok(result.routes.every(r=>r.weightKg<=500));
 const separate=clarkeWrightOpenRoutes(problem([100,100]),arr=>arr.length<=1);
 assert.equal(separate.routes.length,2);
});
test('2-opt fixes a crossing pickup order using full directed arcs',()=>{
 const p=problem();p.distancesMeters[0][1]=1;p.distancesMeters[1][2]=20;p.distancesMeters[2][3]=20;p.distancesMeters[3][4]=1;
 p.distancesMeters[1][3]=1;p.distancesMeters[3][2]=1;p.distancesMeters[2][4]=1;
 const original=[1,2,3]; const result=improveFixedEndpointTwoOpt(p,original);
 assert.deepEqual(result.order,[1,3,2]);assert.equal(result.distanceMeters,4);assert.deepEqual(original,[1,2,3]);
});
test('2-opt refuses improvements that violate perishability and pickup windows',()=>{
 const p=problem();p.distancesMeters[0][1]=1;p.distancesMeters[1][2]=20;p.distancesMeters[2][3]=20;p.distancesMeters[3][4]=1;
 p.distancesMeters[1][3]=1;p.distancesMeters[3][2]=1;p.distancesMeters[2][4]=1;
 p.pickups[2].latestArrivalSeconds=15;
 const r=improveFixedEndpointTwoOpt(p,[1,2,3]);assert.equal(r.feasible,false);
 const q=problem([100,100]);q.pickups[0].maxTransitSeconds=5;
 assert.equal(evaluatePickupRoute(q,[1,2]).reason,'perishability');
});
test('rejects malformed, duplicate and unsafe input',()=>{
 const p=problem();assert.throws(()=>validateRoutingProblem({...p,pickups:[p.pickups[0],p.pickups[0]]}),TypeError);
 assert.throws(()=>evaluatePickupRoute(p,[1,1]),TypeError);
 assert.throws(()=>validateRoutingProblem({...p,distancesMeters:[[0]]}),TypeError);
 assert.throws(()=>validateRoutingProblem(problem(Array(24).fill(1))),TypeError);
});
