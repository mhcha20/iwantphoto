export type MobileAccountMenuItem = {
  id: "library" | "plan" | "profile" | "logout";
  label: string;
  detail?: string;
  destructive?: boolean;
};

export type MobileAccountIdentity = {
  displayName: string;
  initials: string;
};

export function getMobileAccountIdentity(name?: string | null, email?: string | null): MobileAccountIdentity {
  const displayName = name?.trim() || email?.trim().split("@")[0] || "我的帳戶";
  const words = displayName.split(/\s+/).filter(Boolean);
  const initials = words.length > 1
    ? `${words[0].charAt(0)}${words.at(-1)?.charAt(0) ?? ""}`
    : Array.from(displayName).slice(0, 2).join("");

  return {
    displayName,
    initials: initials.toLocaleUpperCase(),
  };
}

export function getMobileAccountMenuItems(planName: string, remainingCredits: number): MobileAccountMenuItem[] {
  return [
    { id: "library", label: "我的相片", detail: "查看已儲存相片" },
    { id: "plan", label: "方案與額度", detail: `${planName} · 尚餘 ${remainingCredits} 張` },
    { id: "profile", label: "管理帳戶資料", detail: "名稱、登入電郵及登入紀錄" },
    { id: "logout", label: "登出", destructive: true },
  ];
}
