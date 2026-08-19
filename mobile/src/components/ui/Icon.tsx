import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: object;
};

/** Wrapper thống nhất quanh Ionicons — tự lấy màu text khi không truyền. */
export function Icon({ name, size = 20, color, style }: Props) {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.text} style={style} />;
}