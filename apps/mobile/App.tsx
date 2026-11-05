import React, { useEffect, useRef, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRolePreferenceStore } from './src/domain/preference';
import { type RoleId } from './src/domain/roles';
import { HomeScreen } from './src/screens/HomeScreen';
import { RolesScreen } from './src/screens/RolesScreen';
import { COLORS } from './src/theme/palette';

type Screen = 'home' | 'roles';
const preferenceStore = createRolePreferenceStore(AsyncStorage);

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const changeToken = useRef(0);

  useEffect(() => {
    let mounted = true;
    preferenceStore.load()
      .then((role) => { if (mounted) setSelectedRole(role); })
      .catch(() => {
        if (mounted) setStorageWarning('Saved preferences are unavailable. Your selection will still work until you close the app.');
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const persist = (operation: () => Promise<void>) => {
    const token = ++changeToken.current;
    // Serialize successive taps so an older save cannot overwrite a newer choice.
    writeQueue.current = writeQueue.current.catch(() => undefined).then(operation);
    writeQueue.current.then(() => {
      if (token === changeToken.current) setStorageWarning(null);
    }).catch(() => {
      if (token === changeToken.current) {
        setStorageWarning('Could not save on this device. Your current selection still works during this session.');
      }
    });
  };

  const chooseRole = (role: RoleId) => {
    if (isLoading) return;
    setSelectedRole(role);
    persist(() => preferenceStore.save(role));
  };

  const clearRole = () => {
    if (isLoading) return;
    setSelectedRole(null);
    persist(() => preferenceStore.clear());
  };

  return (
    <View style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
      <View style={styles.topBar}>
        <View style={styles.monogram}><Text style={styles.monogramText}>A</Text></View>
        <View style={styles.brandText}>
          <Text style={styles.brandName}>ATPRO</Text>
          <Text style={styles.brandTag}>Agricultural transport</Text>
        </View>
        <View style={styles.prototypePill}><Text style={styles.prototypeLabel}>PROTOTYPE</Text></View>
      </View>
      <View style={styles.content}>
        {screen === 'home'
          ? <HomeScreen selectedRole={selectedRole} onExplore={() => setScreen('roles')} />
          : <RolesScreen
              selectedRole={selectedRole}
              isLoading={isLoading}
              storageWarning={storageWarning}
              onSelect={chooseRole}
              onClear={clearRole}
              onBack={() => setScreen('home')}
            />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLORS.canvas, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44 },
  topBar: { paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: 1, borderColor: COLORS.line, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white },
  monogram: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.forest, alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontSize: 22, fontWeight: '900', color: COLORS.white },
  brandText: { flex: 1, marginLeft: 10 },
  brandName: { color: COLORS.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  brandTag: { color: COLORS.muted, fontSize: 11 },
  prototypePill: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 7, backgroundColor: COLORS.forestTint },
  prototypeLabel: { color: COLORS.forest, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  content: { flex: 1 },
});
