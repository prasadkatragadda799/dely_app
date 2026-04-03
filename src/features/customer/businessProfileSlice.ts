import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface BusinessProfile {
  businessName: string;
  gstNumber: string;
  fmcgNumber: string;
  /** Local file URI or uploaded URL for GST certificate document */
  gstCertificate?: string;
  /** Local file URI or uploaded URL for FSSAI license document */
  fssaiLicense?: string;
  /** Local file URI or uploaded URL for Udyam registration certificate */
  udyamRegistration?: string;
  /** Local file URI or uploaded URL for trade certificate */
  tradeCertificate?: string;
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

