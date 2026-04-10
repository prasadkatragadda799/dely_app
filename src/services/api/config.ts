import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const DEV_API_ORIGIN = `http://${DEV_HOST}:8000`;

type RuntimeLike = {
  API_ORIGIN?: string;
  process?: { env?: Record<string, string | undefined> };
};

const runtime = globalThis as unknown as RuntimeLike;
const envApiOrigin = runtime.process?.env?.API_ORIGIN;
const runtimeApiOrigin = runtime.API_ORIGIN;
const configuredApiOrigin = (runtimeApiOrigin ?? envApiOrigin ?? '').trim();

export const API_ORIGIN =
  configuredApiOrigin || (__DEV__ ? DEV_API_ORIGIN : 'https://api.delycart.in');
export const API_V1_BASE_URL = `${API_ORIGIN}/api/v1`;
