import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControlProps } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

type Props = {
  children: React.ReactNode;
  edges?: Edge[];
  scroll?: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
  contentContainerStyle?: object;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

/** Khung màn hình chuẩn — SafeArea + nền theme, có hoặc không scroll. */
export function Screen({ children, edges = ['top'], scroll, scrollRef, contentContainerStyle, refreshControl }: Props) {
  const t = useTheme();
  if (scroll) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={edges}>
        <ScrollView
          ref={scrollRef as React.RefObject<ScrollView>}
          style={{ flex: 1 }}
          contentContainerStyle={[{ paddingBottom: 24 }, contentContainerStyle]}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={edges}>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});