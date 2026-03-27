import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type HomeDivision = 'fmcg' | 'homeKitchen';

interface HomeDivisionState {
  division: HomeDivision;
}

const initialState: HomeDivisionState = {
  division: 'fmcg',
};

const homeDivisionSlice = createSlice({
  name: 'homeDivision',
  initialState,
  reducers: {
    setHomeDivision: (state, action: PayloadAction<HomeDivision>) => {
      state.division = action.payload;
    },
  },
});

export const { setHomeDivision } = homeDivisionSlice.actions;
export default homeDivisionSlice.reducer;

