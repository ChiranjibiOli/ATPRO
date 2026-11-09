import React,{useEffect,useState} from 'react';
import {ActivityIndicator,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ActionButton} from '../components/ActionButton';
import {ApiError,farmerRequestDetail,cancelFarmerRequest,type TransportRequest} from '../auth/client';
import {COLORS} from '../theme/palette';

type Props={token:string;id:string;onBack:()=>void;onEdit:(r:TransportRequest)=>void;onSessionExpired:()=>void};
export function RequestDetailScreen({token,id,onBack,onEdit,onSessionExpired}:Props){
  const [request,setRequest]=useState<TransportRequest|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const load=async()=>{
    setLoading(true);setError(null);
    try{const data=await farmerRequestDetail(token,id);setRequest(data.request);}
    catch(e){if(e instanceof ApiError && e.status===401){onSessionExpired();return;}setError(e instanceof ApiError?e.message:'Network unavailable. Try again.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[token,id]);
  const cancel=async()=>{
    if(!request||busy)return;
    setBusy(true);setError(null);
    try{const data=await cancelFarmerRequest(token,id,request.revision??1);setRequest(data.request);setConfirm(false);}
    catch(e){if(e instanceof ApiError && e.status===401){onSessionExpired();return;}setError(e instanceof ApiError?e.message:'Network unavailable. Retry when connected.');setConfirm(false);}
    finally{setBusy(false);}
  };
  const row=(label:string,value:string)=> <View style={styles.row} key={label}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.kicker}>FARMER • REQUEST DETAILS</Text>
    <Text style={styles.title}>Transport request</Text>
    {loading?<View style={styles.row}><ActivityIndicator color={COLORS.forest}/><Text>Loading request...</Text></View>:null}
    {error?<View accessibilityRole="alert" style={styles.box}><Text style={styles.error}>{error}</Text><ActionButton label="Retry loading request" variant="secondary" onPress={()=>void load()}/></View>:null}
    {!loading&&request?<View style={styles.box}>
      {row('Status',request.status)}
      {row('Product',request.productName)}
      {row('Category',request.category)}
      {row('Handling',request.handling)}
      {row('Weight',request.quantityKg+' kg')}
      {row('Pickup address',request.pickupAddress)}
      {row('Destination market',request.marketName)}
      {row('Pickup time',new Date(request.pickupAt).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})+' NPT')}
      {row('Maximum transit',request.maxTransitHours+' hours')}
      {row('Request ID',request.id)}
      {request.status==='pending'?<>
        <ActionButton label="Edit request" onPress={()=>onEdit(request)} disabled={busy}/>
        {confirm?<View style={styles.confirm}>
          <Text style={styles.warning}>Cancel this request? This cannot be undone.</Text>
          <ActionButton label="Yes, cancel this request" onPress={()=>void cancel()} disabled={busy}/>
          <ActionButton label="Keep request" variant="secondary" onPress={()=>setConfirm(false)} disabled={busy}/>
        </View>:<ActionButton label="Cancel transport request" variant="secondary" onPress={()=>setConfirm(true)} disabled={busy}/>}
      </>:<Text style={styles.value}>This request is no longer editable.</Text>}
    </View>:null}
    <ActionButton label="Back to Farmer dashboard" variant="secondary" onPress={onBack} disabled={busy}/>
  </ScrollView>;
}
const styles=StyleSheet.create({
  page:{padding:22,paddingBottom:48,gap:16},
  kicker:{fontSize:11,fontWeight:'800',letterSpacing:1.2,color:COLORS.forest},
  title:{fontSize:28,fontWeight:'800',color:COLORS.ink},
  box:{borderRadius:14,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.white,padding:18,gap:15},
  row:{gap:5},label:{fontSize:13,fontWeight:'700',color:COLORS.forest},value:{fontSize:15,lineHeight:22,color:COLORS.ink},
  error:{fontSize:14,color:'#A12727'},warning:{fontSize:15,fontWeight:'700',color:COLORS.ink},
  confirm:{padding:12,backgroundColor:COLORS.warningTint,borderRadius:12,gap:12},
});
