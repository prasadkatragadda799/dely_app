import { useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { CartLineItem, PriceOptionKey, Product } from '../types';
import { defaultPriceTier, productImpliesSetPurchase } from '../utils/productPricing';
import {
  useAddToCartApiMutation,
  useClearCartApiMutation,
  useDeleteCartItemApiMutation,
  useGetCartQuery,
  useUpdateCartItemApiMutation,
} from '../services/api/mobileApi';
import { useAppSelector } from './redux';

export const useCart = () => {
  const homeDivision = useAppSelector(state => state.homeDivision!.division);
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
      const categoryImpliesHomeKitchen =
        normCat === 'homecare' ||
        normCat.includes('kitchen') ||
        categorySlug.startsWith('home-');
      return (
        normDiv === 'kitchen' ||
        normDiv === 'home' ||
        normDiv === 'homekitchen' ||
        normCat === 'kitchen' ||
        normCat === 'home' ||
        normCat === 'homekitchen' ||
        categoryImpliesHomeKitchen
      );
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
        categoryImpliesHomeKitchen;
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

      const variantId =
        it.variant_id ?? it.variantId ?? p.variantId ?? undefined;
      const variantLabel =
        typeof p.variantLabel === 'string' && p.variantLabel.trim()
          ? p.variantLabel.trim()
          : undefined;

      return {
        cartItemId: String(it.id),
        product: mappedProduct,
        quantity: Number(it.quantity ?? 0),
        priceOptionKey,
        variantId: variantId ? String(variantId) : undefined,
        variantLabel,
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
      add: (
        product: Product,
        quantity = 1,
        priceOptionKey?: PriceOptionKey,
        variantId?: string,
      ): Promise<void> => {
        const tier = priceOptionKey ?? defaultPriceTier(product);
        const minOrder = Math.max(
          1,
          Math.trunc(Number(product.minOrderQuantity) || 1),
        );
        const requested = Number.isFinite(quantity)
          ? Math.max(1, Math.trunc(quantity))
          : 1;
        const alreadyInCart = items.some(
          i =>
            i.product.id === product.id &&
            i.priceOptionKey === tier &&
            (variantId ? i.variantId === variantId : !i.variantId),
        );
        // A variant is an individual SKU → minimum of 1 per line.
        // 'set' / 'remaining' tiers: count in sets/lots, so minimum is always 1.
        // Natural-set products (unit ≠ 'piece', piecesPerSet > 1): the sale unit
        //   is already a set. minOrderQuantity is ambiguous (pieces vs sets) so
        //   always start with 1 set — the stepper handles subsequent increments.
        // All other tiers: minOrder and qty share the same unit; use minOrder directly.
        const pcsPerSet = Math.max(1, product.piecesPerSet ?? 1);
        const isNaturalSet =
          pcsPerSet > 1 &&
          (product.unit || 'piece').toLowerCase() !== 'piece';
        const minLineQty = variantId
          ? 1
          : tier === 'set' || tier === 'remaining' || isNaturalSet
            ? 1
            : minOrder;
        const safeQuantity = alreadyInCart
          ? requested
          : Math.max(minLineQty, requested);
        return addToCartApi({
          product_id: product.id,
          quantity: safeQuantity,
          price_option_key: tier,
          variant_id: variantId,
          cartDivision: homeDivision,
        })
          .unwrap()
          .then(() => {})
          .catch((e: any) => {
            Toast.show({
              type: 'error',
              text1: 'Could not add to cart',
              text2: e?.data?.detail ?? e?.data?.message ?? e?.message ?? 'Please try again.',
            });
            throw e;
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
      clear: (): Promise<void> => {
        return clearCartApi()
          .unwrap()
          .then(() => {})
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
      increment: (
        productId: string,
        priceOptionKey?: PriceOptionKey,
        variantId?: string,
      ): Promise<void> => {
        const target = items.find(i =>
          variantId
            ? i.product.id === productId && i.variantId === variantId
            : i.product.id === productId &&
              (priceOptionKey === undefined || i.priceOptionKey === priceOptionKey),
        );
        if (!target?.cartItemId) return Promise.resolve();
        const stock = target.product.stockQuantity;
        const maxQty = stock !== undefined && stock > 0 ? stock : 99;
        const tPcs = Math.max(1, target.product.piecesPerSet ?? 1);
        const tMinO = Math.max(1, Math.trunc(Number(target.product.minOrderQuantity) || 1));
        const tIsNaturalSet =
          tPcs > 1 && (target.product.unit || 'piece').toLowerCase() !== 'piece';
        // Variant lines, 'set'/'remaining' tiers, and natural-set products all step by 1.
        // Implied-set 'unit' tier (unit='piece', pcs>1): step by piecesPerSet (pieces).
        const step = variantId
          ? 1
          : target.priceOptionKey === 'set' || target.priceOptionKey === 'remaining' || tIsNaturalSet
            ? 1
            : tPcs > 1
              ? tPcs
              : tMinO > 1 && productImpliesSetPurchase(target.product)
                ? tMinO
                : 1;
        const nextQty = Math.min(target.quantity + step, maxQty);
        if (nextQty === target.quantity) return Promise.resolve();
        return updateCartItemApi({ cartItemId: target.cartItemId, quantity: nextQty })
          .unwrap()
          .then(() => {})
          .catch((e: any) => {
            Toast.show({
              type: 'error',
              text1: 'Could not update cart',
              text2: e?.data?.detail ?? e?.data?.message ?? e?.message ?? 'Please try again.',
            });
            throw e;
          });
      },
      decrement: (
        productId: string,
        priceOptionKey?: PriceOptionKey,
        variantId?: string,
      ): Promise<void> => {
        const target = items.find(i =>
          variantId
            ? i.product.id === productId && i.variantId === variantId
            : i.product.id === productId &&
              (priceOptionKey === undefined ||
                i.priceOptionKey === priceOptionKey),
        );
        if (!target?.cartItemId) return Promise.resolve();
        const dPcs = Math.max(1, target.product.piecesPerSet ?? 1);
        const dMinO = Math.max(1, Math.trunc(Number(target.product.minOrderQuantity) || 1));
        const dIsNaturalSet =
          dPcs > 1 && (target.product.unit || 'piece').toLowerCase() !== 'piece';
        const tier = target.priceOptionKey;
        // Variant lines are individual SKUs: step 1, minimum 1.
        const dStep = variantId
          ? 1
          : tier === 'set' || tier === 'remaining' || dIsNaturalSet
            ? 1
            : dPcs > 1
              ? dPcs
              : dMinO > 1 && productImpliesSetPurchase(target.product)
                ? dMinO
                : 1;
        const nextQty = Math.max(0, target.quantity - dStep);
        const minOrder = Math.max(
          1,
          Math.trunc(Number(target.product.minOrderQuantity) || 1),
        );
        // 'set' tier: one set is the minimum line unit; decrement to 0 removes the
        //   item, decrement from 2→1 should update not delete.
        const minLineQty = variantId
          ? 1
          : tier === 'set'
            ? 1
            : tier === 'remaining'
              ? 1
              : minOrder;
        const op =
          nextQty <= 0 || nextQty < minLineQty
            ? deleteCartItemApi({ cartItemId: target.cartItemId })
            : updateCartItemApi({ cartItemId: target.cartItemId, quantity: nextQty });
        return op.unwrap().then(() => {}).catch((e: any) => {
          Toast.show({
            type: 'error',
            text1: 'Could not update cart',
            text2: e?.data?.detail ?? e?.data?.message ?? e?.message ?? 'Please try again.',
          });
          throw e;
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
