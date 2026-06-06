import { API_ORIGIN as API_ORIGIN_FROM_ENV } from '@env';

const fromEnvFile = String(API_ORIGIN_FROM_ENV ?? '').trim();

export const API_ORIGIN = fromEnvFile || 'https://api.delycart.in';
export const API_V1_BASE_URL = `${API_ORIGIN}/api/v1`;
