import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ApiError, farmerOverview, type FarmerOverview } from '../auth/client';
import { COLORS } from '../theme/palette';

type Props = {
  token: string;
  onLogout: () => void;
  onSessionExpired: () => void;
  busy: boolean;
  authError: string | null;
};
export function FarmerDashboardScreen({ token, onLogout, onSessionExpired, busy, authError }: Props) {
  const [overview, setOverview] = useState<FarmerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (active: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await farmerOverview(token);
      if (active()) setOverview(result);
    } catch (e) {
      if (!active()) return;
      if (e instanceof ApiError && e.status === 401) {
        await onSessionExpired();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Cannot reach the API. Check your network and retry.');
    } finally { if (active()) setLoading(false); }
  }, [token, onSessionExpired]);
  useEffect(() => {
    let mounted = true;
    void load(() => mounted);
    return () => { mounted = false; };
  }, [load]);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.kicker}>FARMER DASHBOARD</Text>
      <Text style={styles.title}>{overview ? 'Welcome, ' + overview.user.name : 'Your transport overview'}</Text>
      <Text style={styles.description}>Only your own transportation activity is shown here.</Text>
      {loading ? <View style={styles.center}><ActivityIndicator color={COLORS.forest}/><Text>Loading your transport information...</Text></View> : null}
      {error ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.error}>{error}</Text><ActionButton label="Retry loading dashboard" onPress={() => void load(() => true)}/></View> : null}
      {!loading && !error && overview ? (
        <View style={styles.panel}>
          <Text style={styles.section}>Your transport activity</Text>
          <Text style={styles.stat}>Requests submitted: {overview.summary.totalRequests}</Text>
          <Text style={styles.stat}>Requests pending: {overview.summary.pendingRequests}</Text>
          <Text style={styles.stat}>Active trips: {overview.summary.activeTrips}</Text>
          {overview.summary.totalRequests === 0 ?
            <Text style={styles.empty}>You have not created any transport requests yet. Request creation is planned for the next development stage.</Text> : null}
        </View>
      ) : null}
      {authError ? <Text accessibilityRole="alert" style={styles.error}>{authError}</Text> : null}
      <ActionButton label="Log out" variant="secondary" disabled={busy} onPress={onLogout}/>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { padding: 22, paddingBottom: 44, gap: 16 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: COLORS.forest },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '800', color: COLORS.ink },
  description: { fontSize: 15, lineHeight: 22, color: COLORS.secondary },
  center: { padding: 22, gap: 12, alignItems: 'center' },
  panel: { borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, padding: 18, gap: 13, backgroundColor: COLORS.white },
  section: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  stat: { fontSize: 15, color: COLORS.secondary },
  empty: { padding: 15, backgroundColor: COLORS.forestTint, color: COLORS.ink, fontSize: 14, lineHeight: 21, borderRadius: 10 },
  alert: { padding: 15, backgroundColor: COLORS.white, borderRadius: 12, gap: 10 },
  error: { color: '#A12727', fontSize: 14 },
});
