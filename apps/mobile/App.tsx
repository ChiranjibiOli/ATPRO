import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRolePreferenceStore } from './src/domain/preference';
import { type RoleId } from './src/domain/roles';
import { HomeScreen } from './src/screens/HomeScreen';
import { RolesScreen } from './src/screens/RolesScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { FarmerDashboardScreen } from './src/screens/FarmerDashboardScreen';
import { CreateRequestScreen } from './src/screens/CreateRequestScreen';
import { DriverDashboardScreen } from './src/screens/DriverDashboardScreen';
import { RegisterVehicleScreen } from './src/screens/RegisterVehicleScreen';
import { RequestDetailScreen } from './src/screens/RequestDetailScreen';
import { type AuthUser, type LoginResult, type TransportRequest, me, logout } from './src/auth/client';
import { sessionStore } from './src/auth/session';
import { COLORS } from './src/theme/palette';

type Screen = 'home' | 'roles' | 'register' | 'login' | 'account' | 'createRequest' | 'requestDetail' | 'editRequest' | 'registerVehicle';
const preferenceStore = createRolePreferenceStore(AsyncStorage);

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [activeRequest, setActiveRequest] = useState<TransportRequest | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const changeToken = useRef(0);

  useEffect(() => {
    let mounted = true;
    preferenceStore.load().then(role => { if (mounted) setSelectedRole(role); })
      .catch(() => { if (mounted) setStorageWarning('Saved preferences are unavailable.'); })
      .finally(() => { if (mounted) setIsLoading(false); });
    sessionStore.get().then(async saved => {
      if (!saved) return;
      try {
        const result = await me(saved);
        if (mounted) { setToken(saved); setUser(result.user); setScreen('account'); }
      } catch (error: any) {
        if (error?.status === 401) await sessionStore.clear();
        else if (mounted) setAuthError('Could not verify the saved session. Check the API connection and restart.');
      }
    }).catch(() => { if (mounted) setAuthError('Secure session storage is unavailable.'); })
      .finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);

  const persist = (operation: () => Promise<void>) => {
    const current = ++changeToken.current;
    writeQueue.current = writeQueue.current.catch(() => undefined).then(operation);
    writeQueue.current.then(() => { if (current === changeToken.current) setStorageWarning(null); })
      .catch(() => { if (current === changeToken.current) setStorageWarning('Could not save your role preference.'); });
  };
  const chooseRole = (role: RoleId) => { if (!isLoading) { setSelectedRole(role); persist(() => preferenceStore.save(role)); } };
  const clearRole = () => { if (!isLoading) { setSelectedRole(null); persist(() => preferenceStore.clear()); } };
  const authenticated = async (value: LoginResult) => {
    await sessionStore.save(value.token);
    setToken(value.token); setUser(value.user); setAuthError(null); setScreen('account');
  };
  const signOut = async () => {
    if (!token || authBusy) return;
    setAuthBusy(true); setAuthError(null);
    try {
      await logout(token);
      await sessionStore.clear();
      setToken(null);setUser(null);setScreen('home');
    } catch { setAuthError('Logout could not be confirmed. Check the API connection and try again.'); }
    finally { setAuthBusy(false); }
  };

  return <View style={styles.app}>
    <StatusBar barStyle="dark-content" />
    <View style={styles.topBar}>
      <View style={styles.monogram}><Text style={styles.monogramText}>A</Text></View>
      <View style={styles.brandText}><Text style={styles.brandName}>ATPRO</Text><Text style={styles.brandTag}>Agricultural transport</Text></View>
      <View style={styles.prototypePill}><Text style={styles.prototypeLabel}>PROTOTYPE</Text></View>
    </View>
    <View style={styles.content}>
      {authLoading ? <View style={styles.loading}><ActivityIndicator color={COLORS.forest}/><Text>Checking session...</Text></View> :
        screen === 'requestDetail' && user?.role === 'farmer' && token && activeRequest ? <RequestDetailScreen key={activeRequest.id} token={token} id={activeRequest.id} onBack={()=>setScreen('account')} onEdit={request=>{setActiveRequest(request);setScreen('editRequest');}} onExpired={async()=>{await sessionStore.clear();setToken(null);setUser(null);setScreen('login');}}/> :
        screen === 'editRequest' && user?.role === 'farmer' && token && activeRequest ? <CreateRequestScreen key={activeRequest.id} token={token} existing={activeRequest} onSaved={()=>setScreen('account')} onCancel={()=>setScreen('requestDetail')} onSessionExpired={async()=>{await sessionStore.clear();setToken(null);setUser(null);setScreen('login');}}/> :
        screen === 'registerVehicle' && user?.role === 'driver' && token ? <RegisterVehicleScreen token={token} onSaved={()=>setScreen('account')} onCancel={()=>setScreen('account')} onExpired={async()=>{await sessionStore.clear();setToken(null);setUser(null);setScreen('login');}}/> :
        screen === 'createRequest' && user?.role === 'farmer' && token ? <CreateRequestScreen token={token} onSaved={()=>setScreen('account')} onCancel={()=>setScreen('account')} onSessionExpired={async()=>{await sessionStore.clear();setToken(null);setUser(null);setScreen('login');}}/> :
        screen === 'account' && user ? (user.role === 'farmer' && token
          ? <FarmerDashboardScreen token={token} onCreateRequest={()=>setScreen('createRequest')} onOpenRequest={id=>{setActiveRequest({id} as TransportRequest);setScreen('requestDetail');}} onLogout={signOut} busy={authBusy} authError={authError} onSessionExpired={async () => { await sessionStore.clear(); setToken(null); setUser(null); setScreen('login'); }}/>
          : user.role === 'driver' && token ? <DriverDashboardScreen token={token} onRegister={()=>setScreen('registerVehicle')} onLogout={signOut} busy={authBusy} error={authError} onExpired={async()=>{await sessionStore.clear();setToken(null);setUser(null);setScreen('login');}}/> : <AccountScreen user={user} onLogout={signOut} busy={authBusy} error={authError}/>) :
        screen === 'register' || screen === 'login' ? <AuthScreen key={screen} initial={screen} onBack={()=>setScreen('home')} onAuthenticated={authenticated}/> :
        screen === 'roles' ? <RolesScreen selectedRole={selectedRole} isLoading={isLoading} storageWarning={storageWarning} onSelect={chooseRole} onClear={clearRole} onBack={()=>setScreen('home')}/> :
        <View style={styles.content}>
          <HomeScreen selectedRole={selectedRole} onExplore={()=>setScreen('roles')}/>
          <View style={styles.authActions}>
            {authError ? <Text accessibilityRole="alert" style={styles.authError}>{authError}</Text> : null}
            <Text style={styles.action} accessibilityRole="button" onPress={()=>setScreen('register')}>Create account</Text>
            <Text style={styles.action} accessibilityRole="button" onPress={()=>setScreen('login')}>Sign in</Text>
          </View>
        </View>}
    </View>
  </View>;
}
const styles=StyleSheet.create({
  app:{flex:1,backgroundColor:COLORS.canvas,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight??24):44},
  topBar:{paddingHorizontal:22,paddingVertical:12,borderBottomWidth:1,borderColor:COLORS.line,flexDirection:'row',alignItems:'center',backgroundColor:COLORS.white},
  monogram:{width:38,height:38,borderRadius:11,backgroundColor:COLORS.forest,alignItems:'center',justifyContent:'center'},
  monogramText:{fontSize:22,fontWeight:'900',color:COLORS.white},brandText:{flex:1,marginLeft:10},
  brandName:{color:COLORS.ink,fontSize:19,fontWeight:'800'},brandTag:{color:COLORS.muted,fontSize:11},
  prototypePill:{paddingVertical:6,paddingHorizontal:8,borderRadius:7,backgroundColor:COLORS.forestTint},
  prototypeLabel:{color:COLORS.forest,fontSize:9,fontWeight:'800'},
  content:{flex:1},loading:{flex:1,alignItems:'center',justifyContent:'center',gap:12},
  authActions:{flexDirection:'row',padding:12,gap:10,backgroundColor:COLORS.white,justifyContent:'space-evenly',alignItems:'center',flexWrap:'wrap'},
  action:{color:COLORS.forest,fontWeight:'800',fontSize:15,padding:12,minHeight:44},
  authError:{color:'#A12727',fontSize:12,width:'100%',textAlign:'center'},
});
