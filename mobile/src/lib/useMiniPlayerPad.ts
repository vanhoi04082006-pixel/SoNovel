import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Padding bottom cho các màn hình (trước đây để né mini player float).
 * Giờ mini player nằm trong layout tab bar nên không che content — chỉ cần
 * padding nhỏ cho đẹp, không cần né tránh nữa.
 */
export function useMiniPlayerPad(_enabled: boolean = true): number {
  const insets = useSafeAreaInsets();
  const [pad, setPad] = useState(16);
  useEffect(() => {
    setPad(16 + (insets.bottom || 0));
  }, [insets.bottom]);
  return pad;
}
