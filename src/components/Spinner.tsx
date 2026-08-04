import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { color } from '../tokens';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZE_STYLE = {
  sm: { diameter: 16, stroke: 2 },
  md: { diameter: 24, stroke: 3 },
  lg: { diameter: 40, stroke: 4 },
  xl: { diameter: 80, stroke: 5 },
};

export function Spinner({ size = 'md', color: spinnerColor = color.cyan[400], style }: SpinnerProps) {
  const s = SIZE_STYLE[size];
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    return () => rotation.stopAnimation();
  }, [rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[{ width: s.diameter, height: s.diameter, transform: [{ rotate: spin }] }, style]}
      accessibilityLabel="Loading"
    >
      <View
        style={[
          styles.circle,
          { width: s.diameter, height: s.diameter, borderRadius: s.diameter / 2, borderWidth: s.stroke, borderColor: 'rgba(255,255,255,0.1)' },
        ]}
      />
      <View
        style={[
          styles.arc,
          {
            width: s.diameter,
            height: s.diameter,
            borderRadius: s.diameter / 2,
            borderWidth: s.stroke,
            borderTopColor: spinnerColor,
            borderRightColor: spinnerColor,
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
  arc: { position: 'absolute' },
});

export default Spinner;
