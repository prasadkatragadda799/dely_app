import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Deal, Product } from '../../../types';
import { API_V1_BASE_URL } from '../../../services/api/config';
import {
  ApiResponseEnvelope,
  mapOfferFromApi,
  mapProductFromApi,
} from './schemas';

type ProductsListData = { products: unknown[]; pagination?: unknown };
type OffersData = {
  banners?: unknown[];
  textOffers?: unknown[];
  companyOffers?: unknown[];
};

/** Root row from GET /categories (tree roots for the active division). */
export type ShopCategoryNode = {
  id: string;
  name: string;
  slug?: string;
  icon?: string | null;
  color?: string | null;
  image_url?: string | null;
  product_count?: number;
  /** From admin `display_order`; tree is sorted using this when present. */
  display_order?: number;
  children?: ShopCategoryNode[];
};

function sortCategoryTreeNodes(nodes: ShopCategoryNode[]): ShopCategoryNode[] {
  return [...nodes]
    .sort((a, b) => {
      const ao = Number(a.display_order ?? 0);
      const bo = Number(b.display_order ?? 0);
      if (ao !== bo) return ao - bo;
      return (a.name || '').localeCompare(b.name || '');
    })
    .map(n => ({
      ...n,
      children:
        n.children && n.children.length > 0
          ? sortCategoryTreeNodes(n.children.filter(Boolean) as ShopCategoryNode[])
          : n.children,
    }));
}

export type ShopCategoryDivision = 'fmcg' | 'homeKitchen';

export const productsApi = createApi({
  reducerPath: 'productsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_V1_BASE_URL,
    // Attach the same auth token used across the app (mobileApi.ts).
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as { auth?: { user?: { token?: string } | null } };
      const token = state.auth?.user?.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: builder => ({
    getProducts: builder.query<
      Product[],
      { category?: string; pincode?: string; deliverTo?: string; limit?: number } | void
    >({
      async queryFn(args, api, _extraOptions, baseQuery) {
        const requestedCategory =
          args && 'category' in args ? (args.category as Product['category'] | undefined) : undefined;
        // `pincode` FILTERS the catalog to serviceable products; `deliverTo` keeps the
        // full catalog and annotates each product with a `deliverable` flag instead.
        const pincode =
          args && 'pincode' in args ? (args.pincode as string | undefined) : undefined;
        const deliverTo =
          args && 'deliverTo' in args ? (args.deliverTo as string | undefined) : undefined;

        const categoriesToFetch: Product['category'][] = requestedCategory
          ? [requestedCategory]
          : ['fmcg', 'kitchen', 'home'];

        // Default is generous enough to cover a full category listing (not just a home-feed
        // preview) since these screens don't implement infinite scroll — callers doing a
        // lightweight preview (e.g. HomeScreen picks) can still pass a smaller `limit`.
        const limit = (args && 'limit' in args && args.limit) || 500;
        const page = 1;

        const pincodeParam = pincode ? `&pincode=${encodeURIComponent(pincode)}` : '';
        const deliverToParam = deliverTo
          ? `&deliver_to=${encodeURIComponent(deliverTo)}`
          : '';
        const buildUrlForCategory = (cat: Product['category']): string => {
          if (cat === 'kitchen' || cat === 'home') {
            return `/products?page=${page}&limit=${limit}&division_slug=${encodeURIComponent(cat)}${pincodeParam}${deliverToParam}`;
          }
          // Backend treats the "default division" as grocery (division_id == None).
          return `/products?page=${page}&limit=${limit}${pincodeParam}${deliverToParam}`;
        };

        const merged: Product[] = [];

        for (const cat of categoriesToFetch) {
          const result = await baseQuery(buildUrlForCategory(cat));

          if ('error' in result) {
            // No dummy fallbacks: return empty for this category and continue.
            continue;
          }

          const envelope = result.data as ApiResponseEnvelope<ProductsListData>;
          const productsRaw = envelope?.data?.products ?? [];
          // Shelf bucket (fmcg / kitchen / home) must come from **which division fetch**
          // returned the row — not from the product's *taxonomy* category slug (e.g.
          // "kitchen-cleaners" or "home-care" would wrongly map to home/kitchen).
          const mapped = productsRaw.map((item, index) =>
            mapProductFromApi(item as any, index, cat),
          );
          merged.push(...mapped);
        }

        // Same product can appear in multiple fetches (e.g. default + division).
        // Return unique products by id to avoid duplicate cards in UI.
        const uniqueById = new Map<string, Product>();
        for (const product of merged) {
          if (!uniqueById.has(product.id)) {
            uniqueById.set(product.id, product);
          }
        }

        return { data: Array.from(uniqueById.values()) };
      },
    }),
    /** Single product — `GET /products/{id}` (description, specifications, full gallery). */
    getProduct: builder.query<Product, string>({
      async queryFn(id, api, _extraOptions, baseQuery) {
        const result = await baseQuery({
          url: `/products/${encodeURIComponent(id)}`,
          signal: api.signal,
        });
        if ('error' in result) {
          return { error: result.error as { status: number; data?: unknown } };
        }
        const envelope = result.data as ApiResponseEnvelope<unknown>;
        const raw = envelope?.data;
        if (!raw || typeof raw !== 'object') {
          return {
            error: { status: 404, data: 'Product not found' } as {
              status: number;
              data?: unknown;
            },
          };
        }
        return { data: mapProductFromApi(raw as any, 0) };
      },
    }),
    getOffers: builder.query<Deal[], void>({
      async queryFn(_args, _api, _extraOptions, baseQuery) {
        const result = await baseQuery('/offers');

        if ('error' in result) {
          // Keep UI resilient but emit diagnostics for backend incident triage.
          console.warn('[offers] GET /offers failed', {
            error: result.error,
            baseUrl: API_V1_BASE_URL,
          });
          return { data: [] };
        }

        const envelope = result.data as ApiResponseEnvelope<OffersData>;
        const banners = envelope?.data?.banners ?? [];
        const textOffers = envelope?.data?.textOffers ?? [];
        const companyOffers = envelope?.data?.companyOffers ?? [];

        const all = [...banners, ...textOffers, ...companyOffers];
        const mapped = all.map((item, index) => mapOfferFromApi(item as any, index));
        return { data: mapped };
      },
    }),
    getCategoryTree: builder.query<ShopCategoryNode[], ShopCategoryDivision>({
      async queryFn(division, _api, _extraOptions, baseQuery) {
        const urls: string[] =
          division === 'homeKitchen'
            ? [
                '/categories?division_slug=kitchen',
                '/categories?division_slug=home',
              ]
            : ['/categories'];

        const merged: ShopCategoryNode[] = [];
        const seen = new Set<string>();

        for (const url of urls) {
          const result = await baseQuery(url);
          if ('error' in result) {
            continue;
          }
          const envelope = result.data as ApiResponseEnvelope<ShopCategoryNode[]>;
          const roots = Array.isArray(envelope?.data) ? envelope.data : [];
          for (const node of roots) {
            if (node?.id && !seen.has(node.id)) {
              seen.add(node.id);
              merged.push(node);
            }
          }
        }

        return { data: sortCategoryTreeNodes(merged) };
      },
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useGetOffersQuery,
  useGetCategoryTreeQuery,
} = productsApi;
