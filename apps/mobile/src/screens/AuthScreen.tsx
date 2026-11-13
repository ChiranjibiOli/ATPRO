import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { COLORS } from '../theme/palette';
import { ApiError, login, register, type LoginResult } from '../auth/client';

type Props = { initial: 'register'|'login'; onBack:()=>void; onAuthenticated:(value:LoginResult)=>Promise<void> };
export function AuthScreen({ initial, onBack, onAuthenticated }: Props) {
  const [mode,setMode] = useState(initial);
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [role,setRole]=useState<'farmer'|'driver'>('farmer');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [errors,setErrors]=useState<Record<string,string>>({});
  const submit=async()=>{
    if(busy)return;
    setErrors({});setMessage('');
    const local:Record<string,string>={};
    if(!email.includes('@'))local.email='Enter a valid email.';
    if(mode==='register'){
      if(name.trim().length<2)local.name='Enter your full name.';
      if(password.length<12)local.password='Use at least 12 characters.';
      if(password!==confirm)local.confirm='Passwords do not match.';
    } else if(!password)local.password='Enter your password.';
    if(Object.keys(local).length){setErrors(local);return;}
    setBusy(true);
    try{
      if(mode==='register'){
        await register({name:name.trim(),email:email.trim(),password,role});
        setMode('login');setPassword('');setConfirm('');setMessage('Account created. Sign in to continue.');
      }else{
        const result=await login({email:email.trim(),password});
        await onAuthenticated(result);
      }
    }catch(e){if(e instanceof ApiError){setMessage(e.message);setErrors(e.fields??{});}else setMessage('Could not reach the server. Check your connection and API address.');}
    finally{setBusy(false);}
  };
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
    <Text style={styles.title}>{mode==='register'?'Create your ATPRO account':'Sign in to ATPRO'}</Text>
    <Text style={styles.subtitle}>{mode==='register'?'Register as a Farmer or Driver. Admin accounts are not publicly available.':'Your account role is verified by the server, not your browsing preference.'}</Text>
    {mode==='register'?<>
      <Text style={styles.label}>Full name</Text>
      <TextInput accessibilityLabel="Full name" style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" maxLength={100} editable={!busy}/>
      {errors.name?<Text style={styles.error}>{errors.name}</Text>:null}
      <Text style={styles.label}>Account type</Text>
      <View style={styles.roles}>{(['farmer','driver'] as const).map(id=><Pressable key={id} accessibilityRole="radio" accessibilityState={{checked:role===id}} onPress={()=>setRole(id)} style={[styles.role,role===id&&styles.active]}><Text style={styles.roleText}>{id==='farmer'?'Farmer':'Driver'}</Text></Pressable>)}</View>
      {errors.role?<Text style={styles.error}>{errors.role}</Text>:null}
    </>:null}
    <Text style={styles.label}>Email address</Text>
    <TextInput accessibilityLabel="Email address" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!busy}/>
    {errors.email?<Text style={styles.error}>{errors.email}</Text>:null}
    <Text style={styles.label}>Password</Text>
    <TextInput accessibilityLabel="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} editable={!busy}/>
    {errors.password?<Text style={styles.error}>{errors.password}</Text>:null}
    {mode==='register'?<>
      <Text style={styles.label}>Confirm password</Text>
      <TextInput accessibilityLabel="Confirm password" style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" maxLength={128} editable={!busy}/>
      {errors.confirm?<Text style={styles.error}>{errors.confirm}</Text>:null}
    </>:null}
    {message?<Text accessibilityRole="alert" style={styles.message}>{message}</Text>:null}
    {busy?<ActivityIndicator color={COLORS.forest}/>:null}
    <ActionButton label={mode==='register'?'Create account':'Sign in'} onPress={submit} disabled={busy}/>
    <ActionButton variant="secondary" label={mode==='register'?'Already registered? Sign in':'Need an account? Register'} onPress={()=>{setMode(mode==='register'?'login':'register');setMessage('');setErrors({});setPassword('');setConfirm('');}} disabled={busy}/>
  </ScrollView>;
}
const styles=StyleSheet.create({
  page:{padding:22,paddingBottom:45,gap:10},back:{minHeight:44,justifyContent:'center'},backText:{color:COLORS.forest,fontWeight:'700',fontSize:15},
  title:{fontSize:29,lineHeight:36,fontWeight:'800',color:COLORS.ink},subtitle:{fontSize:14,lineHeight:22,color:COLORS.secondary,marginBottom:8},
  label:{fontWeight:'700',color:COLORS.ink,fontSize:14,marginTop:8},input:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:10,minHeight:52,paddingHorizontal:14,color:COLORS.ink,fontSize:16},
  roles:{flexDirection:'row',gap:10},role:{flex:1,backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:10,padding:15,alignItems:'center'},
  active:{backgroundColor:COLORS.forestTint,borderColor:COLORS.forest,borderWidth:2},roleText:{fontWeight:'700',color:COLORS.ink},error:{color:'#A12727',fontSize:13},message:{padding:12,color:COLORS.ink,backgroundColor:COLORS.forestTint,borderRadius:9},
});
