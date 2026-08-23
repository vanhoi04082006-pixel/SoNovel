import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

/**
 * Ref toàn cục của NavigationContainer — cho phép các overlay render NGOÀI
 * navigator (VD: FloatingMiniPlayer) điều hướng mà không cần useNavigation
 * (hook này chỉ dùng được bên trong màn hình của navigator).
 */
export const rootNavRef = createNavigationContainerRef<RootStackParamList>();

/** Điều hướng an toàn — im lặng nếu container chưa sẵn sàng. */
export function safeNavigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  try {
    if (rootNavRef.isReady()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rootNavRef.navigate(name as any, params as any);
    }
  } catch (_e) {}
}
