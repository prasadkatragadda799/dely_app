import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type WishlistState = {
  productIds: string[];
};

const initialState: WishlistState = {
  productIds: [],
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    toggleWishlistItem: (state, action: PayloadAction<string>) => {
      const productId = action.payload;
      const exists = state.productIds.includes(productId);
      state.productIds = exists
        ? state.productIds.filter(id => id !== productId)
        : [...state.productIds, productId];
    },
  },
});

export const { toggleWishlistItem } = wishlistSlice.actions;
export default wishlistSlice.reducer;
