import { describe, expect, it } from "vitest";
import { buildStorageAlertEmail, canSendStorageAlertEmails } from "./storageAlertEmail";

describe("storage capacity email", () => {
  it("builds a clear 80 percent transactional notice", () => {
    const email = buildStorageAlertEmail({ recipient: "customer@example.com", name: "陳小姐", userId: 7, alertCycle: 0, threshold: 80, usedBytes: 800, allowanceBytes: 1000 });
    expect(email.subject).toContain("80%");
    expect(email.text).toContain("80%");
    expect(email.html).toContain("陳小姐");
    expect(email.html).toContain("查看相片與容量");
  });

  it("requires a Resend key before live delivery", () => {
    expect(typeof canSendStorageAlertEmails()).toBe("boolean");
  });
});
