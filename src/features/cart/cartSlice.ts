import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CartItem, Product } from '../../types';

interface CartState {
  items: CartItem[];
}

const initialState: CartState = {
  items: [],
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<Product>) => {
      const existing = state.items.find(
        item => item.product.id === action.payload.id,
      );
      if (existing) {
        existing.quantity += 1;
      } else {
        state.items.push({ product: action.payload, quantity: 1 });
      }
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.product.id !== action.payload);
    },
    // Decrement quantity by 1. If quantity reaches 0, remove the item.
    decrementByOne: (state, action: PayloadAction<string>) => {
      const existing = state.items.find(item => item.product.id === action.payload);
      if (!existing) return;
      existing.quantity -= 1;
      if (existing.quantity <= 0) {
        state.items = state.items.filter(item => item.product.id !== action.payload);
      }
    },
    clearCart: state => {
      state.items = [];
    },
    removeCartMany: (state, action: PayloadAction<string[]>) => {
      const ids = new Set(action.payload);
      state.items = state.items.filter(item => !ids.has(item.product.id));
    },
  },
});

export const { addToCart, removeFromCart, clearCart, removeCartMany, decrementByOne } =
  cartSlice.actions;
export default cartSlice.reducer;
