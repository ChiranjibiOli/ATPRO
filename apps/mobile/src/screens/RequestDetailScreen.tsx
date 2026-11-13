import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ActionButton} from '../components/ActionButton';
import {ApiError,farmerRequestDetail,cancelFarmerRequest,farmerRequestMatches,type RequestMatchPreview,type TransportRequest} from '../auth/client';
import {COLORS} from '../theme/palette';

type Props={token:string;id:string;onBack:()=>void;onEdit:(request:TransportRequest)=>void;onExpired:()=>void};
export function RequestDetailScreen({token,id,onBack,onEdit,onExpired}:Props){
 const [request,setRequest]=useState<TransportRequest|null>(null);
 const [preview,setPreview]=useState<RequestMatchPreview|null>(null);
 const [previewLoading,setPreviewLoading]=useState(false);
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
  setPreviewLoading(true);setPreviewError(null);setPreview(null);
  try{setPreview(await farmerRequestMatches(token,request.id));}
  catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}
   setPreviewError(e instanceof Error?e.message:'Could not load preview.');}
  finally{setPreviewLoading(false);}
 };
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
    <ActionButton label="Preview compatible vehicles and market group" disabled={busy||previewLoading} variant="secondary" onPress={()=>void checkMatches()}/>
    <ActionButton label="Edit pending request" disabled={busy} onPress={()=>onEdit(request)}/>
    <ActionButton label="Cancel pending request" disabled={busy} variant="secondary" onPress={cancel}/>
   </>:<Text style={s.line}>Cancelled requests are read-only.</Text>}
  </View>:null}
  {previewLoading?<ActivityIndicator color={COLORS.forest}/>:null}
  {previewError?<View accessibilityRole="alert" style={s.card}><Text style={s.error}>{previewError}</Text><ActionButton label="Retry matching preview" onPress={()=>void checkMatches()}/></View>:null}
  {preview?<View style={s.card}>
    <Text style={s.heading}>Same-market and date pool</Text>
    <Text style={s.line}>{preview.group.marketName} • {preview.group.pickupDate}</Text>
    <Text style={s.line}>{preview.group.pendingRequestCount} pending requests • {preview.group.totalWeightKg} kg combined</Text>
    <Text style={s.heading}>Preliminary vehicle compatibility</Text>
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
