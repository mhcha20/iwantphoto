import { describe, expect, it } from "vitest";
import { getStripeClient } from "./billing";

describe("Stripe billing credential integration", () => {
  it("authenticates with Stripe using the project-only server secret", async () => {
    const balance = await getStripeClient().balance.retrieve();
    expect(balance.object).toBe("balance");
    expect(Array.isArray(balance.available)).toBe(true);
  }, 20_000);
});
