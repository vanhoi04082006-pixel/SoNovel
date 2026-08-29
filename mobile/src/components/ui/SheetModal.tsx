import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme, RADIUS } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  heightPct?: number; // 0..1
};

/**
 * Bottom sheet modal — spring trượt lên, drag handle, rounded top, safe-area bottom.
 */
export function SheetModal({ visible, onClose, children, heightPct = 0.6 }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    // FIX: dùng timing ease-out thay vì spring — spring damping thấp làm sheet
    // "nhảy tưng tưng" (overshoot) khi mở.
    progress.value = withTiming(visible ? 1 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 420 }],
  }));

  const sheetStyle: ViewStyle = {
    ...styles.sheet,
    backgroundColor: t.surface,
    height: `${Math.round(heightPct * 100)}%`,
    paddingBottom: Math.max(insets.bottom, 16),
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose}>
        <Animated.View style={[sheetStyle, animatedStyle]}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.content}>
            <View style={[styles.handle, { backgroundColor: t.border }]} />
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  content: { flex: 1 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
});