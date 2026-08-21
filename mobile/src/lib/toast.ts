import { Platform, ToastAndroid } from 'react-native';

// Toast đơn giản — Android dùng ToastAndroid; iOS fallback (no-op, tránh phụ thuộc lib).
export function showToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}
