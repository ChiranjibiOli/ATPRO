import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { COLORS } from '../theme/palette';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function ActionButton({ label, onPress, disabled = false, variant = 'primary' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !disabled ? styles.pressed : undefined,
        disabled ? styles.disabled : undefined,
      ]}
    >
      <Text style={variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  primary: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  secondary: { backgroundColor: COLORS.white, borderColor: COLORS.line },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  primaryLabel: { fontWeight: '700', fontSize: 16, color: COLORS.white, textAlign: 'center' },
  secondaryLabel: { fontWeight: '700', fontSize: 16, color: COLORS.forest, textAlign: 'center' },
});
