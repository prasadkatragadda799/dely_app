import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, UserRole } from '../../types';

interface AuthState {
  user: User | null;
  isSplashVisible: boolean;
}

const initialState: AuthState = {
  user: null,
  isSplashVisible: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    hideSplash: state => {
      state.isSplashVisible = false;
    },
    loginSuccess: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    registerSuccess: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    switchRole: (state, action: PayloadAction<UserRole>) => {
      if (state.user) {
        state.user.role = action.payload;
      }
    },
    logout: state => {
      state.user = null;
    },
  },
});

export const { hideSplash, loginSuccess, registerSuccess, switchRole, logout } =
  authSlice.actions;
export default authSlice.reducer;
