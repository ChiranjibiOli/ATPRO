import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ActionButton} from '../components/ActionButton';
import {ApiError,driverOverview,type DriverOverview} from '../auth/client';
import {COLORS} from '../theme/palette';
export function DriverDashboardScreen({token,onRegister,onLogout,onExpired,busy,error:authError}:{token:string;onRegister:()=>void;onLogout:()=>void;onExpired:()=>void;busy:boolean;error:string|null}){
 const [data,setData]=useState<DriverOverview|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{setLoading(true);setError(null);try{setData(await driverOverview(token));}catch(e){if(e instanceof ApiError&&e.status===401){onExpired();return;}setError(e instanceof Error?e.message:'Network error');}finally{setLoading(false);}},[token]);
 useEffect(()=>{void load();},[load]);
 return <ScrollView contentContainerStyle={s.page}>
  <Text style={s.kicker}>DRIVER DASHBOARD</Text><Text style={s.title}>Your vehicles</Text>
  {loading?<ActivityIndicator color={COLORS.forest}/>:null}
  {error?<View accessibilityRole="alert"><Text style={s.error}>{error}</Text><ActionButton label="Retry" onPress={()=>void load()}/></View>:null}
  {!loading&&!error&&data?<View style={s.card}><Text style={s.heading}>{data.user.name}</Text><Text style={s.text}>Registered vehicles: {data.summary.totalVehicles}</Text>
   {data.vehicles.length===0?<Text style={s.text}>No vehicles registered yet.</Text>:data.vehicles.map(v=><View key={v.id} style={s.vehicle}><Text style={s.heading}>{v.registrationPlate}</Text><Text style={s.text}>{v.vehicleType.replace('_',' ')} • {v.bodyType} • {v.maximumWeightKg} kg</Text><Text style={s.text}>Status: {v.status}</Text></View>)}
  </View>:null}
  <ActionButton label="Register a vehicle" onPress={onRegister}/>
  {authError?<Text accessibilityRole="alert" style={s.error}>{authError}</Text>:null}
  <ActionButton label="Log out" variant="secondary" disabled={busy} onPress={onLogout}/>
 </ScrollView>;
}
const s=StyleSheet.create({page:{padding:22,gap:17,paddingBottom:40},kicker:{color:COLORS.forest,fontWeight:'800',fontSize:11,letterSpacing:1.5},title:{color:COLORS.ink,fontSize:29,fontWeight:'800'},card:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:14,padding:18,gap:12},heading:{color:COLORS.ink,fontWeight:'700',fontSize:17},text:{color:COLORS.secondary,fontSize:15,lineHeight:22},vehicle:{borderTopWidth:1,borderColor:COLORS.line,paddingTop:12,gap:5},error:{color:'#A12727',fontSize:14}});
