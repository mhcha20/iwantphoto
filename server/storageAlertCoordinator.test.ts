import { describe, expect, it, vi } from "vitest";
import { notifyStorageCapacityIfNeeded } from "./storageAlertCoordinator";

describe("storage alert coordinator", () => {
  const dependencies = () => ({
    reserve: vi.fn().mockResolvedValue(true),
    markSent: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue({ sent: true, skipped: false }),
    deliveryReady: () => true,
  });

  it("sends and records only the highest reached threshold", async () => {
    const mocks = dependencies();
    await expect(notifyStorageCapacityIfNeeded({ userId: 7, email: "customer@example.com", name: "Customer", alertsEnabled: true, alertCycle: 2, usedBytes: 960, allowanceBytes: 1000 }, mocks)).resolves.toEqual({ notified: true, threshold: 95 });
    expect(mocks.reserve).toHaveBeenCalledWith(7, 95, 2);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ threshold: 95, userId: 7, alertCycle: 2 }));
    expect(mocks.markSent).toHaveBeenCalledWith(7, 95, 2);
  });

  it("does not send when disabled or below the first threshold", async () => {
    const mocks = dependencies();
    await expect(notifyStorageCapacityIfNeeded({ userId: 7, email: "customer@example.com", name: null, alertsEnabled: false, alertCycle: 0, usedBytes: 900, allowanceBytes: 1000 }, mocks)).resolves.toMatchObject({ notified: false });
    await expect(notifyStorageCapacityIfNeeded({ userId: 7, email: "customer@example.com", name: null, alertsEnabled: true, alertCycle: 0, usedBytes: 700, allowanceBytes: 1000 }, mocks)).resolves.toMatchObject({ notified: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("releases the alert reservation after an email delivery error", async () => {
    const mocks = dependencies();
    mocks.send.mockRejectedValue(new Error("provider unavailable"));
    await expect(notifyStorageCapacityIfNeeded({ userId: 7, email: "customer@example.com", name: null, alertsEnabled: true, alertCycle: 0, usedBytes: 800, allowanceBytes: 1000 }, mocks)).rejects.toThrow("provider unavailable");
    expect(mocks.release).toHaveBeenCalledWith(7, 80, 0);
  });

  it("does not send a duplicate notice after the threshold was reserved", async () => {
    const mocks = dependencies();
    mocks.reserve.mockResolvedValue(false);
    await expect(notifyStorageCapacityIfNeeded({ userId: 7, email: "customer@example.com", name: null, alertsEnabled: true, alertCycle: 3, usedBytes: 810, allowanceBytes: 1000 }, mocks)).resolves.toEqual({ notified: false, reason: "already_notified" });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.markSent).not.toHaveBeenCalled();
  });
});
