import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { UnalignedEditError } from "./_core/imageEditErrors";
import { KEY_COLOR_PROMPT, pickKeyColor } from "./imagePostProcess";
import { generateMarketplaceImage, getMarketplaceImageGenerationDiagnostic, getMarketplaceImageRecoveryMessage } from "./marketplaceImageGeneration";
import { inspectMarketplaceCompositionFromUrl } from "./marketplaceCompositionQuality";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getManagedStorageKey, storageGetSignedUrl, storagePut } from "./storage";
import { assignImageToProject, countUserProcessingUsageSince, createMarketplaceBrandPreset, createMarketplaceWorkflow, createPhotoProject, createUserImage, getAdminWorkspaceOverview, getMarketplaceBrandPresetForUser, getPhotoProjectForUser, getUserImageForUser, getUserImageStorageBytes, getUserProjectStorageSummary, listAccountSecurityEvents, listMarketplaceBrandPresets, listMarketplaceWorkflows, listPhotoProjects, listSavedMarketplaceProducts, listUserImages, listUserImagesMissingStorageBytes, listUserProcessingUsageSince, markStorageUsageAlertSent, rearmStorageUsageAlerts, recordAccountSecurityEvent, recordProcessingUsage, refundPrepaidCredit, releaseStorageUsageAlert, removeMarketplaceBrandPreset, removeMarketplaceWorkflow, removeUnclassifiedUserImages, removeUserImage, reserveStorageUsageAlert, setMarketplaceBrandPresetDefault, setPhotoProjectBrandPreset, setStorageEmailAlertsEnabled, spendPrepaidCredit, updateAdminTestPlan, updateMarketplaceBrandPreset, updateUserAvatarUrl, updateUserDisplayName, updateUserImageProcessed, updateUserImageStorageBytes, upsertSavedMarketplaceProduct } from "./db";
import { ACCOUNT_PLANS, getEffectiveAccountPlan, getPlanAllowance } from "@shared/plans";
import { createCreditPackCheckout, createCustomerPortal, createStorageAddOnCheckout, createSubscriptionCheckout, shouldGrantSubscriptionEntitlement } from "./billing";
import { CREDIT_PACKS } from "@shared/creditPacks";
import { formatStorageBytes, storageAllowanceBytes, STORAGE_ADD_ONS } from "@shared/storagePlans";
import { ENV } from "./_core/env";
import { notifyStorageCapacityIfNeeded } from "./storageAlertCoordinator";
import { shouldRearmStorageAlerts } from "./storageAlertPolicy";
import { refreshStoredImageSizes } from "./imageStorageMetering";
import { MARKETPLACE_CHANNELS, MARKETPLACE_SUITE_CREDIT_COST, buildMarketplaceImagePrompt, getMarketplaceSuite, getMarketplaceSuiteCreditCost, getMarketplaceSuiteSelection, isMarketplaceChannel, isMarketplaceLifestyleStyle, normaliseMarketplaceBrandStyle, type MarketplaceChannel, type MarketplaceImageRole, type MarketplaceLifestyleStyle } from "@shared/marketplaceSuites";
import { createGoogleMerchantAiImage } from "./googleMerchantMetadata";
import { draftMarketplaceProductBrief } from "./marketplaceProductDraft";
import { draftMarketplaceListingCopy } from "./marketplaceListingCopy";
import { getMarketplaceDetailSpecificationLines, isMarketplaceProductBriefReady, type MarketplaceLifestyleSceneCandidate } from "@shared/marketplaceProductBrief";
import { normaliseMarketplaceWorkflowName } from "@shared/marketplaceWorkflows";
import { createAccountAvatar } from "./accountAvatar";
import { isValidTouchUpPng } from "./touchUp";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_STORAGE_RESERVATION_BYTES = MAX_IMAGE_BYTES * 2;
const MAX_BRAND_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_ACCOUNT_AVATAR_DATA_URL_LENGTH = 2_900_000;
const BRAND_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const marketplaceProductBriefInput = z.object({
  productName: z.string().max(100),
  summary: z.string().max(600),
  weight: z.string().max(80).optional().default(""),
  dimensions: z.string().max(80).optional().default(""),
  confirmedFacts: z.array(z.string().max(180)).max(6),
  visualHighlights: z.array(z.string().max(180)).max(6),
  usageIdeas: z.array(z.string().max(180)).max(6),
});
const marketplaceLifestyleSceneInput = z.object({
  id: z.string().trim().min(1).max(48),
  style: z.string().refine(isMarketplaceLifestyleStyle, "請選擇支援的情境風格。"),
  title: z.string().trim().min(1).max(48),
  description: z.string().trim().min(1).max(140),
});
const marketplaceSavedProductBriefInput = marketplaceProductBriefInput.extend({
  reviewQuestions: z.array(z.string().max(180)).max(6),
});
const thailandMarketplaceListingFieldsInput = z.object({
  description: z.string().max(3000),
  categoryPath: z.string().max(180),
  brand: z.string().max(100),
  packageWeightKg: z.string().max(24),
  packageLengthCm: z.string().max(24),
  packageWidthCm: z.string().max(24),
  packageHeightCm: z.string().max(24),
  variation: z.string().max(240),
  whatsInTheBox: z.string().max(500),
  categoryAttributes: z.string().max(1000),
});
const marketplaceListingCopyInput = z.object({
  channel: z.string().refine(isMarketplaceChannel, "請選擇支援的銷售平台。"),
  title: z.string().max(255),
  bullets: z.array(z.string().max(240)).max(5),
  reviewNotes: z.array(z.string().max(180)).max(4),
  thailandFields: thailandMarketplaceListingFieldsInput.nullable().optional(),
});
const marketplaceReferenceImageInput = z.object({
  imageData: z.string().min(32).max(17_000_000),
  mimeType: z.string().min(3).max(80),
  fileName: z.string().min(1).max(160),
});
const marketplaceSelectedRolesInput = z.array(z.enum(["main", "studio", "detail", "lifestyle"])).min(1).max(4);
const marketplaceBrandStyleInput = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontStyle: z.enum(["clean", "editorial", "friendly"]),
});
const marketplaceBrandPresetInput = marketplaceBrandStyleInput.extend({
  name: z.string().trim().min(1).max(60),
  logoData: z.string().min(32).max(2_900_000).optional(),
  logoMimeType: z.string().min(3).max(80).optional(),
  removeLogo: z.boolean().optional(),
});
const marketplaceWorkflowInput = z.object({
  name: z.string().trim().min(1).max(60),
  channel: z.string().refine(isMarketplaceChannel, "請選擇支援的銷售平台。"),
  selectedRoles: marketplaceSelectedRolesInput,
  lifestyleStyle: z.string().refine(isMarketplaceLifestyleStyle, "請選擇支援的情境風格。"),
  projectId: z.number().int().positive().nullable(),
  brandPresetId: z.number().int().positive().nullable(),
  useCustomBrandStyle: z.boolean(),
  brandStyle: marketplaceBrandStyleInput,
});

function getCurrentMonthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function decodeImage(dataUrl: string, fallbackMimeType: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "相片格式不正確，請重新選擇檔案。" });

  const mimeType = match[1] || fallbackMimeType;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "相片必須小於 12 MB。" });
  }
  return { buffer, mimeType };
}

function safeFileName(fileName: string) {
  const normalized = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return normalized || "iwantphoto-image.jpg";
}

async function saveMarketplaceBrandLogo(userId: number, logoData?: string, logoMimeType?: string) {
  if (!logoData) return undefined;
  if (!logoMimeType || !BRAND_LOGO_MIME_TYPES.includes(logoMimeType as typeof BRAND_LOGO_MIME_TYPES[number])) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "品牌 Logo 請使用 PNG、JPG 或 WEBP 檔案。" });
  }
  const { buffer, mimeType } = decodeImage(logoData, logoMimeType);
  if (!BRAND_LOGO_MIME_TYPES.includes(mimeType as typeof BRAND_LOGO_MIME_TYPES[number]) || buffer.length > MAX_BRAND_LOGO_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "品牌 Logo 必須為 PNG、JPG 或 WEBP，並小於 2 MB。" });
  }
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return storagePut(`iwantphoto/brand-logos/${userId}/${nanoid(12)}.${extension}`, buffer, mimeType);
}

function getTrustedAppOrigin(request: { headers: Record<string, unknown> }) {
  const rawOrigin = request.headers.origin;
  if (typeof rawOrigin === "string" && rawOrigin === ENV.appBaseUrl) return rawOrigin;
  return ENV.appBaseUrl;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    updateProfile: protectedProcedure
      .input(z.object({ displayName: z.string().trim().min(1, "請輸入顯示名稱。").max(80, "顯示名稱不可超過 80 個字元。") }))
      .mutation(async ({ ctx, input }) => {
        try {
          const displayName = input.displayName.replace(/\s+/g, " ");
          const user = await updateUserDisplayName(ctx.user.id, displayName);
          if (!user) throw new Error("Updated account was not found");
          try {
            await recordAccountSecurityEvent(ctx.user.id, "profile_updated", "已更新工作台顯示名稱");
          } catch (activityError) {
            console.warn("[iwantphoto auth] unable to record profile update", activityError);
          }
          return user;
        } catch (error) {
          console.error("[iwantphoto auth] unable to update account profile", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能儲存帳戶資料，請稍後再試。" });
        }
      }),
    updateAvatar: protectedProcedure
      .input(z.object({ imageData: z.string().min(32).max(MAX_ACCOUNT_AVATAR_DATA_URL_LENGTH), mimeType: z.string().min(3).max(80) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const avatar = await createAccountAvatar(input.imageData, input.mimeType);
          const stored = await storagePut(`iwantphoto/account-avatars/${ctx.user.id}/${nanoid(12)}.webp`, avatar.buffer, avatar.mimeType);
          const user = await updateUserAvatarUrl(ctx.user.id, stored.url);
          if (!user) throw new Error("Updated account was not found");
          try {
            await recordAccountSecurityEvent(ctx.user.id, "avatar_updated", "已更新帳戶頭像");
          } catch (activityError) {
            console.warn("[iwantphoto auth] unable to record avatar update", activityError);
          }
          return user;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto auth] unable to update account avatar", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能更新頭像，請稍後再試。" });
        }
      }),
    securityEvents: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listAccountSecurityEvents(ctx.user.id);
      } catch (error) {
        console.error("[iwantphoto auth] unable to list account security events", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入帳戶安全紀錄，請稍後再試。" });
      }
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) {
        try {
          await recordAccountSecurityEvent(ctx.user.id, "signed_out", "已從 Iwantphoto 登出");
        } catch (error) {
          console.warn("[iwantphoto auth] unable to record sign out", error);
        }
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  admin: router({
    overview: adminProcedure.query(async () => {
      try {
        return await getAdminWorkspaceOverview();
      } catch (error) {
        console.error("[iwantphoto admin] unable to load workspace overview", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入管理總覽，請稍後再試。" });
      }
    }),
    selfTestPlan: adminProcedure.query(({ ctx }) => ({
      commercialPlan: ctx.user.plan,
      testPlan: ctx.user.adminTestPlan,
      effectivePlan: getEffectiveAccountPlan(ctx.user),
    })),
    setSelfTestPlan: adminProcedure
      .input(z.object({ plan: z.enum(["starter", "pro", "business"]).nullable() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await updateAdminTestPlan(ctx.user.id, input.plan);
          if (!user) throw new Error("Updated administrator was not found");
          const effectivePlan = getEffectiveAccountPlan(user);
          try {
            await recordAccountSecurityEvent(
              ctx.user.id,
              "admin_test_plan_changed",
              input.plan ? `已啟用 ${ACCOUNT_PLANS[input.plan].name} 本人測試方案（不會更改 Stripe 訂閱或收費）` : "已關閉本人測試方案，回復商業訂閱方案",
            );
          } catch (activityError) {
            console.warn("[iwantphoto admin] unable to record test plan update", activityError);
          }
          return { commercialPlan: user.plan, testPlan: user.adminTestPlan, effectivePlan };
        } catch (error) {
          console.error("[iwantphoto admin] unable to update self test plan", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能更新測試方案，請稍後再試。" });
        }
      }),
  }),
  library: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listUserImages(ctx.user.id);
      } catch (error) {
        console.error("[iwantphoto library] unable to list user images", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入我的相片，請稍後再試。" });
      }
    }),
    usage: protectedProcedure.query(async ({ ctx }) => {
      try {
        const plan = getEffectiveAccountPlan(ctx.user);
        const allowance = getPlanAllowance(plan);
        const [used, storageUsedBytes] = await Promise.all([
          countUserProcessingUsageSince(ctx.user.id, getCurrentMonthStart()),
          getUserImageStorageBytes(ctx.user.id),
        ]);
        const storageAllowance = storageAllowanceBytes(plan, ctx.user.storageAddonGb);
        return {
          plan,
          commercialPlan: ctx.user.plan,
          adminTestPlan: ctx.user.adminTestPlan,
          allowance,
          used,
          remaining: Math.max(0, allowance - used),
          creditBalance: ctx.user.creditBalance,
          storage: {
            usedBytes: storageUsedBytes,
            allowanceBytes: storageAllowance,
            remainingBytes: Math.max(0, storageAllowance - storageUsedBytes),
            includedGb: ACCOUNT_PLANS[plan].includedStorageGb,
            addOnGb: ctx.user.storageAddonGb,
            emailAlertsEnabled: ctx.user.storageEmailAlertsEnabled === 1,
            emailAlertsAvailable: Boolean(ENV.resendApiKey),
          },
        };
      } catch (error) {
        console.error("[iwantphoto library] unable to calculate account usage", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入本月額度，請稍後再試。" });
      }
    }),
    usageTimeline: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listUserProcessingUsageSince(ctx.user.id, getCurrentMonthStart());
      } catch (error) {
        console.error("[iwantphoto library] unable to list monthly processing usage", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入本月處理紀錄，請稍後再試。" });
      }
    }),
    projectStorage: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getUserProjectStorageSummary(ctx.user.id);
      } catch (error) {
        console.error("[iwantphoto library] unable to calculate project storage", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入專案儲存統計，請稍後再試。" });
      }
    }),
    refreshStorageMetering: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return await refreshStoredImageSizes(ctx.user.id, {
          listMissing: listUserImagesMissingStorageBytes,
          update: updateUserImageStorageBytes,
        });
      } catch (error) {
        console.error("[iwantphoto library] unable to refresh saved image storage sizes", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能重新計算已儲存相片大小，請稍後再試。" });
      }
    }),
    setStorageEmailAlerts: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await setStorageEmailAlertsEnabled(ctx.user.id, input.enabled);
          return { enabled: user?.storageEmailAlertsEnabled === 1 };
        } catch (error) {
          console.error("[iwantphoto library] unable to update storage alerts", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能更新電郵提醒設定，請稍後再試。" });
        }
      }),
    remove: protectedProcedure
      .input(z.object({ imageId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const removed = await removeUserImage(ctx.user.id, input.imageId);
          if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此已儲存相片。" });
          const [usedBytes, user] = await Promise.all([getUserImageStorageBytes(ctx.user.id), Promise.resolve(ctx.user)]);
          const allowanceBytes = storageAllowanceBytes(getEffectiveAccountPlan(user), user.storageAddonGb);
          if (shouldRearmStorageAlerts(usedBytes, allowanceBytes)) await rearmStorageUsageAlerts(ctx.user.id);
          return { removed: true } as const;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto library] unable to remove user image", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能移除相片，請稍後再試。" });
        }
      }),
    removeUnclassified: protectedProcedure
      .input(z.object({ imageIds: z.array(z.number().int().positive()).min(1).max(60) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const removed = await removeUnclassifiedUserImages(ctx.user.id, input.imageIds);
          const usedBytes = await getUserImageStorageBytes(ctx.user.id);
          const allowanceBytes = storageAllowanceBytes(getEffectiveAccountPlan(ctx.user), ctx.user.storageAddonGb);
          if (shouldRearmStorageAlerts(usedBytes, allowanceBytes)) await rearmStorageUsageAlerts(ctx.user.id);
          return { removed };
        } catch (error) {
          console.error("[iwantphoto library] unable to remove unclassified saved images", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能移除未分類相片，請稍後再試。" });
        }
      }),
  }),
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listPhotoProjects(ctx.user.id);
      } catch (error) {
        console.error("[iwantphoto projects] unable to list projects", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入專案分類，請稍後再試。" });
      }
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(60),
        clientName: z.string().trim().max(60).nullable().optional(),
        description: z.string().trim().max(160).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const name = input.name.replace(/\s+/g, " ");
        const clientName = input.clientName?.replace(/\s+/g, " ") || null;
        const description = input.description?.replace(/\s+/g, " ") || null;
        try {
          const project = await createPhotoProject({ userId: ctx.user.id, name, clientName, description });
          if (!project) throw new Error("Project creation returned no record");
          return project;
        } catch (error) {
          console.error("[iwantphoto projects] unable to create project", error);
          throw new TRPCError({ code: "CONFLICT", message: "同名專案已存在，請使用另一個名稱。" });
        }
      }),
    assignImage: protectedProcedure
      .input(z.object({ imageId: z.number().int().positive(), projectId: z.number().int().positive().nullable() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const image = await assignImageToProject(ctx.user.id, input.imageId, input.projectId);
          if (!image) throw new TRPCError({ code: "NOT_FOUND", message: "找不到指定相片或專案。" });
          return image;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto projects] unable to assign image", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能更新相片分類，請稍後再試。" });
        }
      }),
    setBrandPreset: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), presetId: z.number().int().positive().nullable() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const project = await setPhotoProjectBrandPreset(ctx.user.id, input.projectId, input.presetId);
          if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "找不到指定專案或品牌預設。" });
          return project;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto projects] unable to update project brand preset", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能更新專案品牌預設，請稍後再試。" });
        }
      }),
  }),
  billing: router({
    status: protectedProcedure.query(({ ctx }) => ({
      plan: getEffectiveAccountPlan(ctx.user),
      commercialPlan: ctx.user.plan,
      adminTestPlan: ctx.user.adminTestPlan,
      subscriptionStatus: ctx.user.subscriptionStatus,
      hasCustomerPortal: Boolean(ctx.user.stripeCustomerId),
      billingEnabled: ENV.stripeBillingEnabled,
      creditBalance: ctx.user.creditBalance,
      storageAddonGb: ctx.user.storageAddonGb,
      storageSubscriptionStatus: ctx.user.storageSubscriptionStatus,
    })),
    createCheckout: protectedProcedure
      .input(z.object({ plan: z.enum(["pro", "business"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.stripeBillingEnabled) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "付款服務正在完成安全驗證，暫時未開放結帳。" });
        }
        try {
          return {
            url: await createSubscriptionCheckout({
              userId: ctx.user.id,
              email: ctx.user.email,
              stripeCustomerId: ctx.user.stripeCustomerId,
              plan: input.plan,
              origin: getTrustedAppOrigin(ctx.req),
            }),
          };
        } catch (error) {
          console.error("[iwantphoto billing] checkout could not be created", error);
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "付款服務尚未完成設定，請稍後再試。" });
        }
      }),
    createPortal: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ENV.stripeBillingEnabled) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "付款管理服務正在完成安全驗證，暫時未開放。" });
      }
      if (!ctx.user.stripeCustomerId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "尚未有有效訂閱可管理；請先選擇方案。" });
      }
      try {
        return { url: await createCustomerPortal({ stripeCustomerId: ctx.user.stripeCustomerId, origin: getTrustedAppOrigin(ctx.req) }) };
      } catch (error) {
        console.error("[iwantphoto billing] portal could not be created", error);
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "付款管理服務尚未完成設定，請稍後再試。" });
      }
    }),
    createStorageCheckout: protectedProcedure
      .input(z.object({ addOn: z.enum(["archive_50", "archive_200", "archive_1000"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.stripeBillingEnabled) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "付款服務正在完成安全驗證，暫時未開放結帳。" });
        }
        if (ctx.user.stripeStorageSubscriptionId && shouldGrantSubscriptionEntitlement(ctx.user.storageSubscriptionStatus)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "你已有儲存空間訂閱；請先在付款管理更新或取消現有容量。" });
        }
        try {
          return {
            url: await createStorageAddOnCheckout({
              userId: ctx.user.id,
              email: ctx.user.email,
              stripeCustomerId: ctx.user.stripeCustomerId,
              addOn: input.addOn,
              origin: getTrustedAppOrigin(ctx.req),
            }),
            capacityGb: STORAGE_ADD_ONS[input.addOn].capacityGb,
          };
        } catch (error) {
          console.error("[iwantphoto billing] storage checkout could not be created", error);
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "暫時未能開啟儲存空間付款頁，請稍後再試。" });
        }
      }),
    createCreditCheckout: protectedProcedure
      .input(z.object({ pack: z.enum(["flex_25", "value_100", "studio_250"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.stripeBillingEnabled) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "付款服務正在完成安全驗證，暫時未開放結帳。" });
        }
        try {
          return {
            url: await createCreditPackCheckout({
              userId: ctx.user.id,
              email: ctx.user.email,
              stripeCustomerId: ctx.user.stripeCustomerId,
              pack: input.pack,
              origin: getTrustedAppOrigin(ctx.req),
            }),
            credits: CREDIT_PACKS[input.pack].credits,
          };
        } catch (error) {
          console.error("[iwantphoto billing] credit checkout could not be created", error);
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "暫時未能開啟加購付款頁，請稍後再試。" });
        }
      }),
  }),
  marketplace: router({
    brandDefaults: protectedProcedure.query(async ({ ctx }) => {
      try {
        const presets = await listMarketplaceBrandPresets(ctx.user.id);
        const preference = presets.find((preset) => preset.isDefault === 1) ?? presets[0];
        return {
          brandStyle: normaliseMarketplaceBrandStyle(preference ?? undefined),
          hasSavedDefault: Boolean(preference),
        };
      } catch (error) {
        console.error("[iwantphoto marketplace] unable to load brand defaults", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入品牌預設，請稍後再試。" });
      }
    }),
    saveBrandDefaults: protectedProcedure
      .input(marketplaceBrandStyleInput)
      .mutation(async ({ ctx, input }) => {
        const brandStyle = normaliseMarketplaceBrandStyle(input);
        try {
          const presets = await listMarketplaceBrandPresets(ctx.user.id);
          const current = presets.find((preset) => preset.isDefault === 1) ?? presets[0];
          if (current) {
            await updateMarketplaceBrandPreset({ userId: ctx.user.id, presetId: current.id, name: current.name, ...brandStyle });
          } else {
            await createMarketplaceBrandPreset({ userId: ctx.user.id, name: "我的品牌", ...brandStyle, setAsDefault: true });
          }
          return { brandStyle };
        } catch (error) {
          console.error("[iwantphoto marketplace] unable to save brand defaults", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能儲存品牌預設，請稍後再試。" });
        }
      }),
    workflows: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        try {
          return await listMarketplaceWorkflows(ctx.user.id);
        } catch (error) {
          console.error("[iwantphoto marketplace] unable to list workflow templates", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入常用工作流程，請稍後再試。" });
        }
      }),
      create: protectedProcedure
        .input(marketplaceWorkflowInput)
        .mutation(async ({ ctx, input }) => {
          try {
            if (input.projectId && !(await getPhotoProjectForUser(ctx.user.id, input.projectId))) {
              throw new TRPCError({ code: "NOT_FOUND", message: "指定專案不存在或不屬於目前帳戶。" });
            }
            if (input.brandPresetId && !(await getMarketplaceBrandPresetForUser(ctx.user.id, input.brandPresetId))) {
              throw new TRPCError({ code: "NOT_FOUND", message: "指定品牌預設不存在或不屬於目前帳戶。" });
            }
            const workflow = await createMarketplaceWorkflow({
              userId: ctx.user.id,
              name: normaliseMarketplaceWorkflowName(input.name),
              channel: input.channel as MarketplaceChannel,
              selectedRoles: input.selectedRoles,
              lifestyleStyle: input.lifestyleStyle as MarketplaceLifestyleStyle,
              projectId: input.projectId,
              brandPresetId: input.useCustomBrandStyle ? null : input.brandPresetId,
              useCustomBrandStyle: input.useCustomBrandStyle,
              brandStyle: normaliseMarketplaceBrandStyle(input.brandStyle),
            });
            if (!workflow) throw new Error("Workflow template creation returned no record");
            return workflow;
          } catch (error) {
            if (error instanceof TRPCError) throw error;
            console.error("[iwantphoto marketplace] unable to save workflow template", error);
            throw new TRPCError({ code: "CONFLICT", message: "未能儲存流程；請使用另一個名稱或稍後再試。" });
          }
        }),
      remove: protectedProcedure
        .input(z.object({ workflowId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          try {
            const removed = await removeMarketplaceWorkflow(ctx.user.id, input.workflowId);
            if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這個已儲存流程。" });
            return { removed: true } as const;
          } catch (error) {
            if (error instanceof TRPCError) throw error;
            console.error("[iwantphoto marketplace] unable to remove workflow template", error);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能刪除已儲存流程，請稍後再試。" });
          }
        }),
    }),
    savedProducts: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        try {
          const project = await getPhotoProjectForUser(ctx.user.id, input.projectId);
          if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這個專案。" });
          return await listSavedMarketplaceProducts(ctx.user.id, input.projectId);
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto marketplace] unable to list saved products", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入已儲存產品資料，請稍後再試。" });
        }
      }),
    saveProduct: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(),
        sku: z.string().trim().min(1).max(80),
        productBrief: marketplaceSavedProductBriefInput,
        listingCopy: marketplaceListingCopyInput.nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isMarketplaceProductBriefReady(input.productBrief)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "請先確認產品名稱及產品描述，才儲存 SKU 資料。" });
        }
        try {
          const project = await getPhotoProjectForUser(ctx.user.id, input.projectId);
          if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這個專案。" });
          const product = await upsertSavedMarketplaceProduct({
            userId: ctx.user.id,
            projectId: input.projectId,
            sku: input.sku,
            brief: input.productBrief,
            listingCopy: input.listingCopy ? { ...input.listingCopy, channel: input.listingCopy.channel as MarketplaceChannel } : null,
          });
          if (!product) throw new Error("Saved product upsert returned no record");
          return product;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto marketplace] unable to save product", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能儲存 SKU 資料，請稍後再試。" });
        }
      }),
    presets: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listMarketplaceBrandPresets(ctx.user.id);
      } catch (error) {
        console.error("[iwantphoto marketplace] unable to list brand presets", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能載入品牌預設，請稍後再試。" });
      }
    }),
    createPreset: protectedProcedure
      .input(marketplaceBrandPresetInput.extend({ setAsDefault: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const logo = await saveMarketplaceBrandLogo(ctx.user.id, input.logoData, input.logoMimeType);
          const brandStyle = normaliseMarketplaceBrandStyle(input);
          const preset = await createMarketplaceBrandPreset({
            userId: ctx.user.id,
            name: input.name.replace(/\s+/g, " "),
            ...brandStyle,
            logoUrl: logo?.url,
            logoMimeType: logo ? input.logoMimeType : null,
            setAsDefault: input.setAsDefault,
          });
          if (!preset) throw new Error("Brand preset creation returned no record");
          return preset;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto marketplace] unable to create brand preset", error);
          throw new TRPCError({ code: "CONFLICT", message: "未能建立品牌預設；請使用另一個名稱或稍後再試。" });
        }
      }),
    updatePreset: protectedProcedure
      .input(marketplaceBrandPresetInput.extend({ presetId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const existing = await getMarketplaceBrandPresetForUser(ctx.user.id, input.presetId);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這個品牌預設。" });
          const logo = await saveMarketplaceBrandLogo(ctx.user.id, input.logoData, input.logoMimeType);
          const brandStyle = normaliseMarketplaceBrandStyle(input);
          const preset = await updateMarketplaceBrandPreset({
            userId: ctx.user.id,
            presetId: input.presetId,
            name: input.name.replace(/\s+/g, " "),
            ...brandStyle,
            logoUrl: logo?.url,
            logoMimeType: logo ? input.logoMimeType : null,
            removeLogo: input.removeLogo,
          });
          if (!preset) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這個品牌預設。" });
          return preset;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto marketplace] unable to update brand preset", error);
          throw new TRPCError({ code: "CONFLICT", message: "未能更新品牌預設；請使用另一個名稱或稍後再試。" });
        }
      }),
    setDefaultPreset: protectedProcedure
      .input(z.object({ presetId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const preset = await setMarketplaceBrandPresetDefault(ctx.user.id, input.presetId);
        if (!preset) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這個品牌預設。" });
        return preset;
      }),
    removePreset: protectedProcedure
      .input(z.object({ presetId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const removed = await removeMarketplaceBrandPreset(ctx.user.id, input.presetId);
        if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這個品牌預設。" });
        return { removed: true } as const;
      }),
  }),
  editor: router({
    process: publicProcedure
      .input(z.object({
        imageData: z.string().min(32).max(17_000_000),
        fileName: z.string().min(1).max(160),
        mimeType: z.string().min(3).max(80),
        mode: z.enum(["background", "cleanup"]),
        backgroundStyle: z.enum(["transparent", "white"]),
        cleanupNote: z.string().max(500).optional(),
        maskData: z.string().min(32).max(17_000_000).optional(),
        projectId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let requiresPrepaidCredit = false;
        let consumedPrepaidCredit = false;
        let monthlyAllowance = 0;
        if (ctx.user) {
          const effectivePlan = getEffectiveAccountPlan(ctx.user);
          const allowance = getPlanAllowance(effectivePlan);
          monthlyAllowance = allowance;
          const used = await countUserProcessingUsageSince(ctx.user.id, getCurrentMonthStart());
          if (used >= allowance) {
            if (ctx.user.creditBalance < 1) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: `本月 ${effectivePlan === "starter" ? "Starter" : effectivePlan === "pro" ? "Pro" : "Business"} 方案的 ${monthlyAllowance} 張額度及加購額度已用完。`,
              });
            }
            requiresPrepaidCredit = true;
          }
          if (input.projectId) {
            const project = await getPhotoProjectForUser(ctx.user.id, input.projectId);
            if (!project) throw new TRPCError({ code: "BAD_REQUEST", message: "所選專案不存在或不屬於目前帳戶。" });
          }
        } else if (input.projectId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入，再將相片儲存到專案。" });
        }
        const { buffer, mimeType } = decodeImage(input.imageData, input.mimeType);
        if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "請使用 JPG、PNG、WEBP 或可轉換的 HEIC 相片。" });
        }
        if (ctx.user) {
          const storageUsedBytes = await getUserImageStorageBytes(ctx.user.id);
          const storageAllowance = storageAllowanceBytes(getEffectiveAccountPlan(ctx.user), ctx.user.storageAddonGb);
          if (storageUsedBytes + MAX_STORAGE_RESERVATION_BYTES > storageAllowance) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `儲存空間不足：現已使用 ${formatStorageBytes(storageUsedBytes)}，可用上限為 ${formatStorageBytes(storageAllowance)}。請刪除已儲存相片或加購容量後再試。`,
            });
          }
        }

        const fileKey = `iwantphoto/uploads/${nanoid(12)}-${safeFileName(input.fileName)}`;
        const { key: storedKey, url: storedUrl } = await storagePut(fileKey, buffer, mimeType);
        const sourceUrl = await storageGetSignedUrl(storedKey);

        const mask = input.mode === "cleanup" && input.maskData ? decodeImage(input.maskData, "image/png") : null;
        if (mask && mask.mimeType !== "image/png") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "筆刷選取範圍必須是 PNG 格式。" });
        }
        const maskKey = mask
          ? (await storagePut(`iwantphoto/masks/${nanoid(12)}.png`, mask.buffer, "image/png")).key
          : undefined;
        const maskUrl = maskKey ? await storageGetSignedUrl(maskKey) : undefined;

        // Background removal: the model only marks the subject on a flat key colour the photo does not use.
        // The final image is cut from the original pixels, re-aligned to the original geometry (see imageAlignment).
        const keyColor = input.mode === "background" ? await pickKeyColor(buffer).catch(() => "green" as const) : undefined;

        const prompt = input.mode === "background"
          ? `Perform a pixel-position-preserving commercial image edit, not a creative regeneration. First identify the primary business-relevant subject or subjects, such as a product, food item, person, property, interior, storefront, vehicle, document, or display. Preserve every selected subject exactly as photographed: its shape, proportions, materials, colors, labels, logos, meaningful text, lighting, shadows, perspective, pixel position, centre point, bounding box, scale, and rotation. The output must be geometrically registered to the input: every retained element must remain at the exact same x/y coordinates on the canvas. Remove only the surrounding background and unrelated environment. Deliver the subject as a clean standalone image on ${KEY_COLOR_PROMPT[keyColor ?? "green"]}; the background will be removed automatically, so keep the subject edges crisp and never let the background colour appear on the subject. Keep exactly the original input canvas dimensions, aspect ratio, and orientation. Do not crop, rotate, expand, reframe, move, resize, reposition, or reconstruct any retained object. Do not add, replace, translate, or alter text, labels, logos, products, people, objects, frames, or watermarks. If the subject boundary is unclear, preserve more of the original image rather than removing meaningful content.`
          : `Perform a pixel-position-preserving commercial image edit, not a creative regeneration. Remove only the requested content: ${input.cleanupNote || "unwanted small objects or distractions"}. ${maskUrl ? "A second reference image is provided as a transparent PNG selection mask. Its red painted strokes mark the exact areas that must be removed; treat those strokes as authoritative, do not render the mask in the final image, and do not remove content outside the marked areas unless it is explicitly named in the request." : "No selection mask was provided, so limit the edit strictly to the written request."} Reconstruct only the removed area naturally using the immediately surrounding image context, matching texture, lighting, color, depth, and perspective. Preserve every non-target element exactly as photographed, including the main subject, product details, labels, logos, meaningful text, people, hands, interiors, storefronts, and background elements that were not requested for removal. The output must be geometrically registered to the input: every retained element must remain at the exact same x/y coordinates on the canvas, with unchanged centre point, bounding box, scale, rotation, and perspective. Keep exactly the original input canvas dimensions, aspect ratio, and orientation. Do not crop, rotate, expand, reframe, move, resize, reposition, or reconstruct retained content. If the requested content is not clearly present, leave the image unchanged rather than inventing an edit. Do not add, replace, translate, or alter text, labels, logos, products, people, objects, frames, or watermarks.`;

        try {
          if (ctx.user && requiresPrepaidCredit) {
            const spend = await spendPrepaidCredit(ctx.user.id);
            consumedPrepaidCredit = spend.spent;
            if (!consumedPrepaidCredit) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: `本月 ${getEffectiveAccountPlan(ctx.user) === "starter" ? "Starter" : getEffectiveAccountPlan(ctx.user) === "pro" ? "Pro" : "Business"} 方案的 ${monthlyAllowance} 張額度及加購額度已用完。`,
              });
            }
          }
          const { url, byteSize: processedBytes = 0 } = await generateImage({
            prompt,
            originalImages: [
              { url: sourceUrl, mimeType },
              ...(maskUrl ? [{ url: maskUrl, mimeType: "image/png" }] : []),
            ],
            inPlace: input.mode === "background"
              ? { kind: "cutout", keyColor: keyColor ?? "green", background: input.backgroundStyle }
              : { kind: "cleanup", selectionIndex: maskUrl ? 1 : undefined },
          });
          if (!url) throw new Error("AI image service returned no image URL");
          if (ctx.user) await recordProcessingUsage({ userId: ctx.user.id, source: `editor_${input.mode}` });
          let savedImageId: number | undefined;
          if (ctx.user) {
            try {
              const savedImage = await createUserImage({
                userId: ctx.user.id,
                projectId: input.projectId ?? null,
                fileName: input.fileName,
                mimeType,
                originalUrl: storedUrl,
                processedUrl: url,
                originalBytes: buffer.length,
                processedBytes,
                mode: input.mode,
                backgroundStyle: input.backgroundStyle,
                cleanupNote: input.mode === "cleanup" ? input.cleanupNote?.trim() || null : null,
              });
              savedImageId = savedImage?.id;
              const usedBytes = await getUserImageStorageBytes(ctx.user.id);
              const allowanceBytes = storageAllowanceBytes(getEffectiveAccountPlan(ctx.user), ctx.user.storageAddonGb);
              try {
                await notifyStorageCapacityIfNeeded({
                  userId: ctx.user.id,
                  email: ctx.user.email,
                  name: ctx.user.name,
                  alertsEnabled: ctx.user.storageEmailAlertsEnabled === 1,
                  alertCycle: ctx.user.storageAlertCycle,
                  usedBytes,
                  allowanceBytes,
                }, {
                  reserve: reserveStorageUsageAlert,
                  markSent: markStorageUsageAlertSent,
                  release: releaseStorageUsageAlert,
                });
              } catch (alertError) {
                console.error("[iwantphoto storage] capacity email could not be delivered", alertError);
              }
            } catch (error) {
              console.error("[iwantphoto library] unable to save completed image", error);
            }
          }
          return { url, originalUrl: storedUrl, ...(typeof savedImageId === "number" ? { savedImageId } : {}) };
        } catch (error) {
          if (ctx.user && consumedPrepaidCredit) {
            try {
              await refundPrepaidCredit(ctx.user.id);
            } catch (refundError) {
              console.error("[iwantphoto billing] unable to refund failed image credit", refundError);
            }
          }
          if (error instanceof TRPCError) throw error;
          console.error("[iwantphoto editor] image processing failed", error);
          if (error instanceof UnalignedEditError) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "處理失敗，請重試。AI 未能準確對齊原圖位置，這次不會扣除額度。" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 修圖服務暫時繁忙，請稍後再試。" });
        }
      }),
    /** Saves a result the user corrected with the restore/erase brush. No AI, no credit. */
    saveTouchUp: protectedProcedure
      .input(z.object({
        imageId: z.number().int().positive(),
        imageData: z.string().min(32).max(17_000_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const record = await getUserImageForUser(ctx.user.id, input.imageId);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這張相片，請重新整理後再試。" });
        const { buffer, mimeType } = decodeImage(input.imageData, "image/png");
        if (mimeType !== "image/png" || !(await isValidTouchUpPng(buffer))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "修補後的相片格式不正確，請再試一次。" });
        }
        try {
          const { url } = await storagePut(`generated/touchup-${Date.now()}.png`, buffer, "image/png");
          await updateUserImageProcessed(ctx.user.id, record.id, { processedUrl: url, processedBytes: buffer.length });
          return { url };
        } catch (error) {
          console.error("[iwantphoto editor] unable to save touch-up", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "暫時未能儲存修補，請稍後再試。" });
        }
      }),
    marketplaceBriefDraft: protectedProcedure
      .input(z.object({
        imageData: z.string().min(32).max(17_000_000),
        mimeType: z.string().min(3).max(80),
        referenceImages: z.array(marketplaceReferenceImageInput).min(1).max(3).optional(),
        currentBrief: marketplaceSavedProductBriefInput.optional(),
        revisionInstruction: z.string().trim().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const referenceInputs = input.referenceImages?.length ? input.referenceImages : [{ imageData: input.imageData, mimeType: input.mimeType, fileName: "product" }];
        const references = referenceInputs.map((reference) => decodeImage(reference.imageData, reference.mimeType));
        if (references.some((reference) => !["image/jpeg", "image/png", "image/webp"].includes(reference.mimeType))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "請使用 JPG、PNG、WEBP 或可轉換的 HEIC 產品相片。" });
        }
        try {
          return await draftMarketplaceProductBrief({
            references,
            currentBrief: input.currentBrief,
            revisionInstruction: input.revisionInstruction,
          });
        } catch (error) {
          console.error("[iwantphoto marketplace] unable to draft product brief", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 暫時未能寫出產品草稿，請稍後再試或自行填寫。" });
        }
      }),
    marketplaceListingCopy: protectedProcedure
      .input(z.object({
        channel: z.string().refine(isMarketplaceChannel, "請選擇支援的銷售平台。"),
        productBrief: marketplaceProductBriefInput,
      }))
      .mutation(async ({ input }) => {
        if (!isMarketplaceProductBriefReady(input.productBrief)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "請先確認產品名稱及產品描述，才建立上架文案。" });
        }
        try {
          return await draftMarketplaceListingCopy({
            channel: input.channel as MarketplaceChannel,
            productBrief: input.productBrief,
          });
        } catch (error) {
          console.error("[iwantphoto marketplace] unable to draft listing copy", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 暫時未能建立上架文案，請稍後再試。" });
        }
      }),
    marketplaceSuite: protectedProcedure
      .input(z.object({
        imageData: z.string().min(32).max(17_000_000),
        fileName: z.string().min(1).max(160),
        mimeType: z.string().min(3).max(80),
        channel: z.string().refine(isMarketplaceChannel, "請選擇支援的銷售平台。"),
        productNote: z.string().max(360).optional(),
        productBrief: marketplaceProductBriefInput.optional(),
        referenceImages: z.array(marketplaceReferenceImageInput).min(1).max(3).optional(),
        selectedRoles: marketplaceSelectedRolesInput.optional(),
        lifestyleStyle: z.string().refine(isMarketplaceLifestyleStyle, "請選擇支援的情境風格。").optional(),
        lifestyleScene: marketplaceLifestyleSceneInput.optional(),
        avoidLifestyleStyles: z.array(z.enum(["home", "office", "outdoor"])).max(3).optional(),
        detailSpecificationLayout: z.enum(["auto", "side_card", "dimension_guide", "bottom_strip"]).optional(),
        brandStyle: marketplaceBrandStyleInput.optional(),
        brandPresetId: z.number().int().positive().optional(),
        useCustomBrandStyle: z.boolean().optional(),
        projectId: z.number().int().positive().optional(),
        retrySourceImageId: z.number().int().positive().optional(),
        redesignInstruction: z.string().trim().min(1).max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const channel = input.channel as MarketplaceChannel;
        if (input.productBrief && !isMarketplaceProductBriefReady(input.productBrief)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "請先確認產品名稱及產品描述，才建立商品套組。" });
        }
        const selectedRoles = getMarketplaceSuiteSelection(input.selectedRoles);
        const lifestyleStyle = input.lifestyleStyle as MarketplaceLifestyleStyle | undefined;
        const lifestyleScene = input.lifestyleScene && input.lifestyleScene.style === lifestyleStyle
          ? input.lifestyleScene as MarketplaceLifestyleSceneCandidate
          : undefined;
        const avoidLifestyleStyles = input.avoidLifestyleStyles
          ?.filter((style, index, styles) => styles.indexOf(style) === index)
          .filter((style) => style !== lifestyleStyle) as MarketplaceLifestyleStyle[] | undefined;
        if (input.retrySourceImageId && selectedRoles.length !== 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "單張重試一次只可建立一張圖片。" });
        }
        const suite = getMarketplaceSuite(channel).filter((item) => selectedRoles.includes(item.role));
        const suiteCreditCost = getMarketplaceSuiteCreditCost(selectedRoles);
        const effectivePlan = getEffectiveAccountPlan(ctx.user);
        const monthlyAllowance = getPlanAllowance(effectivePlan);
        const monthlyUsed = await countUserProcessingUsageSince(ctx.user.id, getCurrentMonthStart());
        const monthlyRemaining = Math.max(0, monthlyAllowance - monthlyUsed);
        const requiredPrepaidCredits = Math.max(0, suiteCreditCost - monthlyRemaining);

        if (ctx.user.creditBalance < requiredPrepaidCredits) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `建立 ${suiteCreditCost} 張商品套組需要 ${suiteCreditCost} 張處理額度；本月尚餘 ${monthlyRemaining} 張，加購額度尚餘 ${ctx.user.creditBalance} 張。`,
          });
        }

        let project: Awaited<ReturnType<typeof getPhotoProjectForUser>> | undefined = undefined;
        if (input.projectId) {
          project = await getPhotoProjectForUser(ctx.user.id, input.projectId);
          if (!project) throw new TRPCError({ code: "BAD_REQUEST", message: "所選專案不存在或不屬於目前帳戶。" });
        }
        const requestedPresetId = input.brandPresetId ?? project?.brandPresetId ?? undefined;
        const brandPreset = requestedPresetId
          ? await getMarketplaceBrandPresetForUser(ctx.user.id, requestedPresetId)
          : input.useCustomBrandStyle ? undefined : (await listMarketplaceBrandPresets(ctx.user.id)).find((preset) => preset.isDefault === 1);
        if (requestedPresetId && !brandPreset) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "所選品牌預設不存在或不屬於目前帳戶。" });
        }
        const brandStyle = normaliseMarketplaceBrandStyle(brandPreset ?? input.brandStyle);

        const referenceInputs = input.referenceImages?.length ? input.referenceImages : [{ imageData: input.imageData, mimeType: input.mimeType, fileName: input.fileName }];
        const decodedReferences = referenceInputs.map((reference) => ({
          ...decodeImage(reference.imageData, reference.mimeType),
          fileName: reference.fileName,
        }));
        const [{ buffer, mimeType }] = decodedReferences;
        if (decodedReferences.some((reference) => !['image/jpeg', 'image/png', 'image/webp'].includes(reference.mimeType))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "請使用 JPG、PNG、WEBP 或可轉換的 HEIC 產品相片。" });
        }

        const retrySource = input.retrySourceImageId ? await getUserImageForUser(ctx.user.id, input.retrySourceImageId) : undefined;
        if (input.retrySourceImageId && (!retrySource || retrySource.mode !== "marketplace")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "找不到可供重試的原始產品相片。請重新建立此張圖片。" });
        }
        const retrySourceKey = retrySource ? getManagedStorageKey(retrySource.originalUrl) : undefined;
        if (retrySource && !retrySourceKey) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "原始產品相片已無法讀取。請重新上載後建立此張圖片。" });
        }
        const storageUsedBytes = await getUserImageStorageBytes(ctx.user.id);
        const storageAllowance = storageAllowanceBytes(effectivePlan, ctx.user.storageAddonGb);
        const suiteStorageReservation = MAX_IMAGE_BYTES * suite.length + (retrySource ? 0 : buffer.length);
        if (storageUsedBytes + suiteStorageReservation > storageAllowance) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `儲存空間不足：商品套組需要預留約 ${formatStorageBytes(suiteStorageReservation)}。請刪除已儲存相片或加購容量後再試。`,
          });
        }

        let storedUrl: string;
        let sourceStorageKey: string;
        let sourceOriginalBytes = 0;
        try {
          if (retrySource && retrySourceKey) {
            storedUrl = retrySource.originalUrl;
            sourceStorageKey = retrySourceKey;
          } else {
            const fileKey = `iwantphoto/marketplace/${nanoid(12)}-${safeFileName(input.fileName)}`;
            const stored = await storagePut(fileKey, buffer, mimeType);
            storedUrl = stored.url;
            sourceStorageKey = stored.key;
            sourceOriginalBytes = buffer.length;
          }
        } catch {
          // This runs before the role loop and before any credit debit or usage
          // ledger write. Keep the operational detail out of the client response.
          console.error("[iwantphoto marketplace] unable to prepare product reference storage", {
            retryingSavedSource: Boolean(retrySource),
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "產品參考相片暫時未能準備，請重新上載後再試；未有生成圖片不會扣除額度。",
          });
        }
        const additionalReferences = decodedReferences.slice(1).map((reference) => ({
          b64Json: reference.buffer.toString("base64"),
          mimeType: reference.mimeType,
        }));
        let logoStorageKey: string | undefined;
        if (brandPreset?.logoUrl) {
          logoStorageKey = getManagedStorageKey(brandPreset.logoUrl);
        }
        const brandIdentity = brandPreset ? {
          ...brandStyle,
          name: brandPreset.name,
          hasLogo: Boolean(logoStorageKey && brandPreset.logoMimeType),
        } : undefined;
        const baseName = input.fileName.replace(/\.[^.]+$/, "") || "product";
        const outputs: Array<{ role: MarketplaceImageRole; title: string; description: string; url: string; savedImageId?: number; googleMerchantMetadataEmbedded?: true; compositionCorrected?: true; compositionWarning?: string; specificationLines?: string[] }> = [];
        const failures: Array<{ role: MarketplaceImageRole; title: string; message: string }> = [];
        const compositionSignatures: string[] = [];
        let completedCount = 0;

        for (const item of suite) {
          let spentPrepaidCredit = false;
          try {
            if (monthlyUsed + completedCount >= monthlyAllowance) {
              const spend = await spendPrepaidCredit(ctx.user.id);
              if (!spend.spent) {
                throw new TRPCError({ code: "FORBIDDEN", message: "加購處理額度已用完，未能完成其餘商品圖片。" });
              }
              spentPrepaidCredit = true;
            }

            // A full suite can take several minutes. Sign the original and any
            // logo immediately before each provider request so late roles never
            // inherit a stale short-lived source URL from the beginning of the job.
            const getRoleReferences = async () => {
              const sourceReference = { url: await storageGetSignedUrl(sourceStorageKey), mimeType };
              if (logoStorageKey && brandPreset?.logoMimeType && item.role !== "main" && channel !== "google") {
                return [...[sourceReference], ...additionalReferences, { url: await storageGetSignedUrl(logoStorageKey), mimeType: brandPreset.logoMimeType }];
              }
              return [...[sourceReference], ...additionalReferences];
            };

            let generated = await generateMarketplaceImage({
              prompt: buildMarketplaceImagePrompt({ channel, item, productNote: input.productNote, productBrief: input.productBrief, detailSpecificationLayout: input.detailSpecificationLayout, brandStyle, brandIdentity, referenceImageCount: decodedReferences.length, lifestyleStyle, lifestyleScene, avoidLifestyleStyles, redesignInstruction: input.redesignInstruction }),
              originalImages: await getRoleReferences(),
            });
            if (!generated.url) throw new Error("AI image service returned no marketplace image URL");

            const getCompositionInspectionUrl = async (imageUrl: string) => {
              const generatedStorageKey = getManagedStorageKey(imageUrl);
              return generatedStorageKey ? storageGetSignedUrl(generatedStorageKey) : imageUrl;
            };

            let compositionAssessment = await inspectMarketplaceCompositionFromUrl({
              imageUrl: await getCompositionInspectionUrl(generated.url),
              role: item.role,
              lifestyleStyle,
              priorSignatures: compositionSignatures,
            });
            let compositionCorrected = false;
            if (compositionAssessment?.shouldRetry && compositionAssessment.correction) {
              console.warn("[iwantphoto marketplace] generated role did not meet composition target; retrying once", {
                channel,
                role: item.role,
              });
              generated = await generateMarketplaceImage({
                prompt: buildMarketplaceImagePrompt({
                  channel,
                  item,
                  productNote: input.productNote,
                  productBrief: input.productBrief,
                  detailSpecificationLayout: input.detailSpecificationLayout,
                  brandStyle,
                  brandIdentity,
                  referenceImageCount: decodedReferences.length,
                  lifestyleStyle,
                  lifestyleScene,
                  avoidLifestyleStyles,
                  redesignInstruction: input.redesignInstruction,
                  compositionCorrection: compositionAssessment.correction,
                }),
                originalImages: await getRoleReferences(),
              });
              if (!generated.url) throw new Error("AI image service returned no marketplace image URL after composition retry");
              compositionCorrected = true;
              compositionAssessment = await inspectMarketplaceCompositionFromUrl({
                imageUrl: await getCompositionInspectionUrl(generated.url),
                role: item.role,
                lifestyleStyle,
                priorSignatures: compositionSignatures,
              });
            }
            if (compositionAssessment?.signature) compositionSignatures.push(compositionAssessment.signature);

            const generatedFileName = `${baseName}-${channel}-${item.fileSuffix}.png`;
            let processedUrl = generated.url;
            let processedMimeType = "image/png";
            let processedBytes = generated.byteSize ?? 0;
            const googleMerchantMetadataEmbedded = channel === "google";

            if (googleMerchantMetadataEmbedded) {
              const generatedStorageKey = getManagedStorageKey(generated.url);
              const taggedImage = await createGoogleMerchantAiImage({
                imageUrl: generatedStorageKey ? await storageGetSignedUrl(generatedStorageKey) : generated.url,
                appBaseUrl: ENV.appBaseUrl,
              });
              const taggedUpload = await storagePut(
                `iwantphoto/marketplace/google/${nanoid(12)}-${safeFileName(generatedFileName)}`,
                taggedImage.buffer,
                taggedImage.mimeType,
              );
              processedUrl = taggedUpload.url;
              processedMimeType = taggedImage.mimeType;
              processedBytes = taggedImage.byteSize;
            }

            await recordProcessingUsage({ userId: ctx.user.id, source: `marketplace_${item.role}` });

            let savedImageId: number | undefined;
            try {
              const record = await createUserImage({
                userId: ctx.user.id,
                projectId: input.projectId ?? null,
                fileName: generatedFileName,
                mimeType: processedMimeType,
                originalUrl: storedUrl,
                processedUrl,
                originalBytes: completedCount === 0 ? sourceOriginalBytes : 0,
                processedBytes,
                mode: "marketplace",
                backgroundStyle: "white",
                cleanupNote: `${MARKETPLACE_CHANNELS[channel].label} · ${item.title}${brandPreset ? ` · 品牌：${brandPreset.name}` : ""}`,
              });
              savedImageId = record?.id;
            } catch (saveError) {
              console.error("[iwantphoto marketplace] unable to save generated suite image", saveError);
            }

            outputs.push({
              role: item.role,
              title: item.title,
              description: item.description,
              url: processedUrl,
              ...(compositionCorrected ? { compositionCorrected: true as const } : {}),
              ...(compositionAssessment?.shouldRetry && compositionAssessment.warning ? { compositionWarning: compositionAssessment.warning } : {}),
              ...(googleMerchantMetadataEmbedded ? { googleMerchantMetadataEmbedded: true as const } : {}),
              ...(item.role === "detail" && getMarketplaceDetailSpecificationLines(input.productBrief).length ? { specificationLines: getMarketplaceDetailSpecificationLines(input.productBrief) } : {}),
              ...(typeof savedImageId === "number" ? { savedImageId } : {}),
            });
            completedCount += 1;
          } catch (error) {
            if (spentPrepaidCredit) {
              try { await refundPrepaidCredit(ctx.user.id); } catch (refundError) { console.error("[iwantphoto billing] unable to refund marketplace credit", refundError); }
            }
            const diagnostic = getMarketplaceImageGenerationDiagnostic(error);
            console.error("[iwantphoto marketplace] unable to generate suite image", { channel, role: item.role, diagnostic });
            failures.push({ role: item.role, title: item.title, message: error instanceof TRPCError ? error.message : getMarketplaceImageRecoveryMessage(error) });
          }
        }

        if (outputs.length === 0) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 暫時未能處理這組產品參考相片。系統已嘗試備用影像服務，未完成圖片不會扣除額度。請稍後重試；若仍未成功，請重新上載清晰的實物產品相片。" });
        }

        try {
          const usedBytes = await getUserImageStorageBytes(ctx.user.id);
          const allowanceBytes = storageAllowanceBytes(effectivePlan, ctx.user.storageAddonGb);
          await notifyStorageCapacityIfNeeded({
            userId: ctx.user.id,
            email: ctx.user.email,
            name: ctx.user.name,
            alertsEnabled: ctx.user.storageEmailAlertsEnabled === 1,
            alertCycle: ctx.user.storageAlertCycle,
            usedBytes,
            allowanceBytes,
          }, {
            reserve: reserveStorageUsageAlert,
            markSent: markStorageUsageAlertSent,
            release: releaseStorageUsageAlert,
          });
        } catch (alertError) {
          console.error("[iwantphoto storage] marketplace capacity email could not be delivered", alertError);
        }

        return { channel, outputs, failures };
      }),
  }),
});

export type AppRouter = typeof appRouter;
