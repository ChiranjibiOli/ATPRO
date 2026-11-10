import React,{useState} from 'react';
import {ActivityIndicator,ScrollView,StyleSheet,Text,TextInput,View,Pressable} from 'react-native';
import {ActionButton} from '../components/ActionButton';
import {ApiError,registerVehicle} from '../auth/client';
import {COLORS} from '../theme/palette';
export function RegisterVehicleScreen({token,onSaved,onCancel,onExpired}:{token:string;onSaved:()=>void;onCancel:()=>void;onExpired:()=>void}){
 const [plate,setPlate]=useState(''),[vehicleType,setVehicleType]=useState<'bike'|'mini_truck'|'truck'>('mini_truck'),[bodyType,setBodyType]=useState<'open'|'covered'|'refrigerated'>('covered'),[weight,setWeight]=useState(''),[volume,setVolume]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[fields,setFields]=useState<Record<string,string>>({});
 const submit=async()=>{if(busy)return;setError(null);setFields({});setBusy(true);try{
  await registerVehicle(token,{registrationPlate:plate,vehicleType,bodyType,maximumWeightKg:Number(weight),...(volume.trim()?{maximumVolumeM3:Number(volume)}:{})});onSaved();
 }catch(e){if(e instanceof ApiError){if(e.status===401){onExpired();return;}setFields(e.fields??{});setError(e.message);}else setError('Cannot reach the API. Check your connection.');}finally{setBusy(false);}};
 const input=(label:string,value:string,onChange:(v:string)=>void,key:string,numeric=false)=><View style={s.group}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChange} editable={!busy} autoCapitalize={numeric?'none':'characters'} keyboardType={numeric?'decimal-pad':'default'}/>{fields[key]?<Text accessibilityRole="alert" style={s.error}>{fields[key]}</Text>:null}</View>;
 const choices=<T extends string>(label:string,value:T,options:readonly T[],set:(v:T)=>void,key:string)=><View style={s.group}><Text style={s.label}>{label}</Text><View style={s.row}>{options.map(v=><Pressable key={v} accessibilityRole="radio" accessibilityState={{checked:value===v}} onPress={()=>set(v)} disabled={busy} style={[s.choice,value===v&&s.active]}><Text style={s.choiceText}>{v.replace('_',' ')}</Text></Pressable>)}</View>{fields[key]?<Text style={s.error}>{fields[key]}</Text>:null}</View>;
 return <ScrollView contentContainerStyle={s.page}><Text style={s.title}>Register vehicle</Text><Text style={s.hint}>Registration records are not yet approved for transport matching.</Text>
 {input('Registration plate',plate,setPlate,'registrationPlate')}
 {choices('Vehicle type',vehicleType,['bike','mini_truck','truck'] as const,setVehicleType,'vehicleType')}
 {choices('Vehicle body',bodyType,['open','covered','refrigerated'] as const,setBodyType,'bodyType')}
 {input('Maximum payload (kg)',weight,setWeight,'maximumWeightKg',true)}
 {input('Maximum volume (m³, optional)',volume,setVolume,'maximumVolumeM3',true)}
 {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
 {busy?<ActivityIndicator color={COLORS.forest}/>:null}
 <ActionButton label="Save vehicle" disabled={busy} onPress={()=>void submit()}/>
 <ActionButton label="Cancel" variant="secondary" disabled={busy} onPress={onCancel}/>
 </ScrollView>;
}
const s=StyleSheet.create({page:{padding:22,paddingBottom:42,gap:16},title:{fontSize:28,fontWeight:'800',color:COLORS.ink},hint:{fontSize:14,lineHeight:21,color:COLORS.secondary},group:{gap:7},label:{fontSize:15,fontWeight:'700',color:COLORS.ink},input:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:10,minHeight:48,paddingHorizontal:12,fontSize:16,color:COLORS.ink},row:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{borderWidth:1,borderColor:COLORS.line,borderRadius:10,paddingHorizontal:12,paddingVertical:12,minHeight:44,backgroundColor:COLORS.white},active:{borderColor:COLORS.forest,backgroundColor:COLORS.forestTint},choiceText:{color:COLORS.ink,fontSize:14},error:{color:'#A12727',fontSize:13}});
