import { useMemo } from 'react';
import { loginSuccess, logout } from '../features/auth/authSlice';
import { UserRole } from '../types';
import type { AppDispatch } from '../core/store';
import { useAppDispatch, useAppSelector } from './redux';
import {
  mobileApi,
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
  clearBusinessProfile,
  setBusinessProfile,
} from '../features/customer/businessProfileSlice';
import { getApiErrorMessage } from '../utils/apiErrorMessage';

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

function mapServerProfileToBusinessProfile(
  p: Record<string, unknown>,
): BusinessProfile | null {
  const str = (v: unknown) =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;
  const businessName = str(p.businessName) ?? str(p.business_name) ?? '';
  const gstNumber = str(p.gstNumber) ?? str(p.gst_number) ?? '';
  const fmcgNumber = str(p.fssaiNumber) ?? str(p.fssai_number) ?? '';
  const gstCertificate = str(p.gstCertificate) ?? str(p.gst_certificate);
  const fssaiLicense = str(p.fssaiLicense) ?? str(p.fssai_license);
  const udyamRegistration = str(p.udyamRegistration) ?? str(p.udyam_registration);
  const tradeCertificate = str(p.tradeCertificate) ?? str(p.trade_certificate);
  const shopImageUri = str(p.shopPhotoUrl) ?? str(p.shop_photo_url);
  const city = str(p.city) ?? str(p.businessCity) ?? str(p.business_city);
  const state = str(p.state) ?? str(p.businessState) ?? str(p.business_state);
  const pincode =
    str(p.pincode) ?? str(p.pin_code) ?? str(p.businessPincode) ?? str(p.business_pincode);
  // address may be a nested dict {address_line1, address_line2} from older registrations
  const _addrRaw = p.address;
  const _addrLine1FromDict =
    _addrRaw && typeof _addrRaw === 'object' && !Array.isArray(_addrRaw)
      ? str((_addrRaw as Record<string, unknown>).address_line1) ??
        str((_addrRaw as Record<string, unknown>).addressLine1)
      : undefined;
  const addressLine1 =
    str(p.address_line1) ??
    str(p.addressLine1) ??
    str(p.businessAddress) ??
    str(p.business_address) ??
    _addrLine1FromDict ??
    (!_addrLine1FromDict ? str(p.address as unknown) : undefined);

  const _addrLine2FromDict =
    _addrRaw && typeof _addrRaw === 'object' && !Array.isArray(_addrRaw)
      ? str((_addrRaw as Record<string, unknown>).address_line2) ??
        str((_addrRaw as Record<string, unknown>).addressLine2)
      : undefined;
  const addressLine2 =
    str(p.address_line2) ??
    str(p.addressLine2) ??
    str(p.businessAddressLine2) ??
    str(p.business_address_line2) ??
    _addrLine2FromDict;

  const hasAny =
    businessName ||
    gstNumber ||
    fmcgNumber ||
    gstCertificate ||
    fssaiLicense ||
    udyamRegistration ||
    tradeCertificate ||
    city ||
    state ||
    pincode ||
    addressLine1;
  if (!hasAny) {
    return null;
  }

  return {
    businessName,
    gstNumber,
    fmcgNumber,
    gstCertificate,
    fssaiLicense,
    udyamRegistration,
    tradeCertificate,
    shopImageUri,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
  };
}

/** Load persisted business/KYC fields for the logged-in user from the server (per-account source of truth). */
async function refreshBusinessProfileFromServer(dispatch: AppDispatch) {
  try {
    const envelope = await dispatch(
      mobileApi.endpoints.getProfile.initiate(undefined, {
        forceRefetch: true,
        subscribe: false,
      }),
    ).unwrap();
    const raw = (envelope as { data?: unknown })?.data;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const bp = mapServerProfileToBusinessProfile(raw as Record<string, unknown>);
      if (bp) {
        dispatch(setBusinessProfile(bp));
      } else {
        dispatch(clearBusinessProfile());
      }
    } else {
      dispatch(clearBusinessProfile());
    }
  } catch {
    dispatch(clearBusinessProfile());
  }
}

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth?.user ?? null);
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
      loginAsCustomer: async (values: { phone: string; password: string }) => {
        const res = await loginApi(values).unwrap();
        const data = res?.data as
          | { user: { id: string; name: string; phone: string }; token: string; refresh_token: string }
          | undefined;

        if (!res?.success || !data?.user?.id || !data?.token || !data?.refresh_token) {
          throw new Error(res?.message ?? 'Login failed');
        }

        dispatch(
          loginSuccess({
            id: data.user.id,
            name: data.user.name,
            role: 'customer',
            token: data.token,
            refreshToken: data.refresh_token,
          }),
        );
        // Clear stale persisted business data (e.g. failed registration on this device), then load this account from API.
        dispatch(clearBusinessProfile());
        await refreshBusinessProfileFromServer(dispatch);
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
        email?: string;
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
                  return registerMultipartApi(form).unwrap();
                })()
              : await registerApi({
                  name: input.name,
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
            const envMsg =
              typeof res?.message === 'string' && res.message.trim()
                ? res.message.trim()
                : null;
            const errObj = res?.error as Record<string, unknown> | undefined;
            const nested =
              errObj && typeof errObj.message === 'string'
                ? errObj.message.trim()
                : null;
            throw new Error(
              [envMsg, nested].filter(Boolean).join(' — ') || 'Registration failed',
            );
          }

          // Persist business details only after the server accepts registration (avoids leaking a
          // failed attempt into AsyncStorage for the next user who logs in on this device).
          if (input.role === 'customer' && input.businessProfile) {
            const addr = input.address as
              | { address_line1?: string; address_line2?: string }
              | undefined;
            dispatch(
              setBusinessProfile({
                ...input.businessProfile,
                addressLine1: addr?.address_line1?.trim() || undefined,
                addressLine2: addr?.address_line2?.trim() || undefined,
                city: input.city?.trim() || undefined,
                state: input.state?.trim() || undefined,
                pincode: input.pincode?.trim() || undefined,
              }),
            );
          }

          // Backend sends OTP during registration and returns request_id.
          return {
            requestId: data.request_id,
            userId: data.user_id,
            phone: data.phone ?? input.phone,
          };
        })().catch((err: unknown) => {
          throw new Error(getApiErrorMessage(err, 'Registration failed'));
        }),
      sendCustomerOtp: async ({ phone, purpose = 'login' }: { phone: string; purpose?: string }) => {
        try {
          const res = await sendOtpApi({ phone, purpose }).unwrap();
          const requestId = res?.data?.request_id;
          if (!res?.success || !requestId) {
            const envMsg =
              typeof res?.message === 'string' && res.message.trim()
                ? res.message.trim()
                : 'Failed to send OTP';
            throw new Error(envMsg);
          }
          return { requestId };
        } catch (err: unknown) {
          throw new Error(getApiErrorMessage(err, 'Failed to send OTP'));
        }
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
        try {
          const res = await verifyOtpApi({ phone, requestId, otp }).unwrap();
          const data = res?.data as
            | {
                user: { id: string; name: string; phone: string };
                token: string;
                refresh_token: string;
              }
            | undefined;

          if (!res?.success || !data?.user?.id || !data?.token || !data?.refresh_token) {
            const envMsg =
              typeof res?.message === 'string' && res.message.trim()
                ? res.message.trim()
                : 'OTP verification failed';
            throw new Error(envMsg);
          }

          dispatch(
            loginSuccess({
              id: data.user.id,
              name: data.user.name,
              role: role ?? 'customer',
              token: data.token,
              refreshToken: data.refresh_token,
            }),
          );
          if ((role ?? 'customer') === 'customer') {
            await refreshBusinessProfileFromServer(dispatch);
          }
        } catch (err: unknown) {
          throw new Error(getApiErrorMessage(err, 'OTP verification failed'));
        }
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
          dispatch(clearBusinessProfile());
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
