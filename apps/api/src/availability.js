import { nepalPickupAt } from './requests.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDate = value => typeof value === 'string' && datePattern.test(value) && nepalPickupAt(value, '12:00') !== null;
const validTime = value => typeof value === 'string' && timePattern.test(value);
const minutes = value => Number(value.slice(0,2))*60+Number(value.slice(3,5));

export function validateAvailability(data, now=Date.now()) {
  const fields={};
  if (!validDate(data?.date)) fields.date='Enter a valid date (YYYY-MM-DD).';
  if (!validTime(data?.startTime)) fields.startTime='Enter a valid start time (HH:mm).';
  if (!validTime(data?.endTime)) fields.endTime='Enter a valid end time (HH:mm).';
  if (validTime(data?.startTime) && validTime(data?.endTime) && minutes(data.startTime)>=minutes(data.endTime))
    fields.endTime='End time must be later than start time on the same date.';
  const address=typeof data?.startAddress==='string'?data.startAddress.trim():'';
  if (address.length<5 || address.length>200) fields.startAddress='Enter a starting address of 5–200 characters.';
  if (validDate(data?.date) && validTime(data?.endTime)) {
    const end=nepalPickupAt(data.date,data.endTime);
    if (end && (Date.parse(end)<=now || Date.parse(end)>now+365*86400000))
      fields.date='Availability must end in the future and within 365 days.';
  }
  return {fields,clean:{date:data?.date,startTime:data?.startTime,endTime:data?.endTime,startAddress:address}};
}

export function validateEligibilityQuery(params) {
  const fields={};
  const date=params.get('date'),time=params.get('time'),weightText=params.get('weightKg');
  if (!validDate(date)) fields.date='Enter a valid date.';
  if (!validTime(time)) fields.time='Enter a valid time.';
  const weight=weightText!==null && weightText.trim()!==''?Number(weightText):NaN;
  if (!Number.isFinite(weight)||weight<=0||weight>50000) fields.weightKg='Weight must be above 0 and at most 50,000 kg.';
  return {fields,clean:{date,time,weightKg:weight}};
}

/** Preliminary feasibility only: does NOT evaluate product handling, transit time, volume or routes. */
export function previewVehicleEligibility(vehicle, availability, input, now=Date.now()) {
  const reasons=[];
  if(vehicle.status!=='registered') reasons.push('Vehicle is not in registered status.');
  if(input.weightKg>vehicle.maximumWeightKg) reasons.push('Requested weight exceeds vehicle payload limit.');
  const instant=nepalPickupAt(input.date,input.time);
  if (!instant || Date.parse(instant)<=now) reasons.push('Requested pickup time is not in the future.');
  if (!availability || availability.date!==input.date ||
      input.time<availability.startTime || input.time>=availability.endTime)
    reasons.push('No declared availability covers this pickup time.');
  return {eligible:reasons.length===0,reasons,checks:{weightWithinLimit:input.weightKg<=vehicle.maximumWeightKg,
    availabilityCoversTime:!!availability&&availability.date===input.date&&input.time>=availability.startTime&&input.time<availability.endTime},
    note:'Preliminary only. Product compatibility, perishability, volume, road travel, approval and driver acceptance are not checked.'};
}
