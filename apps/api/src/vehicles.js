import { randomUUID } from 'node:crypto';
const types = new Set(['bike','mini_truck','truck']);
const bodies = new Set(['open','covered','refrigerated']);
export function validateVehicle(data) {
  const fields = {};
  const plate = typeof data?.registrationPlate === 'string' ? data.registrationPlate.trim().toUpperCase().replace(/\s+/g,' ') : '';
  if (!/^[A-Z0-9 -]{3,20}$/.test(plate)) fields.registrationPlate='Use 3–20 letters, numbers, spaces or hyphens.';
  if (!types.has(data?.vehicleType)) fields.vehicleType='Choose bike, mini-truck or truck.';
  if (!bodies.has(data?.bodyType)) fields.bodyType='Choose open, covered or refrigerated.';
  if (data?.vehicleType === 'bike' && data?.bodyType === 'refrigerated') fields.bodyType='Refrigerated bikes are not supported.';
  if (typeof data?.maximumWeightKg !== 'number' || !Number.isFinite(data.maximumWeightKg) || data.maximumWeightKg <= 0 || data.maximumWeightKg > 50000)
    fields.maximumWeightKg='Enter a weight above 0 and at most 50,000 kg.';
  if (data?.maximumVolumeM3 !== undefined && (typeof data.maximumVolumeM3 !== 'number' || !Number.isFinite(data.maximumVolumeM3) || data.maximumVolumeM3 <= 0 || data.maximumVolumeM3 > 200))
    fields.maximumVolumeM3='Enter a volume above 0 and at most 200 m³.';
  return {fields,clean:{registrationPlate:plate,vehicleType:data?.vehicleType,bodyType:data?.bodyType,maximumWeightKg:data?.maximumWeightKg,maximumVolumeM3:data?.maximumVolumeM3??null}};
}
export function createVehicle(clean,driverId,now=Date.now()){
  return {id:randomUUID(),driverId,...clean,status:'registered',createdAt:new Date(now).toISOString()};
}
