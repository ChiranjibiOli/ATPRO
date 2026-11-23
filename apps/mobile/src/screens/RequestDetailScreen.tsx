import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ActionButton} from '../components/ActionButton';
import {ApiError,farmerRequestDetail,cancelFarmerRequest,farmerRequestMatches,farmerRoadPreview,farmerOptimizedPreview,type FarmerOptimizedPreview,type FarmerRoadPreview,type RequestMatchPreview,type TransportRequest,type TransportOffer,createFarmerOffer} from '../auth/client';
import {COLORS} from '../theme/palette';

type Props={token:string;id:string;onBack:()=>void;onEdit:(request:TransportRequest)=>void;onExpired:()=>void};
export function RequestDetailScreen({token,id,onBack,onEdit,onExpired}:Props){
 const [request,setRequest]=useState<TransportRequest|null>(null);
 const [selectedVehicle,setSelectedVehicle]=useState<string|null>(null);
 const [offer,setOffer]=useState<TransportOffer|null>(null);
 const [offerError,setOfferError]=useState<string|null>(null);
 const [offerBusy,setOfferBusy]=useState(false);
 const [preview,setPreview]=useState<RequestMatchPreview|null>(null);
 const [previewLoading,setPreviewLoading]=useState(false);
 const [road,setRoad]=useState<FarmerRoadPreview|null>(null);
 const [roadLoading,setRoadLoading]=useState(false);
 const [optimized,setOptimized]=useState<FarmerOptimizedPreview|null>(null);
 const [optimizedLoading,setOptimizedLoading]=useState(false);
 const [optimizedError,setOptimizedError]=useState<string|null>(null);
 const [roadError,setRoadError]=useState<string|null>(null);
 const [previewError,setPreviewError]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const expired=useRef(onExpired);expired.current=onExpired;
 const load=useCallback(async()=>{
  setLoading(true);setError(null);
  try{setRequest((await farmerRequestDetail(token,id)).request);}
  catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}setError(e instanceof Error?e.message:'Cannot load request.');}
  finally{setLoading(false);}
 },[token,id]);
 useEffect(()=>{void load();},[load]);
 const checkMatches=async()=>{
  if(!request||request.status!=='pending'||previewLoading)return;
  setPreviewLoading(true);setPreviewError(null);setPreview(null);setSelectedVehicle(null);
  try{setPreview(await farmerRequestMatches(token,request.id));}
  catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}
   setPreviewError(e instanceof Error?e.message:'Could not load preview.');}
  finally{setPreviewLoading(false);}
 };
 const checkRoad=async()=>{
  if(!request||request.status!=='pending'||roadLoading)return;
  setRoadLoading(true);setRoadError(null);setRoad(null);
  try{setRoad(await farmerRoadPreview(token,request.id));}
  catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}
   setRoadError(e instanceof Error?e.message:'Could not calculate road route.');}
  finally{setRoadLoading(false);}
 };
 const checkOptimized=async()=>{
  if(!request||request.status!=='pending'||optimizedLoading)return;
  setOptimizedLoading(true);setOptimizedError(null);setOptimized(null);
  try{setOptimized(await farmerOptimizedPreview(token,request.id));}
  catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}
   setOptimizedError(e instanceof Error?e.message:'Could not calculate shared route.');}
  finally{setOptimizedLoading(false);}
 };
 const submitOffer=()=>{
  if(!request||request.status!=='pending'||!selectedVehicle||offerBusy)return;
  Alert.alert('Send transport proposal?','This is a 30-minute proposal, not a confirmed booking. The Driver must accept.',[
   {text:'Not now',style:'cancel'},
   {text:'Send proposal',onPress:()=>{void (async()=>{
    setOfferBusy(true);setOfferError(null);
    try{setOffer((await createFarmerOffer(token,request.id,selectedVehicle)).offer);}
    catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}
     setOfferError(e instanceof Error?e.message:'Proposal failed.');
     if(e instanceof ApiError&&e.status===409)await load();}
    finally{setOfferBusy(false);}
   })();}}
  ]);
 };
 const reasonLabel=(reason:string):string=>({
  missing_pickup_coordinates:'Add pickup latitude and longitude by editing this request.',
  missing_market_coordinates:'Add destination market latitude and longitude by editing this request.',
  missing_driver_start_coordinates:'The selected Driver has not declared starting coordinates for this date.',
  no_eligible_vehicle:'No registered vehicle currently passes the weight, handling and availability checks.',
  vehicle_not_eligible:'The selected vehicle is not eligible for this request.',
  no_feasible_route:'No shared route satisfies capacity, pickup windows, availability and perishability.',
 } as Record<string,string>)[reason]??'Route not ready: '+reason.replace(/_/g,' ');
 const km=(meters:number)=> (meters/1000).toFixed(2)+' km';
 const minutes=(seconds:number)=> (seconds/60).toFixed(1)+' min';
 const cancel=()=>{
  if(!request||request.status!=='pending'||busy)return;
  Alert.alert('Cancel transport request?','This request will be marked cancelled. It cannot be edited or booked later.',[
   {text:'Keep request',style:'cancel'},
   {text:'Cancel request',style:'destructive',onPress:()=>{void (async()=>{
    setBusy(true);setError(null);
    try{await cancelFarmerRequest(token,request.id,request.revision);onBack();}
    catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}setError(e instanceof Error?e.message:'Cancellation failed.');if(e instanceof ApiError&&e.status===409)await load();}
    finally{setBusy(false);}
   })();}}
  ]);
 };
 return <ScrollView contentContainerStyle={s.page}>
  <Text style={s.kicker}>FARMER • REQUEST DETAILS</Text><Text style={s.title}>Transportation request</Text>
  {loading?<ActivityIndicator color={COLORS.forest}/>:null}
  {error?<View accessibilityRole="alert"><Text style={s.error}>{error}</Text><ActionButton label="Retry loading details" onPress={()=>void load()}/></View>:null}
  {!loading&&request?<View style={s.card}>
   <Text style={s.heading}>{request.productName} • {request.quantityKg} kg</Text>
   <Text style={s.line}>Status: {request.status}</Text>
   <Text style={s.line}>Category: {request.category}</Text><Text style={s.line}>Handling: {request.handling}</Text>
   <Text style={s.line}>Pickup: {request.pickupAddress}</Text><Text style={s.line}>Market: {request.marketName}</Text>
   <Text style={s.line}>Pickup time: {new Date(request.pickupAt).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})} NPT</Text>
   <Text style={s.line}>Maximum transit: {request.maxTransitHours} hours</Text>
   <Text style={s.line}>Revision: {request.revision}</Text>
   {request.status==='pending'?<>
    <ActionButton label="Preview shared optimized route" disabled={busy||optimizedLoading} variant="secondary" onPress={()=>void checkOptimized()}/>
    <ActionButton label="Preview road route" disabled={busy||roadLoading} variant="secondary" onPress={()=>void checkRoad()}/>
    <ActionButton label="Find vehicles for transport proposal" disabled={busy||previewLoading||offerBusy} variant="secondary" onPress={()=>void checkMatches()}/>
    <ActionButton label="Edit pending request" disabled={busy} onPress={()=>onEdit(request)}/>
    <ActionButton label="Cancel pending request" disabled={busy} variant="secondary" onPress={cancel}/>
   </>:<Text style={s.line}>Cancelled requests are read-only.</Text>}
  </View>:null}
  {roadLoading?<View style={s.card}><ActivityIndicator color={COLORS.forest}/><Text style={s.line}>Calculating road distance and travel time...</Text></View>:null}
  {roadError?<View accessibilityRole="alert" style={s.card}><Text style={s.error}>{roadError}</Text><ActionButton label="Retry road preview" disabled={roadLoading} onPress={()=>void checkRoad()}/></View>:null}
  {road?<View style={s.card}>
    <Text style={s.heading}>Single-pickup road preview</Text>
    {!road.ready?<View accessibilityRole="alert">
      <Text style={s.line}>Route is not ready.</Text>
      {road.reasons.map(reason=><Text key={reason} style={s.line}>• {reasonLabel(reason)}</Text>)}
    </View>:<>
      <Text style={s.line}>Vehicle: {road.vehicleType.replace('_',' ')} ({road.vehicleId.slice(0,8)})</Text>
      {road.legs.map((leg,index)=><View key={index} style={s.matchRow}>
        <Text style={s.line}>{index===0?'Driver start → Your pickup':'Your pickup → Destination market'}</Text>
        <Text style={s.line}>{km(leg.distanceMeters)} • {minutes(leg.durationSeconds)}</Text>
      </View>)}
      <Text style={s.heading}>Total: {km(road.totalDistanceMeters)} • {minutes(road.totalDurationSeconds)}</Text>
      <Text style={s.line}>{road.note}</Text>
    </>}
    <Text style={s.line}>Road estimates are provisional. No other Farmer pickups, optimization, reservation or Driver acceptance are included.</Text>
  </View>:null}
  {optimizedLoading?<ActivityIndicator color={COLORS.forest}/>:null}
  {optimizedError?<View accessibilityRole="alert" style={s.card}><Text style={s.error}>{optimizedError}</Text><ActionButton label="Retry shared route preview" onPress={()=>void checkOptimized()}/></View>:null}
  {optimized?<View style={s.card}>
    <Text style={s.heading}>Proposed shared pickup route</Text>
    {!optimized.ready?<>
      <Text style={s.line}>A shared route is not ready.</Text>
      {optimized.reasons.map(reason=><Text key={reason} style={s.line}>• {reasonLabel(reason)}</Text>)}
    </>:<>
      <Text style={s.line}>Vehicle type: {optimized.vehicleType.replace('_',' ')}</Text>
      <Text style={s.line}>Pickups on this proposed route: {optimized.pickupCount}</Text>
      <Text style={s.line}>Your pickup position: {optimized.ownPickupPosition} of {optimized.pickupCount}</Text>
      <Text style={s.line}>Total load: {optimized.totalWeightKg} kg</Text>
      <Text style={s.line}>Road distance: {km(optimized.totalDistanceMeters)}</Text>
      <Text style={s.line}>Estimated duration (including waiting): {minutes(optimized.totalDurationSeconds)}</Text>
      <Text style={s.line}>Distance reduced by 2-opt: {km(optimized.distanceSavedMeters)}</Text>
      <Text style={s.line}>Other pending requests not on this route: {optimized.excludedRequestCount}</Text>
      <Text style={s.line}>{optimized.note}</Text>
    </>}
  </View>:null}
  {offerBusy?<ActivityIndicator color={COLORS.forest}/>:null}
  {offerError?<View style={s.card} accessibilityRole="alert"><Text style={s.error}>{offerError}</Text><ActionButton label="Retry proposal" disabled={!selectedVehicle||offerBusy} onPress={submitOffer}/></View>:null}
  {offer?<View style={s.card}><Text style={s.heading}>Proposal submitted</Text><Text style={s.line}>Status: {offer.status}. Driver acceptance is required.</Text><Text style={s.line}>Expires: {new Date(offer.expiresAt).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})} NPT</Text></View>:null}
  {previewLoading?<ActivityIndicator color={COLORS.forest}/>:null}
  {previewError?<View accessibilityRole="alert" style={s.card}><Text style={s.error}>{previewError}</Text><ActionButton label="Retry matching preview" onPress={()=>void checkMatches()}/></View>:null}
  {preview?<View style={s.card}>
    <Text style={s.heading}>Same-market and date pool</Text>
    <Text style={s.line}>{preview.group.marketName} • {preview.group.pickupDate}</Text>
    <Text style={s.line}>{preview.group.pendingRequestCount} pending requests • {preview.group.totalWeightKg} kg combined</Text>
    <Text style={s.heading}>Provisional weight allocation</Text>
    <Text style={s.line}>Assigned: {preview.allocation.assignedRequestCount} requests • {preview.allocation.assignedWeightKg} kg</Text>
    <Text style={s.line}>Unassigned: {preview.allocation.unassignedRequestCount} requests • {preview.allocation.unassignedWeightKg} kg</Text>
    {preview.allocation.vehicles.length===0?<Text style={s.line}>No requests fit eligible vehicle capacity.</Text>:
      preview.allocation.vehicles.map(v=><View key={v.vehicleId} style={s.matchRow}>
        <Text style={s.line}>Vehicle {v.vehicleId.slice(0,8)} • {v.allocatedRequestCount} requests</Text>
        <Text style={s.line}>{v.allocatedWeightKg} kg proposed • {v.remainingWeightKg} kg remaining</Text>
      </View>)}
    <Text style={s.line}>{preview.allocation.note}</Text>
    <Text style={s.heading}>Choose a vehicle for a single-request offer</Text>
    <Text style={s.line}>Only eligible vehicles can be selected. The backend rechecks road feasibility before saving the proposal.</Text>
    {preview.candidates.filter(v=>v.eligible).length===0?<Text style={s.line}>No eligible vehicles to propose to.</Text>:null}
    {preview.candidates.filter(v=>v.eligible).map(v=><ActionButton key={v.vehicleId}
      label={(selectedVehicle===v.vehicleId?'Selected: ':'Select: ')+v.vehicleType.replace('_',' ')+' • '+v.bodyType+' • '+v.maximumWeightKg+' kg'}
      variant="secondary" disabled={offerBusy||!!offer} onPress={()=>setSelectedVehicle(v.vehicleId)}/>)}
    {selectedVehicle&&!offer?<ActionButton label="Send proposal to Driver" disabled={offerBusy} onPress={submitOffer}/>:null}
    <Text style={s.heading}>Individual vehicle compatibility</Text>
    {preview.candidates.length===0?<Text style={s.line}>No registered vehicles exist yet.</Text>:
     preview.candidates.map(v=><View key={v.vehicleId} style={s.matchRow}>
      <Text style={s.line}>{v.vehicleType.replace('_',' ')} • {v.bodyType} • {v.maximumWeightKg} kg</Text>
      <Text style={s.line}>{v.eligible?'Passes preliminary checks':'Not eligible'}</Text>
      {v.reasons.map(reason=><Text key={reason} style={s.line}>• {reason}</Text>)}
     </View>)}
    <Text style={s.line}>{preview.note}</Text>
   </View>:null}
  {busy?<ActivityIndicator color={COLORS.forest}/>:null}
  <ActionButton label="Back to Farmer dashboard" variant="secondary" disabled={busy} onPress={onBack}/>
 </ScrollView>;
}
const s=StyleSheet.create({page:{padding:22,gap:16,paddingBottom:45},kicker:{color:COLORS.forest,fontSize:11,fontWeight:'800',letterSpacing:1.4},title:{fontSize:28,fontWeight:'800',color:COLORS.ink},card:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:14,padding:18,gap:13},heading:{fontSize:19,fontWeight:'700',color:COLORS.ink},line:{fontSize:15,lineHeight:23,color:COLORS.secondary},error:{color:'#A12727',fontSize:14},matchRow:{paddingVertical:10,borderTopWidth:1,borderColor:COLORS.line,gap:4}});
