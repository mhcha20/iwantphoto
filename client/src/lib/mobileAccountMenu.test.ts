import { describe, expect, it } from "vitest";
import { getMobileAccountIdentity, getMobileAccountMenuItems } from "./mobileAccountMenu";

describe("mobile account menu", () => {
  it("keeps library, plan status, and sign-out actions available", () => {
    expect(getMobileAccountMenuItems("Pro", 36)).toEqual([
      { id: "library", label: "我的相片", detail: "查看已儲存相片" },
      { id: "plan", label: "方案與額度", detail: "Pro · 尚餘 36 張" },
      { id: "profile", label: "管理帳戶資料", detail: "名稱、登入電郵及登入紀錄" },
      { id: "logout", label: "登出", destructive: true },
    ]);
  });

  it("derives compact initials from names and a safe account fallback", () => {
    expect(getMobileAccountIdentity("Man Hei Chan", "manhey@example.com")).toEqual({ displayName: "Man Hei Chan", initials: "MC" });
    expect(getMobileAccountIdentity("陳文熙", null)).toEqual({ displayName: "陳文熙", initials: "陳文" });
    expect(getMobileAccountIdentity(null, null)).toEqual({ displayName: "我的帳戶", initials: "我的" });
  });
});
