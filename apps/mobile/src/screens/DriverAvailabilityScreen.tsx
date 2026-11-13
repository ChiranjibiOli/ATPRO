import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ActionButton} from '../components/ActionButton';
import {ApiError,driverOverview,driverAvailability,saveDriverAvailability,previewDriverEligibility,type Vehicle,type DriverAvailability,type EligibilityResult} from '../auth/client';
import {COLORS} from '../theme/palette';

type Props={token:string;onBack:()=>void;onExpired:()=>void};
export function DriverAvailabilityScreen({token,onBack,onExpired}:Props){
 const [vehicles,setVehicles]=useState<Vehicle[]>([]),[entries,setEntries]=useState<DriverAvailability[]>([]);
 const [vehicleId,setVehicleId]=useState(''),[date,setDate]=useState(''),[startTime,setStartTime]=useState('09:00'),[endTime,setEndTime]=useState('17:00'),[address,setAddress]=useState('');
 const [checkDate,setCheckDate]=useState(''),[checkTime,setCheckTime]=useState('10:00'),[weight,setWeight]=useState('');
 const [result,setResult]=useState<EligibilityResult|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[fields,setFields]=useState<Record<string,string>>({});
 const handleError=(e:unknown)=>{if(e instanceof ApiError&&e.status===401){onExpired();return;}setFields(e instanceof ApiError?(e.fields??{}):{});setError(e instanceof Error?e.message:'Cannot reach the API.');};
 const load=useCallback(async()=>{
  setLoading(true);setError(null);
  try{const [overview,list]=await Promise.all([driverOverview(token),driverAvailability(token)]);
   setVehicles(overview.vehicles);setEntries(list.availability);
   setVehicleId(old=>overview.vehicles.some(v=>v.id===old)?old:(overview.vehicles[0]?.id??''));
  }catch(e){handleError(e);}finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void load();},[load]);
 const chosen=vehicles.find(v=>v.id===vehicleId);
 const save=async()=>{
  if(!chosen||busy)return;setBusy(true);setError(null);setNotice(null);setFields({});setResult(null);
  try{await saveDriverAvailability(token,chosen.id,{date,startTime,endTime,startAddress:address});
   setNotice('Availability saved for '+date+'.');setCheckDate(date);
   const list=await driverAvailability(token);setEntries(list.availability);
  }catch(e){handleError(e);}finally{setBusy(false);}
 };
 const check=async()=>{
  if(!chosen||busy)return;setBusy(true);setError(null);setNotice(null);setFields({});setResult(null);
  try{const response=await previewDriverEligibility(token,chosen.id,{date:checkDate,time:checkTime,weightKg:Number(weight)});
   setResult(response);
  }catch(e){handleError(e);}finally{setBusy(false);}
 };
 const input=(label:string,value:string,change:(value:string)=>void,field:string,placeholder:string,numeric=false)=>
  <View style={s.group}><Text style={s.label}>{label}</Text>
   <TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={change} placeholder={placeholder} editable={!busy} autoCapitalize="none" keyboardType={numeric?'decimal-pad':'default'}/>
   {fields[field]?<Text accessibilityRole="alert" style={s.error}>{fields[field]}</Text>:null}
  </View>;
 return <ScrollView contentContainerStyle={s.page}>
  <Pressable accessibilityRole="button" onPress={onBack} style={s.back}><Text style={s.backText}>← Back to dashboard</Text></Pressable>
  <Text style={s.title}>Vehicle availability</Text>
  <Text style={s.hint}>Declare where your vehicle starts and when it is available. Times use Nepal local time. This is not live GPS.</Text>
  {loading?<ActivityIndicator color={COLORS.forest}/>:null}
  {error?<View accessibilityRole="alert"><Text style={s.error}>{error}</Text><ActionButton label="Retry loading" onPress={()=>void load()}/></View>:null}
  {!loading&&vehicles.length===0?<Text style={s.hint}>No vehicles registered. Return to the Driver dashboard and register a vehicle first.</Text>:null}
  {!loading&&vehicles.length>0?<>
   <Text style={s.label}>Select your vehicle</Text>
   <View style={s.row}>{vehicles.map(v=><Pressable key={v.id} accessibilityRole="radio" accessibilityState={{checked:vehicleId===v.id}} disabled={busy}
    onPress={()=>{setVehicleId(v.id);setResult(null);setNotice(null);}} style={[s.choice,vehicleId===v.id&&s.active]}>
    <Text style={s.choiceText}>{v.registrationPlate}</Text></Pressable>)}</View>
   <View style={s.card}><Text style={s.heading}>1. Declare availability</Text>
    {input('Available date',date,setDate,'date','YYYY-MM-DD')}
    {input('Start time',startTime,setStartTime,'startTime','09:00')}
    {input('End time',endTime,setEndTime,'endTime','17:00')}
    {input('Starting address',address,setAddress,'startAddress','City and pickup starting point')}
    <Text style={s.hint}>Saving again for the same vehicle and date replaces its earlier declaration.</Text>
    <ActionButton label="Save availability" disabled={busy} onPress={()=>void save()}/>
    {entries.filter(a=>a.vehicleId===vehicleId).map(a=><Text key={a.date} style={s.entry}>{a.date}: {a.startTime}–{a.endTime} • {a.startAddress}</Text>)}
   </View>
   <View style={s.card}><Text style={s.heading}>2. Preliminary eligibility check</Text>
    <Text style={s.hint}>Check declared time and weight only. Product compatibility, volume, travel time, vehicle approval and driver acceptance are not yet evaluated.</Text>
    {input('Pickup date',checkDate,setCheckDate,'date','YYYY-MM-DD')}
    {input('Pickup time',checkTime,setCheckTime,'time','HH:mm')}
    {input('Requested load (kg)',weight,setWeight,'weightKg','e.g. 300',true)}
    <ActionButton label="Check eligibility" disabled={busy} onPress={()=>void check()}/>
    {result?<View accessibilityRole="summary" style={s.result}>
     <Text style={s.heading}>{result.eligible?'Passes preliminary checks':'Not eligible for this time and weight'}</Text>
     {result.reasons.map(reason=><Text key={reason} style={s.hint}>• {reason}</Text>)}
     <Text style={s.hint}>{result.note}</Text>
    </View>:null}
   </View>
  </>:null}
  {notice?<Text accessibilityRole="alert" style={s.success}>{notice}</Text>:null}
  {busy?<ActivityIndicator color={COLORS.forest}/>:null}
 </ScrollView>;
}
const s=StyleSheet.create({
 page:{padding:22,paddingBottom:45,gap:15},back:{minHeight:44,justifyContent:'center',alignSelf:'flex-start'},backText:{color:COLORS.forest,fontWeight:'700',fontSize:15},
 title:{fontSize:28,fontWeight:'800',color:COLORS.ink},hint:{fontSize:14,lineHeight:21,color:COLORS.secondary},
 label:{fontSize:15,fontWeight:'700',color:COLORS.ink},group:{gap:6},input:{backgroundColor:COLORS.white,borderColor:COLORS.line,borderWidth:1,borderRadius:10,minHeight:48,paddingHorizontal:12,fontSize:16,color:COLORS.ink},
 row:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:10,minHeight:44,padding:12},
 active:{backgroundColor:COLORS.forestTint,borderColor:COLORS.forest},choiceText:{color:COLORS.ink,fontWeight:'600'},
 card:{backgroundColor:COLORS.white,borderColor:COLORS.line,borderWidth:1,borderRadius:14,padding:17,gap:12},
 heading:{fontSize:18,fontWeight:'700',color:COLORS.ink},entry:{fontSize:13,lineHeight:20,color:COLORS.secondary,borderTopWidth:1,borderColor:COLORS.line,paddingTop:9},
 result:{backgroundColor:COLORS.forestTint,borderRadius:10,padding:12,gap:8},error:{color:'#A12727',fontSize:14},success:{color:COLORS.forest,fontSize:14,fontWeight:'700'}
});
