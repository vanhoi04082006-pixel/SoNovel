import { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';

/**
 * Hook đo chiều cao tab bar + mini player để các màn hình thêm bottom padding
 * tránh bị che. Vì tab bar + mini player là constant trong app, dùng giá trị ước lượng
 * an toàn: tab bar ~64dp + mini player ~64dp + safe area inset.
 */
export function useMiniPlayerPad(enabled: boolean = true): number {
  const [pad, setPad] = useState(64);
  useEffect(() => {
    if (!enabled) {
      setPad(0);
      return;
    }
    const calc = () => {
      // tab bar ~64, mini player ~64, an toàn 132
      const base = Platform.OS === 'android' ? 56 : 64;
      const mini = 64;
      setPad(base + mini + 16);
    };
    calc();
    const sub = Dimensions.addEventListener('change', calc);
    return () => sub.remove();
  }, [enabled]);
  return pad;
}
