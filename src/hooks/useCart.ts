import { useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { Product } from '../types';
import {
  useAddToCartApiMutation,
  useClearCartApiMutation,
  useDeleteCartItemApiMutation,
  useGetCartQuery,
  useUpdateCartItemApiMutation,
} from '../services/api/mobileApi';
import { useAppSelector } from './redux';

export const useCart = () => {
  const homeDivision = useAppSelector(state => state.homeDivision.division);
  const isHomeKitchen = homeDivision === 'homeKitchen';

  const { data } = useGetCartQuery(homeDivision);
  const [addToCartApi] = useAddToCartApiMutation();
  const [updateCartItemApi] = useUpdateCartItemApiMutation();
  const [deleteCartItemApi] = useDeleteCartItemApiMutation();
  const [clearCartApi] = useClearCartApiMutation();

  const items = useMemo(() => {
    const rawItems: any[] = (data as any)?.data?.items ?? [];
    // Optional: pass division_slug to getCart to show only one division's lines in a tab.
    return rawItems.map(it => {
      const p = it.product ?? {};
      const images = Array.isArray(p.images) ? p.images : [];
      const firstImage =
        typeof images[0] === 'string'
          ? images[0]
          : typeof images[0]?.url === 'string'
            ? images[0].url
            : '';

      // Minimal mapping for cart/checkout UI.
      const mappedProduct: Product = {
        id: String(p.id ?? it.product_id),
        name: String(p.name ?? 'Product'),
        image: firstImage,
        category: isHomeKitchen ? 'kitchen' : 'fmcg',
        brand: typeof p.brand === 'string' ? p.brand : undefined,
        subCategory: undefined,
        price: Number(p.price ?? 0),
        discountPercent: Number(p.discount ?? 0),
        // Backend cart payload doesn't provide these fields consistently.
        etaMinutes: undefined,
        isVeg: undefined,
      };

      return {
        cartItemId: String(it.id),
        product: mappedProduct,
        quantity: Number(it.quantity ?? 0),
      };
    });
  }, [data, isHomeKitchen]);

  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  return useMemo(
    () => ({
      items,
      total,
      add: (product: Product, quantity = 1) => {
        const minOrder = Math.max(
          1,
          Math.trunc(Number(product.minOrderQuantity) || 1),
        );
        const requested = Number.isFinite(quantity)
          ? Math.max(1, Math.trunc(quantity))
          : 1;
        const alreadyInCart = items.some(i => i.product.id === product.id);
        const safeQuantity = alreadyInCart
          ? requested
          : Math.max(minOrder, requested);
        addToCartApi({ product_id: product.id, quantity: safeQuantity })
          .unwrap()
          .catch((e: any) => {
            Toast.show({
              type: 'error',
              text1: 'Could not add to cart',
              text2: e?.data?.message ?? e?.message ?? 'Please try again.',
            });
          });
      },
      remove: (productId: string) => {
        const target = items.find(i => i.product.id === productId);
        if (!target?.cartItemId) return;
        deleteCartItemApi({ cartItemId: target.cartItemId })
          .unwrap()
          .catch((e: any) => {
            Toast.show({
              type: 'error',
              text1: 'Could not remove item',
              text2: e?.data?.message ?? e?.message ?? 'Please try again.',
            });
          });
      },
      clear: () => {
        clearCartApi()
          .unwrap()
          .catch((e: any) => {
            Toast.show({
              type: 'error',
              text1: 'Could not clear cart',
              text2: e?.data?.message ?? e?.message ?? 'Please try again.',
            });
          });
      },
      removeMany: (productIds: string[]) => {
        // Backend clears entire cart after successful order creation anyway.
        // Keep this helper for callers, but implement it as "clear".
        if (!productIds.length) return;
        clearCartApi()
          .unwrap()
          .catch(() => {
            // Silent; checkout already handles errors.
          });
      },
      decrement: (productId: string) => {
        const target = items.find(i => i.product.id === productId);
        if (!target?.cartItemId) return;
        const nextQty = Math.max(0, target.quantity - 1);
        const op =
          nextQty <= 0
            ? deleteCartItemApi({ cartItemId: target.cartItemId })
            : updateCartItemApi({ cartItemId: target.cartItemId, quantity: nextQty });
        op.unwrap().catch((e: any) => {
          Toast.show({
            type: 'error',
            text1: 'Could not update cart',
            text2: e?.data?.message ?? e?.message ?? 'Please try again.',
          });
        });
      },
    }),
    [addToCartApi, clearCartApi, deleteCartItemApi, items, total, updateCartItemApi],
  );
};
