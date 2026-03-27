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
    getProducts: builder.query<Product[], { category?: string } | void>({
      async queryFn(args, api, _extraOptions, baseQuery) {
        const requestedCategory =
          args && 'category' in args ? (args.category as Product['category'] | undefined) : undefined;

        const categoriesToFetch: Product['category'][] = requestedCategory
          ? [requestedCategory]
          : ['fmcg', 'kitchen', 'home'];

        const limit = 50;
        const page = 1;

        const buildUrlForCategory = (cat: Product['category']): string => {
          if (cat === 'kitchen' || cat === 'home') {
            return `/products?page=${page}&limit=${limit}&division_slug=${encodeURIComponent(cat)}`;
          }
          // Backend treats the "default division" as grocery (division_id == None).
          return `/products?page=${page}&limit=${limit}`;
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
          // Let `mapProductFromApi` derive `product.category` from the backend payload.
          // This avoids overwriting `category.slug` with the requested fetch division
          // (e.g. default division fetch returning a "home" category product).
          const mapped = productsRaw.map((item, index) => mapProductFromApi(item as any, index));
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
  }),
});

export const { useGetProductsQuery, useGetOffersQuery } = productsApi;
