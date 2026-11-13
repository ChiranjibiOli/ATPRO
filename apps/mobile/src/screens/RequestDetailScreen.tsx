import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ActionButton} from '../components/ActionButton';
import {ApiError,farmerRequestDetail,cancelFarmerRequest,type TransportRequest} from '../auth/client';
import {COLORS} from '../theme/palette';

type Props={token:string;id:string;onBack:()=>void;onEdit:(request:TransportRequest)=>void;onExpired:()=>void};
export function RequestDetailScreen({token,id,onBack,onEdit,onExpired}:Props){
 const [request,setRequest]=useState<TransportRequest|null>(null);
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
    <ActionButton label="Edit pending request" disabled={busy} onPress={()=>onEdit(request)}/>
    <ActionButton label="Cancel pending request" disabled={busy} variant="secondary" onPress={cancel}/>
   </>:<Text style={s.line}>Cancelled requests are read-only.</Text>}
  </View>:null}
  {busy?<ActivityIndicator color={COLORS.forest}/>:null}
  <ActionButton label="Back to Farmer dashboard" variant="secondary" disabled={busy} onPress={onBack}/>
 </ScrollView>;
}
const s=StyleSheet.create({page:{padding:22,gap:16,paddingBottom:45},kicker:{color:COLORS.forest,fontSize:11,fontWeight:'800',letterSpacing:1.4},title:{fontSize:28,fontWeight:'800',color:COLORS.ink},card:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:14,padding:18,gap:13},heading:{fontSize:19,fontWeight:'700',color:COLORS.ink},line:{fontSize:15,lineHeight:23,color:COLORS.secondary},error:{color:'#A12727',fontSize:14}});
