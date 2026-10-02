import { formatAccountLastSignedIn } from "./accountProfile";

export type AccountSecurityActivity = {
  id: number;
  event: string;
  detail: string;
  createdAt: Date | string;
};

const EVENT_LABELS: Record<string, string> = {
  signed_in: "已登入",
  signed_out: "已登出",
  profile_updated: "已更新帳戶資料",
  avatar_updated: "已更新帳戶頭像",
  admin_test_plan_changed: "已更新本人測試方案",
};

export function getAccountSecurityActivityLabel(event: string) {
  return EVENT_LABELS[event] ?? "帳戶活動";
}

export function formatAccountSecurityActivityTime(value: Date | string) {
  return formatAccountLastSignedIn(value);
}
