import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { color, semantic, space, radius } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_STYLE = {
  primary: { bg: color.cyan[400], text: color.white },
  secondary: { bg: semantic.surfaceElevated, text: color.white },
  danger: { bg: color.red[400], text: color.white },
  ghost: { bg: 'transparent', text: color.cyan[400], border: color.cyan[400] },
};

const SIZE_STYLE = {
  sm: { height: 40, paddingH: space[4], fontSize: 13 },
  md: { height: 50, paddingH: space[6], fontSize: 15 },
  lg: { height: 60, paddingH: space[8], fontSize: 17 },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  onPress,
  style,
}: ButtonProps) {
  const v = VARIANT_STYLE[variant];
  const s = SIZE_STYLE[size];
  const inactive = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (inactive) return;
    Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }).start();
  };

  const pressOut = () => {
    if (inactive) return;
    Animated.spring(scale, { toValue: 1, friction: 8, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.pressable, fullWidth && styles.fullWidth, style]}
    >
      <Animated.View
        style={[
          styles.face,
          {
            height: s.height,
            paddingHorizontal: s.paddingH,
            backgroundColor: v.bg,
            borderRadius: radius.xl,
            opacity: inactive ? 0.5 : 1,
            transform: [{ scale }],
          },
          'border' in v && { borderWidth: 1, borderColor: v.border },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={v.text} />
        ) : (
          <View style={styles.content}>
            {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
            <Text style={[styles.label, { fontSize: s.fontSize, color: v.text }]}>
              {label.toUpperCase()}
            </Text>
            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  face: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: { fontWeight: '800', letterSpacing: 0.8 },
  iconLeft: {},
  iconRight: {},
});

export default Button;
