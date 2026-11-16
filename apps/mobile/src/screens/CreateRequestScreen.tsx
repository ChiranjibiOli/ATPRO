import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ApiError, createFarmerRequest, updateFarmerRequest, type TransportRequest, type RequestInput } from '../auth/client';
import { COLORS } from '../theme/palette';

type Props = { token:string; onSaved:()=>void; onCancel:()=>void; onSessionExpired:()=>void; existing?:TransportRequest };
type Field = keyof RequestInput;
const categories = ['vegetable','fruit','grain','other'] as const;
const handlingOptions = ['standard','fragile','chilled'] as const;
const initial: RequestInput = {
  productName:'', category:'vegetable', handling:'standard', quantityKg:0,
  pickupAddress:'',marketName:'',pickupDate:'',pickupTime:'',maxTransitHours:24,
};
export function CreateRequestScreen({token,onSaved,onCancel,onSessionExpired,existing}:Props) {
  const [form,setForm]=useState<RequestInput>(()=>existing ? {
    productName:existing.productName,category:existing.category,handling:existing.handling,quantityKg:existing.quantityKg,
    pickupAddress:existing.pickupAddress,marketName:existing.marketName,
    pickupDate:new Date(Date.parse(existing.pickupAt)+345*60_000).toISOString().slice(0,10),
    pickupTime:new Date(Date.parse(existing.pickupAt)+345*60_000).toISOString().slice(11,16),
    maxTransitHours:existing.maxTransitHours
  }:initial);
  const [pickupLat,setPickupLat]=useState(existing?.pickupCoordinates ? String(existing.pickupCoordinates.latitude) : '');
  const [pickupLon,setPickupLon]=useState(existing?.pickupCoordinates ? String(existing.pickupCoordinates.longitude) : '');
  const [marketLat,setMarketLat]=useState(existing?.marketCoordinates ? String(existing.marketCoordinates.latitude) : '');
  const [marketLon,setMarketLon]=useState(existing?.marketCoordinates ? String(existing.marketCoordinates.longitude) : '');
  const [weight,setWeight]=useState(existing ? String(existing.quantityKg) : '');
  const [transit,setTransit]=useState(existing ? String(existing.maxTransitHours) : '24');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [fields,setFields]=useState<Record<string,string>>({});
  const change=<K extends Field>(field:K,value:RequestInput[K])=>{
    setForm(old=>({...old,[field]:value}));
    setFields(old=>({...old,[field]:''}));
  };
  const submit=async()=>{
    if(busy)return;
    setError(null);setFields({});
    const input={...form,quantityKg:Number(weight),maxTransitHours:Number(transit)};
    const local:Record<string,string>={};
    const pair=(lat:string,lon:string,key:string)=>{
      if(!lat.trim()&&!lon.trim())return null;
      const latitude=Number(lat),longitude=Number(lon);
      if(!lat.trim()||!lon.trim()||!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude < -90||latitude > 90||longitude < -180||longitude > 180){
        local[key]='Enter both valid decimal coordinates (latitude -90 to 90, longitude -180 to 180).';return null;
      }
      return {latitude,longitude};
    };
    input.pickupCoordinates=pair(pickupLat,pickupLon,'pickupCoordinates');
    input.marketCoordinates=pair(marketLat,marketLon,'marketCoordinates');
    if(!weight.trim() || !Number.isFinite(input.quantityKg) || input.quantityKg<=0 || input.quantityKg>50000) local.quantityKg='Enter weight greater than 0 and at most 50,000 kg.';
    if(!transit.trim() || !Number.isInteger(input.maxTransitHours) || input.maxTransitHours<1 || input.maxTransitHours>168) local.maxTransitHours='Enter 1–168 whole hours.';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(form.pickupDate)) local.pickupDate='Use YYYY-MM-DD.';
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.pickupTime)) local.pickupTime='Use HH:mm (24-hour).';
    if(Object.keys(local).length){setFields(local);return;}
    setBusy(true);
    try {if(existing) await updateFarmerRequest(token,existing.id,existing.revision,input); else await createFarmerRequest(token,input);onSaved();}
    catch(e) {
      if(e instanceof ApiError && e.status===401){onSessionExpired();return;}
      if(e instanceof ApiError){setError(e.message);setFields(e.fields??{});}
      else setError('Could not reach the server. Your entries are still here; retry when connected.');
    } finally {setBusy(false);}
  };
  const field=(label:string,key:Field,placeholder:string,options?:{keyboardType?:'decimal-pad'|'number-pad';value?:string;onChange?:(v:string)=>void})=>(
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        style={styles.input}
        value={options?.value??String(form[key]??'')}
        onChangeText={options?.onChange??((v)=>change(key,v as never))}
        editable={!busy}
        keyboardType={options?.keyboardType??'default'}
        autoCapitalize="sentences"
      />
      {fields[key]?<Text accessibilityRole="alert" style={styles.error}>{fields[key]}</Text>:null}
    </View>
  );
  const coordinateField=(label:string,value:string,onChange:(v:string)=>void,placeholder:string)=>(
    <View style={styles.field} key={label}><Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} placeholder={placeholder} placeholderTextColor={COLORS.muted}
        value={value} onChangeText={onChange} editable={!busy} keyboardType="numbers-and-punctuation" autoCapitalize="none" />
    </View>);
  const choices=(label:string,key:'category'|'handling',values:readonly string[])=>(
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {values.map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:form[key]===value,disabled:busy}}
          disabled={busy} onPress={()=>change(key,value as never)} style={[styles.choice,form[key]===value&&styles.choiceSelected]}>
          <Text style={[styles.choiceText,form[key]===value&&styles.choiceTextSelected]}>{value.charAt(0).toUpperCase()+value.slice(1)}</Text>
        </Pressable>)}
      </View>
      {fields[key]?<Text style={styles.error}>{fields[key]}</Text>:null}
    </View>
  );
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>{existing ? 'FARMER • EDIT REQUEST' : 'FARMER • NEW TRANSPORT REQUEST'}</Text>
    <Text style={styles.title}>{existing ? 'Update your pending pickup' : 'Arrange a produce pickup'}</Text>
    <Text style={styles.help}>One destination market per request. Enter your preferred pickup date and time in Nepal time (NPT, UTC+05:45). A driver has not been assigned yet.</Text>
    {field('Product name','productName','e.g. Tomatoes')}
    {choices('Product category','category',categories)}
    {choices('Handling requirement','handling',handlingOptions)}
    {field('Total weight (kg)','quantityKg','e.g. 150',{keyboardType:'decimal-pad',value:weight,onChange:v=>{setWeight(v);setFields(old=>({...old,quantityKg:''}));}})}
    {field('Pickup address','pickupAddress','e.g. Ward 4, Bhaktapur')}
    <Text style={styles.help}>Optional pickup coordinates (decimal degrees). Enter both values or leave blank. Not verified GPS.</Text>
    {coordinateField('Pickup latitude',pickupLat,setPickupLat,'27.67')}
    {coordinateField('Pickup longitude',pickupLon,setPickupLon,'85.42')}
    {fields.pickupCoordinates?<Text accessibilityRole="alert" style={styles.error}>{fields.pickupCoordinates}</Text>:null}
    {field('Destination market','marketName','e.g. Kalimati Market')}
    <Text style={styles.help}>Optional destination market coordinates (decimal degrees). One market per request.</Text>
    {coordinateField('Market latitude',marketLat,setMarketLat,'27.69')}
    {coordinateField('Market longitude',marketLon,setMarketLon,'85.29')}
    {fields.marketCoordinates?<Text accessibilityRole="alert" style={styles.error}>{fields.marketCoordinates}</Text>:null}
    {field('Pickup date (YYYY-MM-DD)','pickupDate','2026-11-15')}
    {field('Pickup time (HH:mm, NPT)','pickupTime','14:00')}
    {field('Maximum transit hours','maxTransitHours','e.g. 5',{keyboardType:'number-pad',value:transit,onChange:v=>{setTransit(v);setFields(old=>({...old,maxTransitHours:''}));}})}
    {fields.pickupDate && !fields.pickupTime ? <Text style={styles.error}>Check the pickup date and time.</Text>:null}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    {busy?<View style={styles.progress}><ActivityIndicator color={COLORS.forest}/><Text>Saving request...</Text></View>:null}
    <ActionButton label={existing ? "Save request changes" : "Submit transport request"} disabled={busy} onPress={()=>void submit()}/>
    <ActionButton label="Cancel and return to dashboard" disabled={busy} variant="secondary" onPress={onCancel}/>
  </ScrollView>;
}
const styles=StyleSheet.create({
  page:{padding:22,paddingBottom:48,gap:15},kicker:{fontSize:11,fontWeight:'800',letterSpacing:1.2,color:COLORS.forest},
  title:{fontSize:28,lineHeight:34,fontWeight:'800',color:COLORS.ink},help:{fontSize:14,lineHeight:21,color:COLORS.secondary},
  field:{gap:7},label:{fontSize:15,fontWeight:'700',color:COLORS.ink},
  input:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:10,minHeight:52,paddingHorizontal:14,fontSize:16,color:COLORS.ink},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{minHeight:44,paddingHorizontal:13,justifyContent:'center',borderRadius:10,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.white},
  choiceSelected:{borderColor:COLORS.forest,backgroundColor:COLORS.forestTint},
  choiceText:{fontSize:14,color:COLORS.secondary},choiceTextSelected:{color:COLORS.forest,fontWeight:'700'},
  error:{color:'#A12727',fontSize:13,lineHeight:19},progress:{flexDirection:'row',alignItems:'center',gap:12},
});
