import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const DEV_API_ORIGIN = 'https://api.delycart.in';

// Override this from your CI/build env when available.
const runtimeApiOrigin = (globalThis as { API_ORIGIN?: string }).API_ORIGIN;
export const API_ORIGIN = runtimeApiOrigin ?? DEV_API_ORIGIN;
export const API_V1_BASE_URL = `${API_ORIGIN}/api/v1`;
