import { ENV } from "./_core/env";
import { formatStorageBytes } from "@shared/storagePlans";
import { getStorageAlertCopy, storageUsagePercent, type StorageAlertThreshold } from "./storageAlertPolicy";

type StorageAlertEmailInput = {
  recipient: string | null | undefined;
  name: string | null | undefined;
  userId: number;
  alertCycle: number;
  threshold: StorageAlertThreshold;
  usedBytes: number;
  allowanceBytes: number;
};

export function canSendStorageAlertEmails() {
  return Boolean(ENV.resendApiKey && ENV.resendFromEmail);
}

export function buildStorageAlertEmail(input: StorageAlertEmailInput) {
  const copy = getStorageAlertCopy(input.threshold);
  const percent = storageUsagePercent(input.usedBytes, input.allowanceBytes);
  const greeting = input.name?.trim() ? `${input.name.trim()}，` : "你好，";
  const used = formatStorageBytes(input.usedBytes);
  const allowance = formatStorageBytes(input.allowanceBytes);
  const manageUrl = `${ENV.appBaseUrl}/#plans`;

  return {
    subject: copy.subject,
    text: `${greeting}\n\n${copy.heading}\n\n你的 Iwantphoto 帳戶已使用 ${percent}% 儲存空間（${used}／${allowance}）。${copy.detail}\n\n前往管理容量：${manageUrl}\n\nIwantphoto`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,'PingFang HK','Microsoft JhengHei',sans-serif;color:#18304d"><main style="max-width:600px;margin:0 auto;padding:32px 20px"><section style="background:#fff;border:1px solid #d8e5f1;border-radius:18px;overflow:hidden"><header style="padding:22px 26px;background:#10213b;color:#fff"><strong style="font-size:20px">Iwantphoto</strong><span style="display:block;margin-top:6px;font-size:12px;color:#bcd7ff;letter-spacing:.06em">STORAGE CAPACITY NOTICE</span></header><div style="padding:28px 26px"><p style="margin:0 0 16px;font-size:15px;line-height:1.6">${greeting}</p><h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">${copy.heading}</h1><p style="margin:0;color:#5e7088;font-size:15px;line-height:1.7">你的 Iwantphoto 帳戶已使用 <strong style="color:#1665d8">${percent}%</strong> 儲存空間。</p><div style="margin:20px 0;padding:18px;border-radius:14px;background:${copy.tone === "critical" ? "#fff5f0" : "#f3f8ff"};border:1px solid ${copy.tone === "critical" ? "#f1cbbb" : "#cfe0f7"}"><strong style="font-size:20px;color:#18304d">${used}／${allowance}</strong><div style="margin-top:10px;height:8px;border-radius:99px;background:#e4ebf3;overflow:hidden"><div style="height:100%;width:${percent}%;border-radius:99px;background:${copy.tone === "critical" ? "#d15a3d" : "#1665d8"}"></div></div></div><p style="margin:0;color:#5e7088;font-size:14px;line-height:1.7">${copy.detail}</p><a href="${manageUrl}" style="display:inline-block;margin-top:24px;padding:12px 18px;border-radius:10px;background:#1665d8;color:#fff;text-decoration:none;font-weight:700;font-size:14px">查看相片與容量</a></div><footer style="padding:16px 26px;border-top:1px solid #e4ebf3;color:#7b899b;font-size:12px;line-height:1.5">這是與你的 Iwantphoto 已儲存相片及容量相關的服務通知。你可在「我的相片」管理提醒偏好。</footer></section></main></body></html>`,
  };
}

export async function sendStorageAlertEmail(input: StorageAlertEmailInput) {
  if (!input.recipient || !canSendStorageAlertEmails()) return { sent: false, skipped: true } as const;
  const email = buildStorageAlertEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `iwantphoto-storage-${input.userId}-${input.threshold}-${input.alertCycle}`,
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [input.recipient],
      subject: email.subject,
      text: email.text,
      html: email.html,
      tags: [{ name: "kind", value: "storage_capacity" }, { name: "threshold", value: String(input.threshold) }],
    }),
  });
  if (!response.ok) throw new Error(`Resend storage alert failed (${response.status}): ${await response.text()}`);
  return { sent: true, skipped: false, response: await response.json() } as const;
}
