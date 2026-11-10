import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ROLE_DEFINITIONS, getRole, type RoleId } from '../domain/roles';
import { ActionButton } from '../components/ActionButton';
import { COLORS } from '../theme/palette';

type Props = {
  selectedRole: RoleId | null;
  isLoading: boolean;
  storageWarning: string | null;
  onSelect: (role: RoleId) => void;
  onClear: () => void;
  onBack: () => void;
};

export function RolesScreen({ selectedRole, isLoading, storageWarning, onSelect, onClear, onBack }: Props) {
  const active = selectedRole ? getRole(selectedRole) : null;
  return (
    <ScrollView contentContainerStyle={styles.scroll} accessibilityLabel="Explore ATPRO roles">
      <Pressable accessibilityRole="button" accessibilityLabel="Return to home" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>←  Back to home</Text>
      </Pressable>
      <Text style={styles.kicker}>THREE ROLES. ONE SYSTEM.</Text>
      <Text style={styles.title}>Explore your part in ATPRO.</Text>
      <Text style={styles.description}>Choose a role to understand the planned screens and actions. This does not create an account or give access to any records.</Text>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.forest} />
          <Text style={styles.muted}>Restoring your selection...</Text>
        </View>
      ) : (
        <>
          <View style={styles.cards}>
            {ROLE_DEFINITIONS.map((role) => {
              const selected = role.id === selectedRole;
              return (
                <Pressable
                  key={role.id}
                  accessibilityRole="radio"
                  accessibilityLabel={'Explore ' + role.label + ' role'}
                  accessibilityState={{ checked: selected }}
                  onPress={() => onSelect(role.id)}
                  style={({ pressed }) => [styles.card, selected ? styles.cardSelected : null, pressed ? styles.pressed : null]}
                >
                  <View style={styles.cardText}>
                    <Text style={styles.roleName}>{role.label}</Text>
                    <Text style={styles.roleSummary}>{role.summary}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {active ? (
            <View style={styles.details}>
              <Text style={styles.detailsKicker}>ROLE RESPONSIBILITIES</Text>
              <Text style={styles.detailsTitle}>{active.headline}</Text>
              {active.responsibilities.map((item, index) => (
                <View style={styles.point} key={item}>
                  <Text style={styles.pointIndex}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.pointText}>{item}</Text>
                </View>
              ))}
              <ActionButton label="Clear role preference" variant="secondary" onPress={onClear} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No role selected</Text>
              <Text style={styles.muted}>Tap Farmer, Driver or Admin above to explore its responsibilities.</Text>
            </View>
          )}
          {storageWarning ? (
            <View accessibilityRole="alert" style={styles.warningBox}>
              <Text style={styles.warningText}>{storageWarning}</Text>
            </View>
          ) : null}
        </>
      )}
      <Text style={styles.footnote}>Your role preference is stored only on this device. Future account permissions will be checked by the server after login.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingBottom: 38 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 6, marginBottom: 16 },
  backText: { color: COLORS.forest, fontSize: 15, fontWeight: '700' },
  kicker: { fontSize: 11, letterSpacing: 1.7, fontWeight: '800', color: COLORS.forest, marginBottom: 8 },
  title: { fontSize: 31, lineHeight: 37, letterSpacing: -0.8, fontWeight: '800', color: COLORS.ink },
  description: { fontSize: 15, lineHeight: 23, color: COLORS.secondary, marginTop: 12, marginBottom: 20 },
  loading: { flexDirection: 'row', padding: 24, gap: 12, alignItems: 'center' },
  muted: { color: COLORS.secondary, fontSize: 14, lineHeight: 21 },
  cards: { gap: 11 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, minHeight: 92 },
  cardSelected: { borderColor: COLORS.forest, borderWidth: 2, backgroundColor: COLORS.forestTint },
  pressed: { opacity: 0.85 },
  cardText: { flex: 1, gap: 5 },
  roleName: { color: COLORS.ink, fontSize: 18, fontWeight: '700' },
  roleSummary: { color: COLORS.secondary, fontSize: 13, lineHeight: 20 },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: COLORS.forest },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.forest },
  details: { padding: 18, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, marginTop: 19, backgroundColor: COLORS.white, gap: 14 },
  detailsKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: COLORS.forest },
  detailsTitle: { color: COLORS.ink, fontSize: 23, lineHeight: 29, fontWeight: '700' },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pointIndex: { fontSize: 12, fontWeight: '800', color: COLORS.forest, paddingTop: 2 },
  pointText: { color: COLORS.secondary, flex: 1, lineHeight: 21, fontSize: 14 },
  emptyState: { backgroundColor: COLORS.forestTint, padding: 17, borderRadius: 14, marginTop: 19, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  warningBox: { padding: 14, marginTop: 14, backgroundColor: COLORS.warningTint, borderRadius: 10 },
  warningText: { color: COLORS.warningInk, fontSize: 13, lineHeight: 19 },
  footnote: { color: COLORS.muted, marginTop: 24, fontSize: 12, lineHeight: 19 },
});
