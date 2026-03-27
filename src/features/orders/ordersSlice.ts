import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Order, OrderStatus } from '../../types';

interface OrdersState {
  orders: Order[];
}

const initialState: OrdersState = {
  orders: [],
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    addOrder: (state, action: PayloadAction<Order>) => {
      state.orders.unshift(action.payload);
    },
    updateOrderStatus: (
      state,
      action: PayloadAction<{ orderId: string; status: OrderStatus }>,
    ) => {
      const target = state.orders.find(order => order.id === action.payload.orderId);
      if (target) {
        target.status = action.payload.status;
      }
    },
    assignIncomingOrder: (state, action: PayloadAction<Order>) => {
      state.orders.unshift(action.payload);
    },
  },
});

export const { addOrder, updateOrderStatus, assignIncomingOrder } =
  ordersSlice.actions;
export default ordersSlice.reducer;
