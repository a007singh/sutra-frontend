const USER_LOCALE = navigator.language || "en-IN";
const USER_TZ     = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Force UTC interpretation — DynamoDB stores ISO without 'Z' suffix */
function toDate(iso: string): Date {
  // If already has timezone info, use as-is
  if (iso.endsWith("Z") || iso.includes("+")) return new Date(iso);
  // Otherwise treat as UTC by appending Z
  return new Date(iso + "Z");
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return toDate(iso).toLocaleString(USER_LOCALE, {
    timeZone: USER_TZ,
    day:      "2-digit",
    month:    "short",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
    second:   "2-digit",
    hour12:   true,
  });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return toDate(iso).toLocaleDateString(USER_LOCALE, {
    timeZone: USER_TZ,
    day:      "2-digit",
    month:    "short",
    year:     "numeric",
  });
}

export function formatTimeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Math.round((Date.now() - toDate(iso).getTime()) / 1000);
  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(iso);
}

export function formatDuration(start?: string, end?: string): string {
  if (!start) return "—";
  const s    = toDate(start).getTime();
  const e    = end ? toDate(end).getTime() : Date.now();
  const diff = Math.round((e - s) / 1000);
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}