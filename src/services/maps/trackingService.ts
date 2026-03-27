export interface Coordinate {
  latitude: number;
  longitude: number;
}

const baseRoute: Coordinate[] = [
  { latitude: 17.7282, longitude: 83.3013 },
  { latitude: 17.7301, longitude: 83.3042 },
  { latitude: 17.7328, longitude: 83.3071 },
  { latitude: 17.735, longitude: 83.3102 },
];

export const trackingService = {
  getRoute: async () => baseRoute,
  getCurrentPosition: async (step: number) => {
    const index = Math.max(0, Math.min(step, baseRoute.length - 1));
    return baseRoute[index];
  },
};
