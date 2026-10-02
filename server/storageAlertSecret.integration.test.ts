import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { canSendStorageAlertEmails } from "./storageAlertEmail";

describe("Iwantphoto Resend storage alert activation", () => {
  it("authenticates to Resend and verifies the Iwantphoto sender domain", async () => {
    expect(ENV.resendApiKey).toMatch(/^re_/);
    expect(ENV.resendFromEmail).toBe("alerts@iwantphoto.com");
    expect(canSendStorageAlertEmails()).toBe(true);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.resendApiKey}`,
        "Content-Type": "application/json",
      },
      // An intentionally incomplete body validates the restricted sending
      // credential without queuing or delivering an email.
      body: JSON.stringify({ from: ENV.resendFromEmail }),
    });
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  }, 15_000);
});
