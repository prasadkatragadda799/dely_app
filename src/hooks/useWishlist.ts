import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from './redux';
import { toggleWishlistItem } from '../features/wishlist/wishlistSlice';

export const useWishlist = () => {
  const dispatch = useAppDispatch();
  const productIds = useAppSelector(state => state.wishlist.productIds);

  const wishlistSet = useMemo(() => new Set(productIds), [productIds]);

  return {
    productIds,
    isWishlisted: (productId: string) => wishlistSet.has(productId),
    toggle: (productId: string) => dispatch(toggleWishlistItem(productId)),
  };
};
