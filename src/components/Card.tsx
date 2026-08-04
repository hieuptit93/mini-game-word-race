import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { semantic, space, radius } from '../tokens';

export type CardVariant = 'default' | 'elevated';
export type CardPadding = 'default' | 'none';

export interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const PADDING_MAP = { default: space[4], none: 0 };

export function Card({
  variant = 'default',
  padding: paddingProp = 'default',
  onPress,
  disabled = false,
  children,
  style,
}: CardProps) {
  const cardPadding = PADDING_MAP[paddingProp];
  const interactive = !!onPress && !disabled;
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (!interactive) return;
    Animated.timing(scale, { toValue: 0.98, duration: 100, useNativeDriver: true }).start();
  };

  const pressOut = () => {
    if (!interactive) return;
    Animated.spring(scale, { toValue: 1, friction: 8, tension: 200, useNativeDriver: true }).start();
  };

  const cardContent = (
    <Animated.View
      style={[
        styles.face,
        {
          backgroundColor: variant === 'elevated' ? semantic.surfaceElevated : semantic.surface,
          borderRadius: radius.lg,
          padding: cardPadding,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  face: { overflow: 'hidden' },
});

export default Card;
