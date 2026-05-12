import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  persistReducer,
  createTransform,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  persistStore,
} from 'redux-persist';
import authReducer from '../../features/auth/authSlice';
import cartReducer from '../../features/cart/cartSlice';
import homeDivisionReducer from '../../features/customer/homeDivisionSlice';
import businessProfileReducer from '../../features/customer/businessProfileSlice';
import ordersReducer from '../../features/orders/ordersSlice';
import wishlistReducer from '../../features/wishlist/wishlistSlice';
import { productsApi } from '../../features/products/api/productsApi';
import { mobileApi } from '../../services/api/mobileApi';

const rootReducer = combineReducers({
  auth: authReducer,
  cart: cartReducer,
  homeDivision: homeDivisionReducer,
  businessProfile: businessProfileReducer,
  orders: ordersReducer,
  wishlist: wishlistReducer,
  [productsApi.reducerPath]: productsApi.reducer,
  [mobileApi.reducerPath]: mobileApi.reducer,
});

// isSplashVisible is ephemeral UI state — strip it before writing so it always
// resets to `true` (initialState) on the next cold start.
const authTransform = createTransform(
  (state: any) => {
    const { isSplashVisible, ...rest } = state;
    return rest;
  },
  undefined,
  { whitelist: ['auth'] },
);

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: [
    'auth',
    'cart',
    'orders',
    'homeDivision',
    'businessProfile',
    'wishlist',
  ],
  transforms: [authTransform],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      immutableCheck: {
        // RTK Query caches can be large in development; avoid expensive deep scans there.
        ignoredPaths: [productsApi.reducerPath, mobileApi.reducerPath],
        warnAfter: 128,
      },
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(productsApi.middleware, mobileApi.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
