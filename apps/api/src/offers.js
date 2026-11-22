import { randomUUID } from 'node:crypto';
import { nepalPickupAt } from './requests.js';
import { previewVehicleEligibility } from './availability.js';
import { validateCoordinates } from './geo.js';
import { evaluatePickupRoute } from './optimization.js';
import { compatibleHandlingPair } from './product-compatibility.js';

const localDate = iso => new Date(Date.parse(iso) + 345 * 60000).toISOString().slice(0,10);
const localTime = iso => new Date(Date.parse(iso) + 345 * 60000).toISOString().slice(11,16);
const sameMarket = (a,b) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const offerPublic = offer => ({id:offer.id,requestId:offer.requestId,vehicleId:offer.vehicleId,status:offer.status,
  marketName:offer.marketName,pickupDate:offer.pickupDate,weightKg:offer.weightKg,
  distanceMeters:offer.distanceMeters,durationSeconds:offer.durationSeconds,expiresAt:offer.expiresAt,createdAt:offer.createdAt});

export function offerReadiness(db, request, vehicleId, now) {
  if (request?.status !== 'pending') return {error:'Request is no longer pending.'};
  const vehicle=(db.vehicles??[]).find(v=>v.id===vehicleId);
  if (!vehicle) return {error:'Vehicle is unavailable.'};
  const date=localDate(request.pickupAt),time=localTime(request.pickupAt);
  const declaration=(db.availability??[]).find(a=>a.vehicleId===vehicleId&&a.driverId===vehicle.driverId&&a.date===date);
  if (!previewVehicleEligibility(vehicle,declaration,{date,time,weightKg:request.quantityKg},now).eligible)
    return {error:'Vehicle is not eligible for this request.'};
  if (request.handling==='chilled'&&vehicle.bodyType!=='refrigerated' ||
      request.handling==='fragile'&&vehicle.bodyType==='open' ||
      !compatibleHandlingPair(request,request))
    return {error:'Vehicle does not support the product handling requirement.'};
  if (![request.pickupCoordinates,request.marketCoordinates,declaration?.startCoordinates].every(p=>validateCoordinates(p).valid))
    return {error:'Pickup, market and Driver start coordinates are required.'};
  const start=Date.parse(nepalPickupAt(date,declaration.startTime));
  const end=Date.parse(nepalPickupAt(date,declaration.endTime));
  if (!Number.isFinite(start)||!Number.isFinite(end)||end<=start) return {error:'Driver availability is invalid.'};
  return {vehicle,declaration,date,start,end,points:[declaration.startCoordinates,request.pickupCoordinates,request.marketCoordinates]};
}
export function proposedOffer(db,request,ready,matrix,now) {
  const {vehicle,declaration,date,start,end}=ready;
  const problem={pickups:[{id:request.id,weightKg:request.quantityKg,
    earliestArrivalSeconds:Math.max(0,(Date.parse(request.pickupAt)-start)/1000),
    latestArrivalSeconds:Math.max(0,(Date.parse(request.pickupAt)-start)/1000)+3600,
    maxTransitSeconds:request.maxTransitHours*3600}],
    vehicleCapacityKg:vehicle.maximumWeightKg,maxRouteSeconds:(end-start)/1000,
    distancesMeters:matrix.distancesMeters,durationsSeconds:matrix.durationsSeconds};
  const result=evaluatePickupRoute(problem,[1]);
  if(!result.feasible)return {error:'Route fails '+result.reason+' constraint.'};
  return {offer:{id:randomUUID(),farmerId:request.farmerId,driverId:vehicle.driverId,
    vehicleId:vehicle.id,requestId:request.id,requestRevision:request.revision??1,
    status:'proposed',marketName:request.marketName,pickupDate:date,weightKg:request.quantityKg,
    distanceMeters:result.distanceMeters,durationSeconds:result.durationSeconds,
    createdAt:new Date(now).toISOString(),expiresAt:new Date(now+30*60_000).toISOString()}};
}
export function transitionOffer(db,offerId,driverId,decision,now) {
  const offer=(db.offers??[]).find(o=>o.id===offerId&&o.driverId===driverId);
  if(!offer)return {status:404,error:'Offer not found.'};
  if(offer.status!=='proposed')return {status:409,error:'Offer already resolved.'};
  if(Date.parse(offer.expiresAt)<=now)return {status:409,error:'Offer expired.'};
  if(decision==='decline'){offer.status='declined';offer.updatedAt=new Date(now).toISOString();return {status:200,offer:offerPublic(offer)};}
  const request=(db.requests??[]).find(r=>r.id===offer.requestId&&r.farmerId===offer.farmerId);
  const ready=request&&offerReadiness(db,request,offer.vehicleId,now);
  if(!request||request.status!=='pending'||(request.revision??1)!==offer.requestRevision||ready.error||
    !sameMarket(request.marketName,offer.marketName)||localDate(request.pickupAt)!==offer.pickupDate||
    request.quantityKg!==offer.weightKg)return {status:409,error:'Request or vehicle availability changed.'};
  if((db.trips??[]).some(t=>t.vehicleId===offer.vehicleId&&t.pickupDate===offer.pickupDate&&
      ['accepted','in_transit'].includes(t.status)) ||
    (db.tripAssignments??[]).some(a=>a.requestId===offer.requestId))
    return {status:409,error:'Vehicle or request already booked.'};
  const trip={id:randomUUID(),driverId,vehicleId:offer.vehicleId,marketName:offer.marketName,
    pickupDate:offer.pickupDate,status:'accepted',distanceMeters:offer.distanceMeters,
    durationSeconds:offer.durationSeconds,acceptedAt:new Date(now).toISOString()};
  db.trips??=[];db.tripAssignments??=[];
  db.trips.push(trip);
  db.tripAssignments.push({tripId:trip.id,requestId:request.id,sequence:1,weightKg:request.quantityKg,status:'pending_pickup'});
  request.status='assigned';request.revision=(request.revision??1)+1;request.updatedAt=new Date(now).toISOString();
  offer.status='accepted';offer.tripId=trip.id;offer.updatedAt=new Date(now).toISOString();
  return {status:200,offer:offerPublic(offer),trip};
}
