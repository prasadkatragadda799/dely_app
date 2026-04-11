import { Platform } from 'react-native';
import { API_ORIGIN as API_ORIGIN_FROM_ENV } from '@env';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const DEV_API_ORIGIN = `http://${DEV_HOST}:8000`;

const fromEnvFile = String(API_ORIGIN_FROM_ENV ?? '').trim();

export const API_ORIGIN =
  fromEnvFile || (__DEV__ ? DEV_API_ORIGIN : 'https://api.delycart.in');
export const API_V1_BASE_URL = `${API_ORIGIN}/api/v1`;
