import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ApiError, createFarmerRequest, type RequestInput } from '../auth/client';
import { COLORS } from '../theme/palette';

type Props = { token:string; onSaved:()=>void; onCancel:()=>void; onSessionExpired:()=>void };
type Field = keyof RequestInput;
const categories = ['vegetable','fruit','grain','other'] as const;
const handlingOptions = ['standard','fragile','chilled'] as const;
const initial: RequestInput = {
  productName:'', category:'vegetable', handling:'standard', quantityKg:0,
  pickupAddress:'',marketName:'',pickupDate:'',pickupTime:'',maxTransitHours:24,
};
export function CreateRequestScreen({token,onSaved,onCancel,onSessionExpired}:Props) {
  const [form,setForm]=useState<RequestInput>(initial);
  const [weight,setWeight]=useState('');
  const [transit,setTransit]=useState('24');
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
    if(!weight.trim() || !Number.isFinite(input.quantityKg) || input.quantityKg<=0 || input.quantityKg>50000) local.quantityKg='Enter weight greater than 0 and at most 50,000 kg.';
    if(!transit.trim() || !Number.isInteger(input.maxTransitHours) || input.maxTransitHours<1 || input.maxTransitHours>168) local.maxTransitHours='Enter 1–168 whole hours.';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(form.pickupDate)) local.pickupDate='Use YYYY-MM-DD.';
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.pickupTime)) local.pickupTime='Use HH:mm (24-hour).';
    if(Object.keys(local).length){setFields(local);return;}
    setBusy(true);
    try {await createFarmerRequest(token,input);onSaved();}
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
    <Text style={styles.kicker}>FARMER • NEW TRANSPORT REQUEST</Text>
    <Text style={styles.title}>Arrange a produce pickup</Text>
    <Text style={styles.help}>One destination market per request. Enter your preferred pickup date and time in Nepal time (NPT, UTC+05:45). A driver has not been assigned yet.</Text>
    {field('Product name','productName','e.g. Tomatoes')}
    {choices('Product category','category',categories)}
    {choices('Handling requirement','handling',handlingOptions)}
    {field('Total weight (kg)','quantityKg','e.g. 150',{keyboardType:'decimal-pad',value:weight,onChange:v=>{setWeight(v);setFields(old=>({...old,quantityKg:''}));}})}
    {field('Pickup address','pickupAddress','e.g. Ward 4, Bhaktapur')}
    {field('Destination market','marketName','e.g. Kalimati Market')}
    {field('Pickup date (YYYY-MM-DD)','pickupDate','2026-11-15')}
    {field('Pickup time (HH:mm, NPT)','pickupTime','14:00')}
    {field('Maximum transit hours','maxTransitHours','e.g. 5',{keyboardType:'number-pad',value:transit,onChange:v=>{setTransit(v);setFields(old=>({...old,maxTransitHours:''}));}})}
    {fields.pickupDate && !fields.pickupTime ? <Text style={styles.error}>Check the pickup date and time.</Text>:null}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    {busy?<View style={styles.progress}><ActivityIndicator color={COLORS.forest}/><Text>Saving request...</Text></View>:null}
    <ActionButton label="Submit transport request" disabled={busy} onPress={()=>void submit()}/>
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
