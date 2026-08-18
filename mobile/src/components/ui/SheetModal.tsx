import React from 'react';
import { Modal, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  heightPct?: number; // 0..1
};

/**
 * Bottom sheet modal — trượt lên từ đáy, chiều cao % màn hình.
 */
export function SheetModal({ visible, onClose, children, heightPct = 0.6 }: Props) {
  const t = useTheme();
  const sheetStyle: ViewStyle = {
    ...styles.sheet,
    backgroundColor: t.surface,
    height: `${Math.round(heightPct * 100)}%`,
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose}>
        <View style={sheetStyle}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            {children}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,120,120,0.4)',
    alignSelf: 'center',
    marginBottom: 12,
  },
});
