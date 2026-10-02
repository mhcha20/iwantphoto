export function normaliseAccountDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function formatAccountLastSignedIn(value: Date | string | null | undefined, options?: { locale?: string; timeZone?: string }) {
  if (!value) return "未有登入紀錄";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "未能讀取登入時間";
  return new Intl.DateTimeFormat(options?.locale ?? "zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(date);
}
