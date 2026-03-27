import { useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { useAppSelector } from './redux';
import {
  useGetDeliveryAssignedOrdersQuery,
  useUpdateDeliveryOrderStatusMutation,
} from '../services/api/mobileApi';

const mapBackendStatusToUiStatus = (backendStatus: string): OrderStatus => {
  switch (backendStatus) {
    case 'pending':
    case 'confirmed':
    case 'processing':
      return 'assigned';
    case 'shipped':
      return 'picked';
    case 'out_for_delivery':
      return 'en_route';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'completed':
      return 'delivered';
    default:
      return 'assigned';
  }
};

const deriveAddress = (deliveryAddress: unknown): string => {
  if (!deliveryAddress) return 'Address not available';
  if (typeof deliveryAddress === 'string') return deliveryAddress;
  const d = deliveryAddress as Record<string, unknown>;

  const line1 =
    (d.address_line1 as string | undefined) ??
    (d.addressLine1 as string | undefined) ??
    (d.address as string | undefined) ??
    '';
  const city = d.city as string | undefined;
  const state = d.state as string | undefined;
  const pincode = (d.pincode as string | undefined) ?? (d.pin_code as string | undefined);

  const parts = [line1, [city, state, pincode].filter(Boolean).join(', ')]
    .map(v => (v ?? '').toString().trim())
    .filter(Boolean);

  return parts.join(', ') || 'Address not available';
};

const deriveCoordinates = (
  deliveryAddress: unknown,
): { latitude?: number; longitude?: number } => {
  if (!deliveryAddress || typeof deliveryAddress === 'string') return {};
  const d = deliveryAddress as Record<string, unknown>;

  const rawLat = d.latitude ?? d.lat;
  const rawLng = d.longitude ?? d.lng;

  const latitude =
    typeof rawLat === 'number'
      ? rawLat
      : typeof rawLat === 'string' && rawLat.trim() !== ''
        ? Number(rawLat)
        : undefined;

  const longitude =
    typeof rawLng === 'number'
      ? rawLng
      : typeof rawLng === 'string' && rawLng.trim() !== ''
        ? Number(rawLng)
        : undefined;

  const safe = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

  return {
    latitude: safe(latitude) ? latitude : undefined,
    longitude: safe(longitude) ? longitude : undefined,
  };
};

const buildItemsSummary = (items: unknown): string => {
  if (!Array.isArray(items) || items.length === 0) return 'Items not available';

  const mapped = items.slice(0, 3).map((it: any) => {
    const name = it?.productName ?? it?.product_name ?? 'Item';
    const qty = it?.quantity ?? undefined;
    return qty !== undefined ? `${name} x ${qty}` : name;
  });

  const remaining = items.length - mapped.length;
  return remaining > 0 ? `${mapped.join(', ')} +${remaining} more` : mapped.join(', ');
};

export const useOrders = () => {
  const { user } = useAppSelector(state => state.auth);
  const isDelivery = user?.role === 'delivery';

  const {
    data: assignedRes,
    refetch,
    isFetching,
  } = useGetDeliveryAssignedOrdersQuery(undefined, {
    skip: !isDelivery,
    pollingInterval: 30000,
  });

  const orders: Order[] = useMemo(() => {
    const rawOrders = (assignedRes?.data?.orders ?? []) as any[];

    return rawOrders.map(o => {
      const deliveryAddressObj = o?.deliveryAddress ?? o?.delivery_address;
      const coords = deriveCoordinates(deliveryAddressObj);
      const backendStatus = o?.status as string;
      return {
        id: o?.id ?? '',
        customerName: o?.customerName ?? o?.customer_name ?? 'Customer',
        address: deriveAddress(o?.deliveryAddress ?? o?.delivery_address),
        customerLatitude: coords.latitude,
        customerLongitude: coords.longitude,
        amount: Number(o?.totalAmount ?? o?.total_amount ?? 0),
        status: mapBackendStatusToUiStatus(backendStatus),
        createdAt: o?.createdAt ?? o?.created_at ?? new Date().toISOString(),
        itemsSummary: buildItemsSummary(o?.items),
      };
    });
  }, [assignedRes]);

  const [updateDeliveryStatusApi] = useUpdateDeliveryOrderStatusMutation();

  return useMemo(
    () => ({
      orders,
      assigned: orders.filter(order => order.status === 'assigned'),
      ongoing: orders.filter(order => ['picked', 'en_route'].includes(order.status)),
      history: orders.filter(order =>
        ['delivered', 'cancelled'].includes(order.status),
      ),
      setStatus: async (orderId: string, status: OrderStatus) => {
        const backendStatus =
          status === 'delivered'
            ? 'delivered'
            : status === 'en_route'
              ? 'in_transit'
              : // 'accepted' | 'picked'
                'picked_up';

        await updateDeliveryStatusApi({
          orderId,
          status: backendStatus,
        }).unwrap();
        await refetch();
      },
      isLoading: isFetching,
    }),
    [orders, updateDeliveryStatusApi, refetch, isFetching],
  );
};
