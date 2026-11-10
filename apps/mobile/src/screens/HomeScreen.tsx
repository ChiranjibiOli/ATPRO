import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { COLORS } from '../theme/palette';
import type { RoleId } from '../domain/roles';
import { getRole } from '../domain/roles';

type Props = {
  onExplore: () => void;
  selectedRole: RoleId | null;
};

const steps = [
  { number: '01', title: 'Farmers create requests', body: 'Add product, weight, pickup point, destination market and preferred time.' },
  { number: '02', title: 'Vehicles are matched', body: 'Check load capacity, product handling, availability and delivery constraints.' },
  { number: '03', title: 'Routes are improved', body: 'Plan feasible pickup order with Clarke-Wright and 2-opt, then ask the driver to accept.' },
] as const;

export function HomeScreen({ onExplore, selectedRole }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} accessibilityLabel="ATPRO project home">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>AGRICULTURAL TRANSPORT</Text>
        <Text style={styles.heroTitle}>Better pickup routes for farm produce.</Text>
        <Text style={styles.heroBody}>
          ATPRO is a mobile-first system being developed to help farmers and drivers share usable vehicle capacity and organize delivery to a market.
        </Text>
        <ActionButton onPress={onExplore} label="Explore user roles" />
        {selectedRole !== null ? (
          <Text style={styles.preference}>
            Your saved interest: {getRole(selectedRole).label}. You can change it on the roles screen.
          </Text>
        ) : null}
      </View>
      <Text style={styles.sectionKicker}>HOW IT WILL WORK</Text>
      <Text style={styles.sectionTitle}>From a farm request to a coordinated trip</Text>
      <View style={styles.steps}>
        {steps.map((step) => (
          <View key={step.number} style={styles.step}>
            <Text style={styles.stepNumber}>{step.number}</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.note}>
        <Text style={styles.noteTitle}>What this version does</Text>
        <Text style={styles.noteBody}>
          This first mobile release introduces ATPRO and lets you explore the three user roles. Registration, vehicle booking and live route calculation are not enabled yet.
        </Text>
      </View>
      <Text style={styles.footer}>ATPRO • Academic project prototype</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingBottom: 38 },
  hero: { backgroundColor: COLORS.white, borderRadius: 18, padding: 23, borderWidth: 1, borderColor: COLORS.line, marginTop: 14, marginBottom: 26, gap: 15 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: COLORS.forest, letterSpacing: 1.7 },
  heroTitle: { fontSize: 34, lineHeight: 39, letterSpacing: -1, fontWeight: '800', color: COLORS.ink },
  heroBody: { fontSize: 15, lineHeight: 23, color: COLORS.secondary },
  preference: { fontSize: 13, lineHeight: 19, color: COLORS.secondary },
  sectionKicker: { fontSize: 11, fontWeight: '800', color: COLORS.forest, letterSpacing: 1.7, marginBottom: 8 },
  sectionTitle: { fontSize: 24, lineHeight: 31, fontWeight: '700', color: COLORS.ink, marginBottom: 16 },
  steps: { gap: 10 },
  step: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: 'row', gap: 14 },
  stepNumber: { color: COLORS.forest, fontWeight: '800', fontSize: 17, minWidth: 30 },
  stepContent: { flex: 1, gap: 5 },
  stepTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: COLORS.ink },
  stepBody: { color: COLORS.secondary, fontSize: 14, lineHeight: 21 },
  note: { marginTop: 22, borderRadius: 14, backgroundColor: COLORS.forestTint, padding: 16, gap: 8 },
  noteTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  noteBody: { fontSize: 14, lineHeight: 21, color: COLORS.secondary },
  footer: { marginTop: 28, textAlign: 'center', color: COLORS.muted, fontSize: 12 },
});
