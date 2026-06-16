/**
 * Human-readable message from RTK Query `.unwrap()` rejections, FastAPI `detail`,
 * and similar API error shapes.
 */

function pickFromDetails(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const lines = details.map((item: unknown) => {
    if (item && typeof item === 'object') {
      const it = item as Record<string, unknown>;
      const msg = typeof it.msg === 'string' ? it.msg.trim() : '';
      // loc can be a string like "('body', 'field_name')" or an array
      let field = '';
      if (typeof it.loc === 'string') {
        // parse Python tuple string → extract last identifier
        const matches = it.loc.match(/[\w_]+/g) ?? [];
        field = matches.filter(t => t !== 'body').pop() ?? '';
      } else if (Array.isArray(it.loc)) {
        field = (it.loc as unknown[])
          .filter((x): x is string => typeof x === 'string' && x !== 'body')
          .join('.');
      }
      return field ? `${field}: ${msg}` : msg;
    }
    return String(item);
  });
  const joined = lines.filter(Boolean).join('\n').trim();
  return joined || null;
}

function pickFromResponseData(data: unknown): string | null {
  if (data == null || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  // FastAPI standard validation array
  const detail = d.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const msg = pickFromDetails(detail);
    if (msg) return msg;
  }

  // Custom backend envelope: error.details array
  if (d.error && typeof d.error === 'object') {
    const err = d.error as Record<string, unknown>;
    if (Array.isArray(err.details)) {
      const msg = pickFromDetails(err.details);
      if (msg) return msg;
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim();
    }
  }

  // Top-level message from envelope
  if (typeof d.message === 'string' && d.message.trim()) {
    const msg = d.message.trim();
    // Don't surface generic "Validation error" — caller's fallback is better
    if (msg.toLowerCase() === 'validation error') return null;
    return msg;
  }

  if (typeof d.error === 'string' && d.error.trim()) return d.error.trim();

  return null;
}

function isTechnicalError(msg: string): boolean {
  return /json\s*parse|syntax\s*error|unexpected\s*token|unexpected\s*character/i.test(msg);
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error == null) return fallback;

  if (typeof error === 'string' && error.trim()) {
    return isTechnicalError(error) ? fallback : error.trim();
  }

  if (error instanceof Error && error.message?.trim()) {
    const msg = error.message.trim();
    return isTechnicalError(msg) ? fallback : msg;
  }

  const e = error as Record<string, unknown>;

  // RTK Query network / parsing failures
  if (e.status === 'PARSING_ERROR' || e.status === 'FETCH_ERROR') {
    return 'Could not reach the server. Please check your connection and try again.';
  }

  if (typeof e === 'object' && 'data' in e) {
    const fromData = pickFromResponseData(e.data);
    if (fromData) return fromData;
  }

  if (typeof e.message === 'string' && e.message.trim()) {
    const msg = e.message.trim();
    return isTechnicalError(msg) ? fallback : msg;
  }

  if (typeof e.error === 'string' && e.error.trim()) {
    const msg = e.error.trim();
    return isTechnicalError(msg) ? fallback : msg;
  }

  return fallback;
}
