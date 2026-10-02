import { describe, expect, it } from "vitest";
import { formatAccountLastSignedIn, normaliseAccountDisplayName } from "./accountProfile";

describe("account profile helpers", () => {
  it("normalizes an editable display name without changing its characters", () => {
    expect(normaliseAccountDisplayName("  陳   文熙  ")).toBe("陳 文熙");
  });

  it("formats the account's last sign-in timestamp and handles absent values", () => {
    expect(formatAccountLastSignedIn(new Date("2026-09-20T00:00:00Z"), { locale: "en-GB", timeZone: "UTC" })).toContain("20 Sept 2026");
    expect(formatAccountLastSignedIn(null)).toBe("未有登入紀錄");
  });
});
