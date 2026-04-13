import { useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { CartLineItem, PriceOptionKey, Product } from '../types';
import { defaultPriceTier } from '../utils/productPricing';
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

  const items = useMemo((): CartLineItem[] => {
    const rawItems: any[] = (data as any)?.data?.items ?? [];
    const isHomeKitchenItem = (it: any) => {
      const p = it?.product ?? {};
      const divisionSlug = String(p.divisionSlug ?? p.division_slug ?? '')
        .trim()
        .toLowerCase();
      const categorySlug = String(p.categorySlug ?? p.category_slug ?? '')
        .trim()
        .toLowerCase();
      const normDiv = divisionSlug.replace(/-/g, '');
      const normCat = categorySlug.replace(/-/g, '');
      const grocerySlugs = new Set(['', 'default', 'grocery', 'fmcg']);
      const categoryImpliesHomeKitchen =
        normCat === 'homecare' ||
        normCat.includes('kitchen') ||
        categorySlug.startsWith('home-');
      const explicitHomeKitchen =
        normDiv === 'kitchen' ||
        normDiv === 'home' ||
        normDiv === 'homekitchen' ||
        normCat === 'kitchen' ||
        normCat === 'home' ||
        normCat === 'homekitchen' ||
        categoryImpliesHomeKitchen;
      const nonGroceryDivision =
        Boolean(divisionSlug) && !grocerySlugs.has(divisionSlug);
      return explicitHomeKitchen || nonGroceryDivision;
    };
    const filteredRaw = rawItems.filter(it =>
      isHomeKitchen ? isHomeKitchenItem(it) : !isHomeKitchenItem(it),
    );

    return filteredRaw.map(it => {
      const p = it.product ?? {};
      const images = Array.isArray(p.images) ? p.images : [];
      const firstImage =
        typeof images[0] === 'string'
          ? images[0]
          : typeof images[0]?.url === 'string'
            ? images[0].url
            : '';

      const tierRaw = String(
        it.price_option_key ??
          it.priceOptionKey ??
          (typeof it.price_option === 'object' && it.price_option
            ? (it.price_option as { key?: string }).key
            : undefined) ??
          'unit',
      )
        .trim()
        .toLowerCase();
      const priceOptionKey: PriceOptionKey =
        tierRaw === 'set' || tierRaw === 'remaining' ? tierRaw : 'unit';

      const categorySlug = String(p.categorySlug ?? p.category_slug ?? '')
        .trim()
        .toLowerCase();
      const divisionSlug = String(p.divisionSlug ?? p.division_slug ?? '')
        .trim()
        .toLowerCase();
      const normDiv = divisionSlug.replace(/-/g, '');
      const normCat = categorySlug.replace(/-/g, '');
      const grocerySlugs = new Set(['', 'default', 'grocery', 'fmcg']);
      const categoryImpliesHomeKitchen =
        normCat === 'homecare' ||
        normCat.includes('kitchen') ||
        categorySlug.startsWith('home-');
      const isHk =
        normCat === 'home' ||
        normDiv === 'home' ||
        normCat === 'kitchen' ||
        normDiv === 'kitchen' ||
        normDiv === 'homekitchen' ||
        normCat === 'homekitchen' ||
        categoryImpliesHomeKitchen ||
        (Boolean(divisionSlug) && !grocerySlugs.has(divisionSlug));
      const productCategory: Product['category'] = isHk
        ? normCat === 'home' ||
            normDiv === 'home' ||
            normCat === 'homecare' ||
            categorySlug.startsWith('home-')
          ? 'home'
          : 'kitchen'
        : 'fmcg';

      const rawVariants = Array.isArray(p.variants) ? p.variants : [];
      const mappedVariants =
        rawVariants.length > 0
          ? rawVariants
              .map((v: any) => ({
                packagingLabel:
                  v.packagingLabel ?? v.packaging_label
                    ? String(v.packagingLabel ?? v.packaging_label).trim()
                    : undefined,
                packagingLabelType:
                  v.packagingLabelType ?? v.packaging_label_type
                    ? String(v.packagingLabelType ?? v.packaging_label_type).trim()
                    : undefined,
                setPieces:
                  v.setPieces ?? v.set_pcs
                    ? String(v.setPieces ?? v.set_pcs).trim()
                    : undefined,
                weight:
                  v.weight != null && String(v.weight).trim()
                    ? String(v.weight).trim()
                    : undefined,
              }))
              .filter(
                (r: any) =>
                  r.packagingLabel ||
                  r.packagingLabelType ||
                  r.setPieces ||
                  r.weight,
              )
          : undefined;

      // Minimal mapping for cart/checkout UI.
      const mappedProduct: Product = {
        id: String(p.id ?? it.product_id),
        name: String(p.name ?? 'Product'),
        image: firstImage,
        category: productCategory,
        brand: typeof p.brand === 'string' ? p.brand : undefined,
        subCategory: undefined,
        price: Number(p.price ?? 0),
        discountPercent: Number(p.discount ?? 0),
        etaMinutes: undefined,
        isVeg: undefined,
        minOrderQuantity: Math.max(
          1,
          Number(p.minOrderQuantity ?? p.min_order_quantity ?? 1) || 1,
        ),
        unit: p.unit != null && String(p.unit).trim() ? String(p.unit) : 'piece',
        piecesPerSet: Math.max(
          1,
          Number(p.piecesPerSet ?? p.pieces_per_set ?? 1) || 1,
        ),
        variantSetPieces:
          typeof p.variantSetPieces === 'string' && p.variantSetPieces.trim()
            ? p.variantSetPieces.trim()
            : undefined,
        variants: mappedVariants && mappedVariants.length > 0 ? mappedVariants : undefined,
      };

      return {
        cartItemId: String(it.id),
        product: mappedProduct,
        quantity: Number(it.quantity ?? 0),
        priceOptionKey,
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
      add: (product: Product, quantity = 1, priceOptionKey?: PriceOptionKey) => {
        const tier = priceOptionKey ?? defaultPriceTier(product);
        const minOrder = Math.max(
          1,
          Math.trunc(Number(product.minOrderQuantity) || 1),
        );
        const requested = Number.isFinite(quantity)
          ? Math.max(1, Math.trunc(quantity))
          : 1;
        const alreadyInCart = items.some(
          i => i.product.id === product.id && i.priceOptionKey === tier,
        );
        const pcs = Math.max(1, product.piecesPerSet ?? 1);
        const minLineQty =
          tier === 'set' && pcs > 1 && minOrder > 1 && minOrder % pcs === 0
            ? Math.max(1, Math.floor(minOrder / pcs))
            : minOrder;
        const safeQuantity = alreadyInCart
          ? requested
          : Math.max(minLineQty, requested);
        addToCartApi({
          product_id: product.id,
          quantity: safeQuantity,
          price_option_key: tier,
          cartDivision: homeDivision,
        })
          .unwrap()
          .catch((e: any) => {
            Toast.show({
              type: 'error',
              text1: 'Could not add to cart',
              text2: e?.data?.message ?? e?.message ?? 'Please try again.',
            });
          });
      },
      remove: (cartItemId: string) => {
        if (!cartItemId) return;
        deleteCartItemApi({ cartItemId })
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
      decrement: (productId: string, priceOptionKey?: PriceOptionKey) => {
        const target = items.find(
          i =>
            i.product.id === productId &&
            (priceOptionKey === undefined ||
              i.priceOptionKey === priceOptionKey),
        );
        if (!target?.cartItemId) return;
        const nextQty = Math.max(0, target.quantity - 1);
        const minOrder = Math.max(
          1,
          Math.trunc(Number(target.product.minOrderQuantity) || 1),
        );
        const pcs = Math.max(1, target.product.piecesPerSet ?? 1);
        const tier = target.priceOptionKey;
        const minLineQty =
          tier === 'set' && pcs > 1 && minOrder > 1 && minOrder % pcs === 0
            ? Math.max(1, Math.floor(minOrder / pcs))
            : minOrder;
        const op =
          nextQty <= 0 || nextQty < minLineQty
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
    [
      addToCartApi,
      clearCartApi,
      deleteCartItemApi,
      homeDivision,
      items,
      total,
      updateCartItemApi,
    ],
  );
};
