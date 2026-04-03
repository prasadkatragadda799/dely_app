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
  useRegisterMultipartMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
} from '../services/api/mobileApi';
import {
  BusinessProfile,
  setBusinessProfile,
} from '../features/customer/businessProfileSlice';

function appendRegistrationFile(form: FormData, field: string, uri?: string) {
  if (!uri) return;
  const last = uri.split('/').pop() ?? 'photo.jpg';
  const base = last.split('?')[0] || 'photo.jpg';
  const ext = base.includes('.') ? base.split('.').pop()?.toLowerCase() : '';
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const name = base.includes('.') ? base : `${base}.jpg`;
  // React Native FormData file shape (not a web Blob)
  form.append(field, { uri, type: mime, name } as any);
}

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const [loginApi] = useLoginMutation();
  const [logoutApi] = useLogoutApiMutation();
  const [deliveryLoginApi] = useDeliveryLoginMutation();
  const [deliveryLogoutApi] = useDeliveryLogoutApiMutation();
  const [registerApi] = useRegisterMutation();
  const [registerMultipartApi] = useRegisterMultipartMutation();
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

          const fssaiDigits =
            input.businessProfile?.fmcgNumber?.replace(/\D/g, '') ?? '';
          const fssaiNumber =
            fssaiDigits.length === 14 ? fssaiDigits : undefined;

          const res =
            input.role === 'customer' && input.businessProfile
              ? await (async () => {
                  const bp = input.businessProfile!;
                  const form = new FormData();
                  form.append('name', input.name);
                  form.append('email', input.email);
                  form.append('phone', input.phone);
                  form.append('password', input.password);
                  form.append('confirm_password', input.password);
                  form.append('business_name', bp.businessName || 'Business');
                  if (bp.gstNumber?.trim())
                    form.append('gst_number', bp.gstNumber.trim());
                  if (fssaiNumber) form.append('fssai_number', fssaiNumber);
                  if (input.city?.trim()) form.append('city', input.city.trim());
                  if (input.state?.trim())
                    form.append('state', input.state.trim());
                  if (input.pincode?.trim())
                    form.append('pincode', input.pincode.trim());
                  form.append(
                    'address_json',
                    JSON.stringify(input.address ?? {}),
                  );
                  appendRegistrationFile(
                    form,
                    'gst_certificate',
                    bp.gstCertificate,
                  );
                  appendRegistrationFile(
                    form,
                    'fssai_license',
                    bp.fssaiLicense,
                  );
                  appendRegistrationFile(
                    form,
                    'udyam_registration',
                    bp.udyamRegistration,
                  );
                  appendRegistrationFile(
                    form,
                    'trade_certificate',
                    bp.tradeCertificate,
                  );
                  appendRegistrationFile(form, 'shop_photo', bp.shopImageUri);
                  appendRegistrationFile(
                    form,
                    'user_id_document',
                    bp.userIdUri,
                  );
                  return registerMultipartApi(form).unwrap();
                })()
              : await registerApi({
                  name: input.name,
                  email: input.email,
                  phone: input.phone,
                  business_name:
                    input.businessProfile?.businessName ?? 'Business',
                  password: input.password,
                  confirm_password: input.password,
                  gst_number: input.businessProfile?.gstNumber || undefined,
                  fssai_number: fssaiNumber,
                  gst_certificate:
                    input.businessProfile?.gstCertificate || undefined,
                  fssai_license:
                    input.businessProfile?.fssaiLicense || undefined,
                  udyam_registration:
                    input.businessProfile?.udyamRegistration || undefined,
                  trade_certificate:
                    input.businessProfile?.tradeCertificate || undefined,
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
      registerMultipartApi,
      sendOtpApi,
      verifyOtpApi,
    ],
  );
};
