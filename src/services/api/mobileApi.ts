import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_V1_BASE_URL } from './config';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: Record<string, unknown>;
};

type IdParam = { id: string };
type ProductIdParam = { productId: string };
type OrderIdParam = { orderId: string };
type PaymentMethodIdParam = { paymentMethodId: string };
type NotificationIdParam = { notificationId: string };
type DeliveryLocationIdParam = { locationId: string };
type CartItemIdParam = { cartItemId: string };

type LoginBody = { email: string; password: string };
type DeliveryLoginBody = { phone: string; password: string };
type SendOtpBody = { phone: string };
type SendOtpData = { request_id: string };
type VerifyOtpBody = { phone: string; requestId: string; otp: string };
type VerifyOtpData = {
  user: { id: string; name: string; email: string; phone?: string };
  token: string;
  refresh_token: string;
};

type RegisterData = {
  request_id: string;
  user_id?: string;
  phone?: string;
};
type RegisterBody = {
  name: string;
  email: string;
  phone: string;
  business_name: string;
  password: string;
  confirm_password: string;
  gst_number?: string;
  gst_certificate?: string;
  fssai_license?: string;
  udyam_registration?: string;
  trade_certificate?: string;
  address?: Record<string, unknown>;
  city?: string;
  state?: string;
  pincode?: string;
};
type ForgotPasswordBody = { email: string };
type ResetPasswordBody = { token: string; new_password: string };
type RefreshTokenBody = { refreshToken: string };
type ChangePasswordBody = {
  current_password: string;
  new_password: string;
};

type CartAddBody = {
  product_id: string;
  quantity: number;
};
type CartUpdateBody = CartItemIdParam & { quantity: number };

type OrderItemCreateBody = {
  product_id: string;
  quantity: number;
};

type DeliveryAddressBody = Record<string, unknown>;

type CreateOrderBody = {
  items: OrderItemCreateBody[];
  delivery_location_id?: string;
  delivery_address?: DeliveryAddressBody;
  payment_method: string;
  payment_details?: Record<string, unknown>;
};

type SavePaymentMethodBody = {
  type: string;
  label?: string;
  details: Record<string, unknown>;
};

type AddWalletMoneyBody = {
  amount: number;
  source?: string;
};

type VerifyGstBody = {
  gst_number: string;
  legal_name?: string;
};
type KycSubmitBody = {
  documents?: Record<string, unknown>;
  business_name?: string;
  gst_number?: string;
  fssai_number?: string;
  pan_number?: string;
  business_type?: string;

  shop_image_url?: string;
  fssai_license_image_url?: string;

  // camelCase alternatives (backend accepts both)
  businessName?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  panNumber?: string;
  businessType?: string;
  shopImageUrl?: string;
  fssaiLicenseImageUrl?: string;

  address?: Record<string, unknown> | string;
};

type DeliveryLocationBody = {
  label?: string;
  address: string;
  latitude: number;
  longitude: number;
};

type DirectionsStep = {
  instruction?: string;
  distanceText?: string;
  durationText?: string;
};

type DirectionsRoute = {
  summary?: string;
  overviewPolylinePoints?: string;
  routePoints: Array<{ latitude: number; longitude: number }>;
  distanceText?: string;
  durationText?: string;
  steps?: DirectionsStep[];
};

type DirectionsResponse = {
  routes: DirectionsRoute[];
  copyrights?: unknown;
};

type ReverseGeocodeData = {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  formatted_address?: string;
  latitude?: number;
  longitude?: number;
};
type GeocodeData = {
  latitude: number;
  longitude: number;
  formatted_address?: string;
  input_address?: string;
};

type GetDirectionsQuery = {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
};

type DeliveryPerson = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  employeeId?: string;
  employee_id?: string;
  vehicleNumber?: string;
  vehicle_number?: string;
  vehicleType?: string;
  vehicle_type?: string;
  isAvailable?: boolean;
  is_available?: boolean;
  isOnline?: boolean;
  is_online?: boolean;
};

type DeliveryLoginResponse = {
  token: string;
  refreshToken: string;
  deliveryPerson: DeliveryPerson;
};

type DeliveryDashboardSummary = {
  todayEarnings: number;
  completedTodayCount: number;
  earningsChangePercent: number;
  activeOrder?: unknown;
  upcomingOrders?: unknown[];
};

type DeliveryAssignedOrdersResponse = {
  orders: unknown[];
  total: number;
};

type UpdateDeliveryOrderStatusBody = {
  status: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  photo?: string;
};

type UpdateDeliveryCurrentLocationBody = {
  latitude: number;
  longitude: number;
};

type PaymentInitiateBody = {
  order_id: string;
  amount: number;
  payment_method: string;
  payment_details?: Record<string, unknown>;
};
type PaymentVerifyBody = {
  payment_id: string;
  transaction_id: string;
};

export const mobileApi = createApi({
  reducerPath: 'mobileApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_V1_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as {
        auth?: { user?: { token?: string } | null };
      };
      const token = state.auth?.user?.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    'Auth',
    'Products',
    'Companies',
    'Categories',
    'Divisions',
    'Cart',
    'Orders',
    'User',
    'Wishlist',
    'Offers',
    'Notifications',
    'Kyc',
    'Delivery',
    'Payments',
    'Stats',
  ],
  endpoints: builder => ({
    register: builder.mutation<ApiEnvelope<RegisterData>, RegisterBody>({
      query: body => ({ url: '/auth/register', method: 'POST', body }),
      invalidatesTags: ['Auth'],
    }),
    login: builder.mutation<ApiEnvelope<unknown>, LoginBody>({
      query: body => ({ url: '/auth/login', method: 'POST', body }),
      invalidatesTags: ['Auth'],
    }),
    sendOtp: builder.mutation<ApiEnvelope<SendOtpData>, SendOtpBody>({
      query: body => ({ url: '/auth/send-otp', method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<ApiEnvelope<VerifyOtpData>, VerifyOtpBody>({
      query: body => ({ url: '/auth/verify-otp', method: 'POST', body }),
      invalidatesTags: ['Auth'],
    }),
    forgotPassword: builder.mutation<ApiEnvelope<unknown>, ForgotPasswordBody>({
      query: body => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),
    resetPassword: builder.mutation<ApiEnvelope<unknown>, ResetPasswordBody>({
      query: body => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    refreshToken: builder.mutation<ApiEnvelope<unknown>, RefreshTokenBody>({
      query: body => ({ url: '/auth/refresh-token', method: 'POST', body }),
    }),
    logoutApi: builder.mutation<ApiEnvelope<unknown>, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth'],
    }),
    deliveryLogin: builder.mutation<
      ApiEnvelope<DeliveryLoginResponse>,
      DeliveryLoginBody
    >({
      query: body => ({ url: '/delivery/auth/login', method: 'POST', body }),
      invalidatesTags: ['Auth'],
    }),
    deliveryLogoutApi: builder.mutation<ApiEnvelope<unknown>, void>({
      query: () => ({ url: '/delivery/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth'],
    }),

    getProductById: builder.query<ApiEnvelope<unknown>, IdParam>({
      query: ({ id }) => `/products/${id}`,
      providesTags: ['Products'],
    }),
    getProductBySlug: builder.query<ApiEnvelope<unknown>, { slug: string }>({
      query: ({ slug }) => `/products/slug/${slug}`,
      providesTags: ['Products'],
    }),
    searchProducts: builder.query<ApiEnvelope<unknown>, { q: string }>({
      query: ({ q }) => `/products/search?q=${encodeURIComponent(q)}`,
      providesTags: ['Products'],
    }),
    getFeaturedProducts: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/products/featured',
      providesTags: ['Products'],
    }),
    getProductsByCompany: builder.query<
      ApiEnvelope<unknown>,
      { companyName: string }
    >({
      query: ({ companyName }) =>
        `/products/company/${encodeURIComponent(companyName)}`,
      providesTags: ['Products'],
    }),
    getProductsByBrand: builder.query<
      ApiEnvelope<unknown>,
      { brandName: string }
    >({
      query: ({ brandName }) =>
        `/products/brand/${encodeURIComponent(brandName)}`,
      providesTags: ['Products'],
    }),

    getCompanies: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/companies',
      providesTags: ['Companies'],
    }),
    getCompanyById: builder.query<ApiEnvelope<unknown>, IdParam>({
      query: ({ id }) => `/companies/${id}`,
      providesTags: ['Companies'],
    }),
    getHulBrands: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/companies/hul/brands',
      providesTags: ['Companies'],
    }),
    getBiscuitBrands: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/companies/brands/biscuits',
      providesTags: ['Companies'],
    }),

    getCategories: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/categories',
      providesTags: ['Categories'],
    }),
    getShopCategories: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/categories/shop',
      providesTags: ['Categories'],
    }),
    getCategoryProducts: builder.query<ApiEnvelope<unknown>, IdParam>({
      query: ({ id }) => `/categories/${id}/products`,
      providesTags: ['Categories', 'Products'],
    }),

    getDivisions: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/divisions',
      providesTags: ['Divisions'],
    }),

    getCart: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/cart',
      providesTags: ['Cart'],
    }),
    addToCartApi: builder.mutation<ApiEnvelope<unknown>, CartAddBody>({
      query: body => ({ url: '/cart', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
    clearCartApi: builder.mutation<ApiEnvelope<unknown>, void>({
      query: () => ({ url: '/cart', method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
    updateCartItemApi: builder.mutation<ApiEnvelope<unknown>, CartUpdateBody>({
      query: ({ cartItemId, ...body }) => ({
        url: `/cart/${cartItemId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Cart'],
    }),
    deleteCartItemApi: builder.mutation<ApiEnvelope<unknown>, CartItemIdParam>({
      query: ({ cartItemId }) => ({
        url: `/cart/${cartItemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Cart'],
    }),

    createOrderApi: builder.mutation<ApiEnvelope<unknown>, CreateOrderBody>({
      query: body => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Orders', 'Cart'],
    }),
    getOrders: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/orders',
      providesTags: ['Orders'],
    }),
    getOrderById: builder.query<ApiEnvelope<unknown>, OrderIdParam>({
      query: ({ orderId }) => `/orders/${orderId}`,
      providesTags: ['Orders'],
    }),
    getOrderInvoice: builder.query<ApiEnvelope<unknown>, OrderIdParam>({
      query: ({ orderId }) => `/orders/${orderId}/invoice`,
      providesTags: ['Orders'],
    }),
    trackOrder: builder.query<ApiEnvelope<unknown>, OrderIdParam>({
      query: ({ orderId }) => `/orders/${orderId}/track`,
      providesTags: ['Orders'],
    }),
    cancelOrderApi: builder.mutation<ApiEnvelope<unknown>, OrderIdParam>({
      query: ({ orderId }) => ({
        url: `/orders/${orderId}/cancel`,
        method: 'POST',
        // Empty object: some stacks send JSON `null` or omit body and FastAPI then
        // reports body as missing; `{}` always validates as OrderCancel.
        body: {},
      }),
      invalidatesTags: ['Orders'],
    }),

    getProfile: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/user/profile',
      providesTags: ['User'],
    }),
    updateProfile: builder.mutation<
      ApiEnvelope<unknown>,
      Record<string, unknown>
    >({
      query: body => ({ url: '/user/profile', method: 'PUT', body }),
      invalidatesTags: ['User'],
    }),
    changePassword: builder.mutation<ApiEnvelope<unknown>, ChangePasswordBody>({
      query: body => ({ url: '/user/change-password', method: 'POST', body }),
    }),
    getPaymentMethods: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/user/payment-methods',
      providesTags: ['User'],
    }),
    savePaymentMethod: builder.mutation<
      ApiEnvelope<unknown>,
      SavePaymentMethodBody
    >({
      query: body => ({ url: '/user/payment-methods', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    deletePaymentMethod: builder.mutation<
      ApiEnvelope<unknown>,
      PaymentMethodIdParam
    >({
      query: ({ paymentMethodId }) => ({
        url: `/user/payment-methods/${paymentMethodId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),
    setDefaultPaymentMethod: builder.mutation<
      ApiEnvelope<unknown>,
      PaymentMethodIdParam
    >({
      query: ({ paymentMethodId }) => ({
        url: `/user/payment-methods/${paymentMethodId}/default`,
        method: 'PATCH',
      }),
      invalidatesTags: ['User'],
    }),
    getWallet: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/user/wallet',
      providesTags: ['User'],
    }),
    getWalletTransactions: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/user/wallet/transactions',
      providesTags: ['User'],
    }),
    addWalletMoney: builder.mutation<ApiEnvelope<unknown>, AddWalletMoneyBody>({
      query: body => ({ url: '/user/wallet/add-money', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    getUserActivity: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/user/activity',
      providesTags: ['User'],
    }),

    getWishlist: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/wishlist',
      providesTags: ['Wishlist'],
    }),
    addWishlistItem: builder.mutation<ApiEnvelope<unknown>, ProductIdParam>({
      query: ({ productId }) => ({
        url: '/wishlist',
        method: 'POST',
        body: { product_id: productId },
      }),
      invalidatesTags: ['Wishlist'],
    }),
    removeWishlistItem: builder.mutation<ApiEnvelope<unknown>, ProductIdParam>({
      query: ({ productId }) => ({
        url: `/wishlist/remove/${productId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Wishlist'],
    }),

    getOffersByCompany: builder.query<
      ApiEnvelope<unknown>,
      { company?: string } | void
    >({
      query: params =>
        params?.company
          ? `/offers/company?company=${encodeURIComponent(params.company)}`
          : '/offers/company',
      providesTags: ['Offers'],
    }),
    getOfferTextSlides: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/offers/text-slides',
      providesTags: ['Offers'],
    }),

    getNotifications: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/notifications',
      providesTags: ['Notifications'],
    }),
    readAllNotifications: builder.mutation<ApiEnvelope<unknown>, void>({
      query: () => ({ url: '/notifications/read-all', method: 'PUT' }),
      invalidatesTags: ['Notifications'],
    }),
    readNotification: builder.mutation<
      ApiEnvelope<unknown>,
      NotificationIdParam
    >({
      query: ({ notificationId }) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications'],
    }),
    deleteNotification: builder.mutation<
      ApiEnvelope<unknown>,
      NotificationIdParam
    >({
      query: ({ notificationId }) => ({
        url: `/notifications/${notificationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Notifications'],
    }),

    verifyGst: builder.mutation<ApiEnvelope<unknown>, VerifyGstBody>({
      query: body => ({ url: '/kyc/verify-gst', method: 'POST', body }),
      invalidatesTags: ['Kyc'],
    }),
    submitKyc: builder.mutation<ApiEnvelope<unknown>, KycSubmitBody>({
      query: body => ({ url: '/kyc/submit', method: 'POST', body }),
      invalidatesTags: ['Kyc'],
    }),
    skipKyc: builder.mutation<ApiEnvelope<unknown>, void>({
      query: () => ({ url: '/kyc/skip', method: 'POST' }),
      invalidatesTags: ['Kyc'],
    }),
    getKycStatus: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/kyc/status',
      providesTags: ['Kyc'],
    }),

    getDeliveryLocations: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/delivery',
      providesTags: ['Delivery'],
    }),
    createDeliveryLocation: builder.mutation<
      ApiEnvelope<unknown>,
      DeliveryLocationBody
    >({
      query: body => ({ url: '/delivery', method: 'POST', body }),
      invalidatesTags: ['Delivery'],
    }),
    checkDeliveryAvailability: builder.query<
      ApiEnvelope<unknown>,
      { latitude: number; longitude: number }
    >({
      query: ({ latitude, longitude }) =>
        `/delivery/check-availability?latitude=${latitude}&longitude=${longitude}`,
      providesTags: ['Delivery'],
    }),
    updateDeliveryLocation: builder.mutation<
      ApiEnvelope<unknown>,
      DeliveryLocationIdParam & Partial<DeliveryLocationBody>
    >({
      query: ({ locationId, ...body }) => ({
        url: `/delivery/${locationId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Delivery'],
    }),
    deleteDeliveryLocation: builder.mutation<
      ApiEnvelope<unknown>,
      DeliveryLocationIdParam
    >({
      query: ({ locationId }) => ({
        url: `/delivery/${locationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Delivery'],
    }),

    getDeliveryMe: builder.query<ApiEnvelope<DeliveryPerson>, void>({
      query: () => '/delivery/auth/me',
      providesTags: ['Delivery'],
    }),

    getDeliveryDashboardSummary: builder.query<
      ApiEnvelope<DeliveryDashboardSummary>,
      void
    >({
      query: () => '/delivery/dashboard-summary',
      providesTags: ['Delivery'],
    }),

    getDeliveryAssignedOrders: builder.query<
      ApiEnvelope<DeliveryAssignedOrdersResponse>,
      void
    >({
      query: () => '/delivery/orders/assigned',
      providesTags: ['Delivery'],
    }),
    getDirectionsRoute: builder.query<
      ApiEnvelope<DirectionsResponse>,
      GetDirectionsQuery
    >({
      query: ({ originLat, originLng, destinationLat, destinationLng, mode }) =>
        `/maps/directions?origin_lat=${originLat}&origin_lng=${originLng}&destination_lat=${destinationLat}&destination_lng=${destinationLng}&mode=${encodeURIComponent(
          mode ?? 'driving',
        )}`,
    }),

    reverseGeocode: builder.query<
      ApiEnvelope<ReverseGeocodeData>,
      { lat: number; lng: number }
    >({
      query: ({ lat, lng }) => `/maps/reverse-geocode?lat=${lat}&lng=${lng}`,
    }),
    geocodeAddress: builder.query<
      ApiEnvelope<GeocodeData>,
      { address: string }
    >({
      query: ({ address }) =>
        `/maps/geocode?address=${encodeURIComponent(address)}`,
    }),

    updateDeliveryOrderStatus: builder.mutation<
      ApiEnvelope<unknown>,
      { orderId: string } & UpdateDeliveryOrderStatusBody
    >({
      query: ({ orderId, ...body }) => ({
        url: `/delivery/orders/${orderId}/status`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Delivery'],
    }),
    updateDeliveryCurrentLocation: builder.mutation<
      ApiEnvelope<unknown>,
      UpdateDeliveryCurrentLocationBody
    >({
      query: body => ({
        url: '/delivery/orders/location',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Delivery'],
    }),

    initiatePayment: builder.mutation<
      ApiEnvelope<unknown>,
      PaymentInitiateBody
    >({
      query: body => ({ url: '/payments/initiate', method: 'POST', body }),
      invalidatesTags: ['Payments'],
    }),
    verifyPayment: builder.mutation<ApiEnvelope<unknown>, PaymentVerifyBody>({
      query: body => ({ url: '/payments/verify', method: 'POST', body }),
      invalidatesTags: ['Payments', 'Orders'],
    }),

    getStats: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/stats',
      providesTags: ['Stats'],
    }),
    getQuickStats: builder.query<ApiEnvelope<unknown>, void>({
      query: () => '/stats/quick',
      providesTags: ['Stats'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useRefreshTokenMutation,
  useLogoutApiMutation,
  useDeliveryLoginMutation,
  useDeliveryLogoutApiMutation,
  useGetProductByIdQuery,
  useGetProductBySlugQuery,
  useSearchProductsQuery,
  useGetFeaturedProductsQuery,
  useGetProductsByCompanyQuery,
  useGetProductsByBrandQuery,
  useGetCompaniesQuery,
  useGetCompanyByIdQuery,
  useGetHulBrandsQuery,
  useGetBiscuitBrandsQuery,
  useGetCategoriesQuery,
  useGetShopCategoriesQuery,
  useGetCategoryProductsQuery,
  useGetDivisionsQuery,
  useGetCartQuery,
  useAddToCartApiMutation,
  useClearCartApiMutation,
  useUpdateCartItemApiMutation,
  useDeleteCartItemApiMutation,
  useCreateOrderApiMutation,
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useGetOrderInvoiceQuery,
  useTrackOrderQuery,
  useCancelOrderApiMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useGetPaymentMethodsQuery,
  useSavePaymentMethodMutation,
  useDeletePaymentMethodMutation,
  useSetDefaultPaymentMethodMutation,
  useGetWalletQuery,
  useGetWalletTransactionsQuery,
  useAddWalletMoneyMutation,
  useGetUserActivityQuery,
  useGetWishlistQuery,
  useAddWishlistItemMutation,
  useRemoveWishlistItemMutation,
  useGetOffersByCompanyQuery,
  useGetOfferTextSlidesQuery,
  useGetNotificationsQuery,
  useReadAllNotificationsMutation,
  useReadNotificationMutation,
  useDeleteNotificationMutation,
  useVerifyGstMutation,
  useSubmitKycMutation,
  useSkipKycMutation,
  useGetKycStatusQuery,
  useGetDeliveryLocationsQuery,
  useCreateDeliveryLocationMutation,
  useCheckDeliveryAvailabilityQuery,
  useUpdateDeliveryLocationMutation,
  useDeleteDeliveryLocationMutation,
  useGetDeliveryMeQuery,
  useGetDeliveryDashboardSummaryQuery,
  useGetDeliveryAssignedOrdersQuery,
  useUpdateDeliveryOrderStatusMutation,
  useUpdateDeliveryCurrentLocationMutation,
  useGetDirectionsRouteQuery,
  useLazyReverseGeocodeQuery,
  useLazyGeocodeAddressQuery,
  useInitiatePaymentMutation,
  useVerifyPaymentMutation,
  useGetStatsQuery,
  useGetQuickStatsQuery,
} = mobileApi;
