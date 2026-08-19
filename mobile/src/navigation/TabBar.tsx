import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme, SPACING, RADIUS } from '../theme';
import { Icon, IconName } from '../components/ui/Icon';
import { FloatingMiniPlayer } from '../components/player/FloatingMiniPlayer';

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
  Favorites: { active: 'heart', inactive: 'heart-outline' },
  History: { active: 'time', inactive: 'time-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

/**
 * Tab bar custom — icon vector + active pill indicator animated,
 * mini player nằm phía trên tab bar trong cùng layout.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: t.bg }}>
      <FloatingMiniPlayer />
      <View style={[styles.bar, { backgroundColor: t.surface, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
          const focused = state.index === index;
          const icons = TAB_ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.item}
            >
              <TabItemIcon
                name={focused ? icons.active : icons.inactive}
                color={focused ? t.primary : t.textMuted}
                label={label}
                focused={focused}
                primary={t.primary}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabItemIcon({ name, color, label, focused, primary }: { name: IconName; color: string; label: string; focused: boolean; primary: string }) {
  const scale = useSharedValue(focused ? 1 : 0.85);
  const pillWidth = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    scale.value = withTiming(focused ? 1 : 0.85, { duration: 180 });
    pillWidth.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, scale, pillWidth]);

  const iconAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pillAnim = useAnimatedStyle(() => ({
    width: 28 * pillWidth.value,
    opacity: pillWidth.value,
  }));

  return (
    <View style={styles.itemInner}>
      <Animated.View style={[styles.pill, { backgroundColor: primary }, pillAnim]} />
      <Animated.View style={[styles.iconWrap, iconAnim]}>
        <Icon name={name} size={22} color={color} />
      </Animated.View>
      <Text style={[styles.label, { color: color }, focused && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  item: { flex: 1 },
  itemInner: { alignItems: 'center', gap: 1, position: 'relative' },
  pill: {
    position: 'absolute',
    top: -4,
    height: 3,
    borderRadius: 2,
  },
  iconWrap: {
    width: 40,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  labelActive: { fontWeight: '700' },
});