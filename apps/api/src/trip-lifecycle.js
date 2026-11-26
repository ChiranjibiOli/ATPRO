export function transitionTrip(db,tripId,driverId,requestId,now){
 const trip=(db.trips??[]).find(t=>t.id===tripId&&t.driverId===driverId);
 if(!trip)return {status:404,error:"Trip not found."};
 const assignments=(db.tripAssignments??[]).filter(a=>a.tripId===tripId).sort((a,b)=>a.sequence-b.sequence);
 const fail=()=>({status:409,error:"Trip state changed or transition is not allowed."});
 if(!assignments.length||new Set(assignments.map(a=>a.requestId)).size!==assignments.length||assignments.some((a,i)=>a.sequence!==i+1))return fail();
 const requests=assignments.map(a=>(db.requests??[]).find(r=>r.id===a.requestId));
 if(requests.some(r=>!r))return fail();
 const stamp=new Date(now).toISOString();
 if(requestId!==null){
  const index=assignments.findIndex(a=>a.requestId===requestId);
  if(index<0)return {status:404,error:"Assignment not found."};
  if(!["accepted","in_transit"].includes(trip.status)||assignments[index].status!=="pending_pickup"||requests[index].status!=="assigned"||assignments.slice(0,index).some(a=>a.status!=="picked_up"))return fail();
  assignments[index].status="picked_up";assignments[index].pickedUpAt=stamp;
  requests[index].status="in_transit";requests[index].revision=(requests[index].revision??1)+1;requests[index].updatedAt=stamp;
  trip.status="in_transit";trip.updatedAt=stamp;
 }else{
  if(trip.status!=="in_transit"||assignments.some(a=>a.status!=="picked_up")||requests.some(r=>r.status!=="in_transit"))return fail();
  for(let i=0;i<assignments.length;i++){assignments[i].status="delivered";assignments[i].deliveredAt=stamp;requests[i].status="delivered";requests[i].revision=(requests[i].revision??1)+1;requests[i].updatedAt=stamp;}
  trip.status="completed";trip.completedAt=stamp;trip.updatedAt=stamp;
 }
 return {status:200,trip:{id:trip.id,status:trip.status,updatedAt:trip.updatedAt,...(trip.completedAt?{completedAt:trip.completedAt}:{})},assignments:assignments.map(a=>({requestId:a.requestId,sequence:a.sequence,status:a.status,...(a.pickedUpAt?{pickedUpAt:a.pickedUpAt}:{}),...(a.deliveredAt?{deliveredAt:a.deliveredAt}:{})}))};
}
