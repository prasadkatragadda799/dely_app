import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface BusinessProfile {
  businessName: string;
  gstNumber: string;
  fmcgNumber: string;
  shopImageUri?: string;
  userIdUri?: string;
}

interface BusinessProfileState {
  profile: BusinessProfile | null;
}

const initialState: BusinessProfileState = {
  profile: null,
};

const businessProfileSlice = createSlice({
  name: 'businessProfile',
  initialState,
  reducers: {
    setBusinessProfile: (state, action: PayloadAction<BusinessProfile>) => {
      state.profile = action.payload;
    },
    clearBusinessProfile: state => {
      state.profile = null;
    },
  },
});

export const { setBusinessProfile, clearBusinessProfile } =
  businessProfileSlice.actions;
export default businessProfileSlice.reducer;

