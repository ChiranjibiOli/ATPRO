import { validateCoordinates } from './geo.js';
import { previewRequestMatches } from './matching.js';
import { previewVehicleEligibility } from './availability.js';
import { nepalPickupAt } from './requests.js';
import { clarkeWrightOpenRoutes, improveFixedEndpointTwoOpt } from './optimization.js';

const marketKey = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
const nepalDate = iso => new Date(Date.parse(iso) + 345 * 60000).toISOString().slice(0, 10);
const samePoint = (a,b) => validateCoordinates(a).valid && validateCoordinates(b).valid &&
  Math.abs(a.latitude-b.latitude) <= 0.0001 && Math.abs(a.longitude-b.longitude) <= 0.0001;
const eligibleForVehicle = (request, vehicle, declaration, date, now) => {
  if (request.status !== 'pending' || !validateCoordinates(request.pickupCoordinates).valid ||
      !samePoint(request.marketCoordinates, declaration.marketCoordinates)) return false;
  const local = new Date(Date.parse(request.pickupAt) + 345*60000).toISOString().slice(11,16);
  if (!previewVehicleEligibility(vehicle,declaration,{date,time:local,weightKg:request.quantityKg},now).eligible) return false;
  if (request.handling === 'chilled' && vehicle.bodyType !== 'refrigerated') return false;
  if (request.handling === 'fragile' && vehicle.bodyType === 'open') return false;
  return ['standard','fragile','chilled'].includes(request.handling) &&
    ['vegetable','fruit','grain','other'].includes(request.category);
};

/** Read-only multi-pickup plan, always scoped to one Farmer's own request. */
export async function optimizedFarmerPreview(db, request, {vehicleId=null,now=Date.now(),matrixProvider}) {
  const matches = previewRequestMatches(db,request,now);
  const reasons=[];
  if (!validateCoordinates(request.pickupCoordinates).valid) reasons.push('missing_pickup_coordinates');
  if (!validateCoordinates(request.marketCoordinates).valid) reasons.push('missing_market_coordinates');
  const candidates=matches.candidates.filter(c=>c.eligible && (!vehicleId || c.vehicleId===vehicleId))
    .sort((a,b)=>a.vehicleId.localeCompare(b.vehicleId));
  const selected=candidates.find(c=>{
    const a=(db.availability??[]).find(v=>v.vehicleId===c.vehicleId && v.date===matches.group.pickupDate);
    return validateCoordinates(a?.startCoordinates).valid;
  });
  if (!selected) reasons.push(candidates.length?'missing_driver_start_coordinates':vehicleId?'vehicle_not_eligible':'no_eligible_vehicle');
  if (reasons.length) return {ready:false,reasons,vehicleId:selected?.vehicleId??null};
  const vehicle=db.vehicles.find(v=>v.id===selected.vehicleId);
  const declaration=(db.availability??[]).find(a=>a.vehicleId===vehicle.id && a.date===matches.group.pickupDate);
  const start=Date.parse(nepalPickupAt(declaration.date,declaration.startTime));
  const end=Date.parse(nepalPickupAt(declaration.date,declaration.endTime));
  const group=(db.requests??[]).filter(r=>r.status==='pending' &&
    marketKey(r.marketName)===marketKey(request.marketName) &&
    nepalDate(r.pickupAt)===matches.group.pickupDate &&
    samePoint(r.marketCoordinates,request.marketCoordinates) &&
    eligibleForVehicle(r,vehicle,{...declaration,marketCoordinates:request.marketCoordinates},matches.group.pickupDate,now))
    .sort((a,b)=>a.id.localeCompare(b.id));
  // Preserve the caller's pickup even if the candidate group exceeds the public OSRM table limit.
  const selectedRequests=[request,...group.filter(r=>r.id!==request.id)].slice(0,23);
  const points=[declaration.startCoordinates,...selectedRequests.map(r=>r.pickupCoordinates),request.marketCoordinates];
  const matrix=await matrixProvider(points);
  const problem={
    pickups:selectedRequests.map(r=>{
      const earliest=Math.max(0,(Date.parse(r.pickupAt)-start)/1000);
      return {id:r.id,weightKg:r.quantityKg,earliestArrivalSeconds:earliest,
        latestArrivalSeconds:earliest+3600,maxTransitSeconds:r.maxTransitHours*3600};
    }),
    distancesMeters:matrix.distancesMeters,durationsSeconds:matrix.durationsSeconds,
    vehicleCapacityKg:vehicle.maximumWeightKg,maxRouteSeconds:(end-start)/1000,
  };
  // Conservative rule: no mixing handling classes until pairwise product compatibility is modeled.
  const compatible=pickups=>new Set(pickups.map(p=>selectedRequests.find(r=>r.id===p.id).handling)).size<=1;
  const initial=clarkeWrightOpenRoutes(problem,compatible);
  const ownIndex=1;
  const ownRoute=initial.routes.find(r=>r.order.includes(ownIndex));
  if (!ownRoute) return {ready:false,reasons:['no_feasible_route'],vehicleId:vehicle.id};
  const improved=improveFixedEndpointTwoOpt(problem,ownRoute.order,compatible);
  const ownPosition=improved.order.indexOf(ownIndex)+1;
  return {
    ready:true,vehicleId:vehicle.id,vehicleType:vehicle.vehicleType,
    pickupCount:improved.order.length,ownPickupPosition:ownPosition,
    excludedRequestCount:Math.max(0,matches.group.pendingRequestCount-improved.order.length),
    totalWeightKg:improved.weightKg,totalDistanceMeters:improved.distanceMeters,
    totalDurationSeconds:improved.durationSeconds,
    distanceSavedMeters:Math.max(0,ownRoute.distanceMeters-improved.distanceMeters),
    note:'Read-only heuristic estimate. No route, capacity or pickup is reserved. Volume, actual traffic, service times and driver acceptance are not verified.'
  };
}
