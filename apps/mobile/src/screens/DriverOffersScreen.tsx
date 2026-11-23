import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ActionButton} from '../components/ActionButton';
import {ApiError,driverOffers,decideDriverOffer,type TransportOffer} from '../auth/client';
import {COLORS} from '../theme/palette';

export function DriverOffersScreen({token,onBack,onExpired}:{token:string;onBack:()=>void;onExpired:()=>void}){
 const [offers,setOffers]=useState<TransportOffer[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
 const expired=useRef(onExpired);expired.current=onExpired;
 const load=useCallback(async()=>{
  setLoading(true);setError(null);
  try{setOffers((await driverOffers(token)).offers);}
  catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}setError(e instanceof Error?e.message:'Unable to load offers.');}
  finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void load();},[load]);
 const decide=(offer:TransportOffer,decision:'accept'|'decline')=>{
  Alert.alert(decision==='accept'?'Accept this trip?':'Decline this proposal?',
   decision==='accept'?'Acceptance creates a confirmed trip for this single request.':'This proposal will be declined.',[
   {text:'Cancel',style:'cancel'},
   {text:decision==='accept'?'Accept trip':'Decline',style:decision==='decline'?'destructive':'default',onPress:()=>{void (async()=>{
    setBusy(offer.id);setError(null);setMessage(null);
    try{const result=await decideDriverOffer(token,offer.id,decision);
      setMessage(result.trip?'Trip accepted: '+result.trip.id.slice(0,8):'Proposal declined.');
      await load();
    }catch(e){if(e instanceof ApiError&&e.status===401){expired.current();return;}
      setError(e instanceof Error?e.message:'Could not update proposal.');
      await load();
    }finally{setBusy(null);}
   })();}}
  ]);
 };
 return <ScrollView contentContainerStyle={s.page}>
  <Text style={s.kicker}>DRIVER • OFFERS</Text><Text style={s.title}>Transport proposals</Text>
  <Text style={s.line}>Proposals are for one request each. Accepting confirms a trip; declining does not.</Text>
  <ActionButton label="Refresh offers" variant="secondary" disabled={loading||!!busy} onPress={()=>void load()}/>
  {loading?<ActivityIndicator color={COLORS.forest}/>:null}
  {error?<View accessibilityRole="alert"><Text style={s.error}>{error}</Text><ActionButton label="Retry loading offers" onPress={()=>void load()}/></View>:null}
  {message?<Text accessibilityRole="alert" style={s.line}>{message}</Text>:null}
  {!loading&&!error&&offers.length===0?<Text style={s.line}>No transport proposals yet.</Text>:null}
  {!loading&&offers.map(offer=>{
   const pending=offer.status==='proposed'&&Date.parse(offer.expiresAt)>Date.now();
   return <View key={offer.id} style={s.card}>
    <Text style={s.heading}>{offer.marketName} • {offer.weightKg} kg</Text>
    <Text style={s.line}>Pickup date: {offer.pickupDate}</Text>
    <Text style={s.line}>Status: {pending?'Awaiting your decision':offer.status==='proposed'?'Expired':offer.status}</Text>
    <Text style={s.line}>Distance: {(offer.distanceMeters/1000).toFixed(2)} km • Estimated driving: {(offer.durationSeconds/60).toFixed(1)} min</Text>
    <Text style={s.line}>Expires: {new Date(offer.expiresAt).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})} NPT</Text>
    {pending?<><ActionButton label="Accept proposal" disabled={!!busy} onPress={()=>decide(offer,'accept')}/>
     <ActionButton label="Decline proposal" variant="secondary" disabled={!!busy} onPress={()=>decide(offer,'decline')}/></>:null}
   </View>;
  })}
  <ActionButton label="Back to Driver dashboard" variant="secondary" disabled={!!busy} onPress={onBack}/>
 </ScrollView>;
}
const s=StyleSheet.create({page:{padding:22,gap:16,paddingBottom:44},kicker:{color:COLORS.forest,fontSize:11,fontWeight:'800',letterSpacing:1.4},title:{fontSize:28,fontWeight:'800',color:COLORS.ink},card:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:14,padding:18,gap:12},heading:{fontSize:18,fontWeight:'700',color:COLORS.ink},line:{fontSize:15,lineHeight:23,color:COLORS.secondary},error:{color:'#A12727',fontSize:14}});
