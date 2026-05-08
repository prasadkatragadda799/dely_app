/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

messaging().setBackgroundMessageHandler(async () => {
  // Keep a background handler registered so data/notification messages are handled correctly.
});

AppRegistry.registerComponent(appName, () => App);
