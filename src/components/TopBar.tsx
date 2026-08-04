import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { semantic, space, typography } from '../tokens';

export type LeftPreset = 'back' | 'close';

export interface TopBarProps {
  left?: LeftPreset | React.ReactNode;
  onLeftPress?: () => void;
  title?: string;
  center?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const SIDE_SLOT = 40;
const BAR_HEIGHT = 56;

function PressableSlot({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress?: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 8, tension: 200, useNativeDriver: true }).start()}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={styles.sideSlot}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

export function TopBar({ left, onLeftPress, title, center, right, style }: TopBarProps) {
  const leftNode = (() => {
    if (!left) return <View style={styles.sideSlot} />;
    if (left === 'back') {
      return (
        <PressableSlot onPress={onLeftPress} accessibilityLabel="Back">
          <Text style={styles.backIcon}>←</Text>
        </PressableSlot>
      );
    }
    if (left === 'close') {
      return (
        <PressableSlot onPress={onLeftPress} accessibilityLabel="Close">
          <Text style={styles.closeIcon}>✕</Text>
        </PressableSlot>
      );
    }
    return <View style={styles.sideSlot}>{left}</View>;
  })();

  const centerNode = (() => {
    if (center) return <View style={styles.center}>{center}</View>;
    if (title) {
      return (
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
      );
    }
    return <View style={styles.center} />;
  })();

  const rightNode = right ? <View style={styles.rightSlot}>{right}</View> : <View style={styles.sideSlot} />;

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, style]}>
      <View style={styles.row}>
        {leftNode}
        {centerNode}
        {rightNode}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: semantic.bg },
  row: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3] },
  sideSlot: { width: SIDE_SLOT, height: SIDE_SLOT, alignItems: 'center', justifyContent: 'center' },
  rightSlot: { minWidth: SIDE_SLOT, height: SIDE_SLOT, alignItems: 'center', justifyContent: 'flex-end', flexDirection: 'row' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2] },
  title: { color: semantic.text, fontSize: typography.title2.size, fontWeight: typography.title2.fontWeight, textAlign: 'center' },
  backIcon: { color: semantic.textSecondary, fontSize: 20 },
  closeIcon: { color: semantic.textSecondary, fontSize: 16 },
});

export default TopBar;
