import { describe, expect, it } from "vitest";
import { formatAccountSecurityActivityTime, getAccountSecurityActivityLabel } from "./accountSecurity";

describe("account security activity", () => {
  it("uses clear Cantonese labels for known events", () => {
    expect(getAccountSecurityActivityLabel("signed_in")).toBe("已登入");
    expect(getAccountSecurityActivityLabel("avatar_updated")).toBe("已更新帳戶頭像");
    expect(getAccountSecurityActivityLabel("admin_test_plan_changed")).toBe("已更新本人測試方案");
    expect(getAccountSecurityActivityLabel("unrecognized")).toBe("帳戶活動");
  });

  it("formats recorded activity times through the account date formatter", () => {
    expect(formatAccountSecurityActivityTime(new Date("2026-09-20T00:00:00Z"))).toContain("2026");
  });
});
