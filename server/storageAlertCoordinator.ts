import { canSendStorageAlertEmails, sendStorageAlertEmail } from "./storageAlertEmail";
import { getHighestStorageAlertThreshold } from "./storageAlertPolicy";

export type StorageAlertNotificationInput = {
  userId: number;
  email: string | null | undefined;
  name: string | null | undefined;
  alertsEnabled: boolean;
  alertCycle: number;
  usedBytes: number;
  allowanceBytes: number;
};

type StorageAlertNotificationDependencies = {
  reserve: (userId: number, threshold: number, cycle: number) => Promise<boolean>;
  markSent: (userId: number, threshold: number, cycle: number) => Promise<void>;
  release: (userId: number, threshold: number, cycle: number) => Promise<void>;
  send?: typeof sendStorageAlertEmail;
  deliveryReady?: () => boolean;
};

export async function notifyStorageCapacityIfNeeded(input: StorageAlertNotificationInput, dependencies: StorageAlertNotificationDependencies) {
  const threshold = getHighestStorageAlertThreshold(input.usedBytes, input.allowanceBytes);
  if (!threshold || !input.alertsEnabled || !input.email || !(dependencies.deliveryReady ?? canSendStorageAlertEmails)()) {
    return { notified: false, reason: "not_eligible" as const };
  }

  const reserved = await dependencies.reserve(input.userId, threshold, input.alertCycle);
  if (!reserved) return { notified: false, reason: "already_notified" as const };

  try {
    const send = dependencies.send ?? sendStorageAlertEmail;
    const result = await send({
      recipient: input.email,
      name: input.name,
      userId: input.userId,
      alertCycle: input.alertCycle,
      threshold,
      usedBytes: input.usedBytes,
      allowanceBytes: input.allowanceBytes,
    });
    if (!result.sent) {
      await dependencies.release(input.userId, threshold, input.alertCycle);
      return { notified: false, reason: "delivery_unavailable" as const };
    }
    await dependencies.markSent(input.userId, threshold, input.alertCycle);
    return { notified: true, threshold } as const;
  } catch (error) {
    await dependencies.release(input.userId, threshold, input.alertCycle);
    throw error;
  }
}
