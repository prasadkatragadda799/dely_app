/**
 * Human-readable message from RTK Query `.unwrap()` rejections, FastAPI `detail`,
 * and similar API error shapes.
 */
function pickFromResponseData(data: unknown): string | null {
  if (data == null || typeof data !== 'object') {
    return null;
  }
  const d = data as Record<string, unknown>;

  const detail = d.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }
  if (Array.isArray(detail)) {
    const lines = detail.map(item => {
      if (item && typeof item === 'object' && 'msg' in item) {
        const msg = String((item as { msg?: string }).msg ?? '');
        const loc = (item as { loc?: unknown[] }).loc;
        const where = Array.isArray(loc)
          ? loc
              .filter((x): x is string => typeof x === 'string' && x !== 'body')
              .join('.')
          : '';
        return where ? `${where}: ${msg}` : msg;
      }
      return String(item);
    });
    const joined = lines.filter(Boolean).join('\n').trim();
    return joined || null;
  }

  if (typeof d.message === 'string' && d.message.trim()) {
    return d.message.trim();
  }

  if (d.error && typeof d.error === 'object') {
    const err = d.error as Record<string, unknown>;
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim();
    }
  }
  if (typeof d.error === 'string' && d.error.trim()) {
    return d.error.trim();
  }

  return null;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error == null) {
    return fallback;
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (error instanceof Error && error.message?.trim()) {
    return error.message.trim();
  }

  const e = error as Record<string, unknown>;

  if (e && typeof e === 'object' && 'data' in e) {
    const fromData = pickFromResponseData(e.data);
    if (fromData) {
      return fromData;
    }
  }

  if (typeof e.message === 'string' && e.message.trim()) {
    return e.message.trim();
  }
  if (typeof e.error === 'string' && e.error.trim()) {
    return e.error.trim();
  }

  return fallback;
}
