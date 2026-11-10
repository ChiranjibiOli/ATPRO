import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { COLORS } from '../theme/palette';
import type { AuthUser } from '../auth/client';
export function AccountScreen({user,onLogout,busy,error}:{user:AuthUser;onLogout:()=>void;busy:boolean;error:string|null}) {
  return <View style={styles.page}>
    <Text style={styles.kicker}>AUTHENTICATED ACCOUNT</Text>
    <Text style={styles.title}>Welcome, {user.name}</Text>
    <Text style={styles.text}>Email: {user.email}</Text>
    <Text style={styles.text}>Account role: {user.role.charAt(0).toUpperCase()+user.role.slice(1)}</Text>
    <Text style={styles.note}>Your role is provided by the server. Transport dashboards and booking will be implemented in upcoming milestones.</Text>
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    {busy?<ActivityIndicator color={COLORS.forest}/>:null}
    <ActionButton label="Log out" variant="secondary" onPress={onLogout} disabled={busy}/>
  </View>;
}
const styles=StyleSheet.create({page:{padding:24,gap:15},kicker:{fontSize:11,letterSpacing:1.5,fontWeight:'800',color:COLORS.forest},title:{fontSize:27,fontWeight:'800',color:COLORS.ink},text:{fontSize:15,color:COLORS.secondary},note:{fontSize:14,lineHeight:22,backgroundColor:COLORS.forestTint,padding:16,borderRadius:12,color:COLORS.ink},error:{color:'#A12727'}});
