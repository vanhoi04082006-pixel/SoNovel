/**
 * Entry point — AppRegistry.registerComponent cho 'main'.
 * Theo §8: mobile dùng custom native module (sonovel-tts) → phải build dev client,
 * không chạy được trong Expo Go. File này tuân thủ pattern AppRegistry chuẩn.
 */
import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('main', () => App);
