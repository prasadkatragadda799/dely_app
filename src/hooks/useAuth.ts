import { useMemo } from 'react';
import { loginSuccess, logout } from '../features/auth/authSlice';
import { UserRole } from '../types';
import { useAppDispatch, useAppSelector } from './redux';
import {
  useLoginMutation,
  useLogoutApiMutation,
  useDeliveryLoginMutation,
  useDeliveryLogoutApiMutation,
  useRegisterMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
} from '../services/api/mobileApi';
import {
  BusinessProfile,
  setBusinessProfile,
} from '../features/customer/businessProfileSlice';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const [loginApi] = useLoginMutation();
  const [logoutApi] = useLogoutApiMutation();
  const [deliveryLoginApi] = useDeliveryLoginMutation();
  const [deliveryLogoutApi] = useDeliveryLogoutApiMutation();
  const [registerApi] = useRegisterMutation();
  const [sendOtpApi] = useSendOtpMutation();
  const [verifyOtpApi] = useVerifyOtpMutation();

  return useMemo(
    () => ({
      user,
      loginAsCustomer: async (values: { email: string; password: string }) => {
        const res = await loginApi(values).unwrap();
        const data = res?.data as
          | { user: { id: string; name: string; email: string }; token: string; refresh_token: string }
          | undefined;

        if (!res?.success || !data?.user?.id || !data?.token || !data?.refresh_token) {
          throw new Error(res?.message ?? 'Login failed');
        }

        dispatch(
          loginSuccess({
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: 'customer',
            token: data.token,
            refreshToken: data.refresh_token,
          }),
        );
      },
      loginAsDelivery: async (values: { phone: string; password: string }) => {
        const res = await deliveryLoginApi(values).unwrap();
        const data = res?.data as
          | {
              token?: string;
              refreshToken?: string;
              deliveryPerson?: {
                id?: string;
                name?: string;
                phone?: string;
                email?: string;
              };
            }
          | undefined;

        if (
          !res?.success ||
          !data?.deliveryPerson?.id ||
          !data?.token ||
          !data?.refreshToken
        ) {
          throw new Error(res?.message ?? 'Delivery login failed');
        }

        dispatch(
          loginSuccess({
            id: data.deliveryPerson.id,
            name: data.deliveryPerson.name ?? 'Delivery Partner',
            email: data.deliveryPerson.email ?? '',
            role: 'delivery',
            token: data.token,
            refreshToken: data.refreshToken,
          }),
        );
      },
      registerWithRole: (input: {
        name: string;
        email: string;
        phone: string;
        password: string;
        role: UserRole;
        businessProfile?: BusinessProfile | null;
        address?: Record<string, unknown>;
        city?: string;
        state?: string;
        pincode?: string;
      }) =>
        (async () => {
          // Persist the app-only business profile fields (images/fmcgNumber) locally.
          if (input.role === 'customer' && input.businessProfile) {
            dispatch(setBusinessProfile(input.businessProfile));
          }

          // Backend registration schema (UserCreate)
          const res = await registerApi({
            name: input.name,
            email: input.email,
            phone: input.phone,
            business_name:
              input.businessProfile?.businessName ??
              // Backend requires a value; keep this safe if UI ever changes.
              'Business',
            password: input.password,
            confirm_password: input.password,
            gst_number: input.businessProfile?.gstNumber || undefined,
            gst_certificate: input.businessProfile?.gstCertificate || undefined,
            fssai_license: input.businessProfile?.fssaiLicense || undefined,
            udyam_registration: input.businessProfile?.udyamRegistration || undefined,
            trade_certificate: input.businessProfile?.tradeCertificate || undefined,
            address: input.address,
            city: input.city,
            state: input.state,
            pincode: input.pincode,
          }).unwrap();

          const data = res?.data as
            | { request_id?: string; user_id?: string; phone?: string }
            | undefined;

          if (!res?.success || !data?.request_id) {
            throw new Error(res?.message ?? 'Registration failed');
          }

          // Backend sends OTP during registration and returns request_id.
          return {
            requestId: data.request_id,
            userId: data.user_id,
            phone: data.phone ?? input.phone,
          };
        })(),
      sendCustomerOtp: async ({ phone }: { phone: string }) => {
        const res = await sendOtpApi({ phone }).unwrap();
        const requestId = res?.data?.request_id;
        if (!res?.success || !requestId) {
          throw new Error(res?.message ?? 'Failed to send OTP');
        }
        return { requestId };
      },
      verifyCustomerOtp: async ({
        phone,
        requestId,
        otp,
        role,
      }: {
        phone: string;
        requestId: string;
        otp: string;
        role?: UserRole;
      }) => {
        const res = await verifyOtpApi({ phone, requestId, otp }).unwrap();
        const data = res?.data as
          | {
              user: { id: string; name: string; email: string; phone?: string };
              token: string;
              refresh_token: string;
            }
          | undefined;

        if (!res?.success || !data?.user?.id || !data?.token || !data?.refresh_token) {
          throw new Error(res?.message ?? 'OTP verification failed');
        }

        dispatch(
          loginSuccess({
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: role ?? 'customer',
            token: data.token,
            refreshToken: data.refresh_token,
          }),
        );
      },
      logout: async () => {
        try {
          if (user?.role === 'delivery') {
            await deliveryLogoutApi().unwrap();
          } else {
            await logoutApi().unwrap();
          }
        } catch {
          // Even if the server logout fails (e.g. token expired), we still clear local auth.
        } finally {
          dispatch(logout());
        }
      },
    }),
    [
      dispatch,
      user,
      loginApi,
      logoutApi,
      deliveryLoginApi,
      deliveryLogoutApi,
      registerApi,
      sendOtpApi,
      verifyOtpApi,
    ],
  );
};
