import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  countUserProcessingUsageSince: vi.fn(),
  listUserProcessingUsageSince: vi.fn(),
  createPhotoProject: vi.fn(),
  createUserImage: vi.fn(),
  getMarketplaceBrandPresetForUser: vi.fn(),
  getPhotoProjectForUser: vi.fn(),
  getUserImageForUser: vi.fn(),
  getUserImageStorageBytes: vi.fn(),
  getUserProjectStorageSummary: vi.fn(),
  listUserImagesMissingStorageBytes: vi.fn(),
  generateImage: vi.fn(),
  generateMarketplaceImage: vi.fn(),
  inspectMarketplaceCompositionFromUrl: vi.fn(),
  assignImageToProject: vi.fn(),
  listPhotoProjects: vi.fn(),
  listUserImages: vi.fn(),
  refundPrepaidCredit: vi.fn(),
  refreshStoredImageSizes: vi.fn(),
  rearmStorageUsageAlerts: vi.fn(),
  releaseStorageUsageAlert: vi.fn(),
  removeUserImage: vi.fn(),
  removeUnclassifiedUserImages: vi.fn(),
  reserveStorageUsageAlert: vi.fn(),
  listMarketplaceBrandPresets: vi.fn(),
  listMarketplaceWorkflows: vi.fn(),
  listSavedMarketplaceProducts: vi.fn(),
  createMarketplaceBrandPreset: vi.fn(),
  createMarketplaceWorkflow: vi.fn(),
  updateMarketplaceBrandPreset: vi.fn(),
  setMarketplaceBrandPresetDefault: vi.fn(),
  removeMarketplaceBrandPreset: vi.fn(),
  removeMarketplaceWorkflow: vi.fn(),
  setPhotoProjectBrandPreset: vi.fn(),
  markStorageUsageAlertSent: vi.fn(),
  setStorageEmailAlertsEnabled: vi.fn(),
  spendPrepaidCredit: vi.fn(),
  updateUserImageStorageBytes: vi.fn(),
  updateUserDisplayName: vi.fn(),
  updateUserAvatarUrl: vi.fn(),
  updateAdminTestPlan: vi.fn(),
  recordAccountSecurityEvent: vi.fn(),
  listAccountSecurityEvents: vi.fn(),
  getAdminWorkspaceOverview: vi.fn(),
  upsertSavedMarketplaceProduct: vi.fn(),
  storageGetSignedUrl: vi.fn(),
  getManagedStorageKey: vi.fn(),
  storagePut: vi.fn(),
  createGoogleMerchantAiImage: vi.fn(),
  draftMarketplaceProductBrief: vi.fn(),
  draftMarketplaceListingCopy: vi.fn(),
  createAccountAvatar: vi.fn(),
  recordProcessingUsage: vi.fn(),
}));

vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generateImage }));
vi.mock("./marketplaceImageGeneration", () => ({
  generateMarketplaceImage: mocks.generateMarketplaceImage,
  getMarketplaceImageGenerationDiagnostic: vi.fn(() => ({ primary: "generation_failed", fallback: null })),
  getMarketplaceImageRecoveryMessage: vi.fn(() => "AI 暫時未能完成此張圖片；未完成圖片不會扣除額度。請稍後再試。"),
}));
vi.mock("./marketplaceCompositionQuality", () => ({
  inspectMarketplaceCompositionFromUrl: mocks.inspectMarketplaceCompositionFromUrl,
}));
vi.mock("./storage", () => ({ getManagedStorageKey: mocks.getManagedStorageKey, storageGetSignedUrl: mocks.storageGetSignedUrl, storagePut: mocks.storagePut }));
vi.mock("./googleMerchantMetadata", () => ({ createGoogleMerchantAiImage: mocks.createGoogleMerchantAiImage }));
vi.mock("./marketplaceProductDraft", () => ({ draftMarketplaceProductBrief: mocks.draftMarketplaceProductBrief }));
vi.mock("./marketplaceListingCopy", () => ({ draftMarketplaceListingCopy: mocks.draftMarketplaceListingCopy }));
vi.mock("./accountAvatar", () => ({ createAccountAvatar: mocks.createAccountAvatar }));
vi.mock("./imageStorageMetering", () => ({ refreshStoredImageSizes: mocks.refreshStoredImageSizes }));
vi.mock("./db", () => ({
  countUserProcessingUsageSince: mocks.countUserProcessingUsageSince,
  listUserProcessingUsageSince: mocks.listUserProcessingUsageSince,
  createPhotoProject: mocks.createPhotoProject,
  createUserImage: mocks.createUserImage,
  getMarketplaceBrandPresetForUser: mocks.getMarketplaceBrandPresetForUser,
  getPhotoProjectForUser: mocks.getPhotoProjectForUser,
  getUserImageForUser: mocks.getUserImageForUser,
  getUserImageStorageBytes: mocks.getUserImageStorageBytes,
  getUserProjectStorageSummary: mocks.getUserProjectStorageSummary,
  listUserImagesMissingStorageBytes: mocks.listUserImagesMissingStorageBytes,
  assignImageToProject: mocks.assignImageToProject,
  listPhotoProjects: mocks.listPhotoProjects,
  listUserImages: mocks.listUserImages,
  refundPrepaidCredit: mocks.refundPrepaidCredit,
  rearmStorageUsageAlerts: mocks.rearmStorageUsageAlerts,
  releaseStorageUsageAlert: mocks.releaseStorageUsageAlert,
  removeUserImage: mocks.removeUserImage,
  removeUnclassifiedUserImages: mocks.removeUnclassifiedUserImages,
  reserveStorageUsageAlert: mocks.reserveStorageUsageAlert,
  listMarketplaceBrandPresets: mocks.listMarketplaceBrandPresets,
  listMarketplaceWorkflows: mocks.listMarketplaceWorkflows,
  listSavedMarketplaceProducts: mocks.listSavedMarketplaceProducts,
  createMarketplaceBrandPreset: mocks.createMarketplaceBrandPreset,
  createMarketplaceWorkflow: mocks.createMarketplaceWorkflow,
  updateMarketplaceBrandPreset: mocks.updateMarketplaceBrandPreset,
  setMarketplaceBrandPresetDefault: mocks.setMarketplaceBrandPresetDefault,
  removeMarketplaceBrandPreset: mocks.removeMarketplaceBrandPreset,
  removeMarketplaceWorkflow: mocks.removeMarketplaceWorkflow,
  setPhotoProjectBrandPreset: mocks.setPhotoProjectBrandPreset,
  markStorageUsageAlertSent: mocks.markStorageUsageAlertSent,
  setStorageEmailAlertsEnabled: mocks.setStorageEmailAlertsEnabled,
  spendPrepaidCredit: mocks.spendPrepaidCredit,
  updateUserImageStorageBytes: mocks.updateUserImageStorageBytes,
  updateUserDisplayName: mocks.updateUserDisplayName,
  updateUserAvatarUrl: mocks.updateUserAvatarUrl,
  updateAdminTestPlan: mocks.updateAdminTestPlan,
  recordAccountSecurityEvent: mocks.recordAccountSecurityEvent,
  listAccountSecurityEvents: mocks.listAccountSecurityEvents,
  getAdminWorkspaceOverview: mocks.getAdminWorkspaceOverview,
  upsertSavedMarketplaceProduct: mocks.upsertSavedMarketplaceProduct,
  recordProcessingUsage: mocks.recordProcessingUsage,
}));

import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      get: (name: string) => (name === "host" ? "iwantphoto.test" : undefined),
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAuthenticatedContext(): TrpcContext {
  return {
    ...createContext(),
    user: {
      id: 42,
      openId: "account-owner",
      name: "Account owner",
      email: "owner@example.com",
      loginMethod: "manus",
      role: "user",
      plan: "starter",
      creditBalance: 0,
      storageAddonGb: 0,
      stripeStorageSubscriptionId: null,
      storageSubscriptionStatus: null,
      storageEmailAlertsEnabled: 1,
      storageAlertCycle: 0,
      adminTestPlan: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

const sampleData = `data:image/jpeg;base64,${Buffer.from("small-photo").toString("base64")}`;
const sampleMask = `data:image/png;base64,${Buffer.from("red-brush-strokes").toString("base64")}`;

describe("editor.process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storagePut.mockResolvedValue({ key: "uploads/source.jpg", url: "/manus-storage/uploads/source.jpg" });
    mocks.storageGetSignedUrl.mockImplementation(async (key: string) => `https://signed-storage.iwantphoto.test/${key}`);
    mocks.getManagedStorageKey.mockImplementation((url: string) => url.startsWith("/manus-storage/") ? url.slice("/manus-storage/".length) : undefined);
    mocks.generateImage.mockResolvedValue({ url: "/manus-storage/processed/result.png" });
    mocks.generateMarketplaceImage.mockResolvedValue({ url: "/manus-storage/processed/result.png", byteSize: 0, model: "MODEL_GPT_IMAGE_2", usedFallback: false });
    mocks.inspectMarketplaceCompositionFromUrl.mockResolvedValue({ whiteRatio: 0.4, signature: "non-white-product-scene", shouldRetry: false });
    mocks.createGoogleMerchantAiImage.mockResolvedValue({
      buffer: Buffer.from("tagged-google-merchant-png"),
      mimeType: "image/png",
      byteSize: 25,
      digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
    });
    mocks.draftMarketplaceProductBrief.mockResolvedValue({
      brief: {
        productName: "透明收納盒",
        summary: "透明盒身配有黑色扣件。",
        confirmedFacts: ["透明盒身"],
        visualHighlights: ["黑色扣件"],
        usageIdeas: ["家居收納"],
        reviewQuestions: ["請確認容量。"],
      },
      lifestyleRecommendation: { style: "home", reason: "可見收納用途，適合克制的家居收納場景。" },
    });
    mocks.draftMarketplaceListingCopy.mockResolvedValue({
      channel: "amazon",
      title: "透明收納盒",
      bullets: ["透明盒身", "深色扣件", "可見密封蓋", "家居收納", "請確認實際套裝內容"],
      reviewNotes: ["請確認實際容量。"],
    });
    mocks.countUserProcessingUsageSince.mockResolvedValue(0);
    mocks.listUserProcessingUsageSince.mockResolvedValue([]);
    mocks.recordProcessingUsage.mockResolvedValue(undefined);
    mocks.getUserImageStorageBytes.mockResolvedValue(0);
    mocks.getUserProjectStorageSummary.mockResolvedValue([]);
    mocks.listUserImagesMissingStorageBytes.mockResolvedValue([]);
    mocks.createUserImage.mockResolvedValue({ id: 88 });
    mocks.getMarketplaceBrandPresetForUser.mockResolvedValue(undefined);
    mocks.createPhotoProject.mockResolvedValue({ id: 7, userId: 42, name: "九月產品圖" });
    mocks.getPhotoProjectForUser.mockResolvedValue({ id: 7, userId: 42, name: "九月產品圖", brandPresetId: null });
    mocks.getUserImageForUser.mockResolvedValue(undefined);
    mocks.assignImageToProject.mockResolvedValue({ id: 88, userId: 42, projectId: 7 });
    mocks.listPhotoProjects.mockResolvedValue([]);
    mocks.listUserImages.mockResolvedValue([]);
    mocks.spendPrepaidCredit.mockResolvedValue({ spent: false, balance: 0 });
    mocks.updateUserDisplayName.mockResolvedValue({ ...createAuthenticatedContext().user, displayName: "帳戶名稱" });
    mocks.updateUserAvatarUrl.mockResolvedValue({ ...createAuthenticatedContext().user, avatarUrl: "/manus-storage/account-avatars/42/avatar.webp" });
    mocks.updateAdminTestPlan.mockResolvedValue({ ...createAuthenticatedContext().user, role: "admin", plan: "starter", adminTestPlan: "business" });
    mocks.recordAccountSecurityEvent.mockResolvedValue(undefined);
    mocks.listAccountSecurityEvents.mockResolvedValue([{ id: 4, userId: 42, event: "signed_in", detail: "已透過安全帳戶登入", createdAt: new Date("2026-09-20T00:00:00Z") }]);
    mocks.getAdminWorkspaceOverview.mockResolvedValue({ totals: { users: 2, activeUsers: 1, savedImages: 3, monthlyImages: 2, storedBytes: 1024 }, plans: [], accounts: [], activities: [] });
    mocks.createAccountAvatar.mockResolvedValue({ buffer: Buffer.from("avatar-webp"), mimeType: "image/webp", width: 256, height: 256 });
    mocks.refundPrepaidCredit.mockResolvedValue({ balance: 1 });
    mocks.refreshStoredImageSizes.mockResolvedValue({ checked: 0, updated: 0, failed: 0 });
    mocks.removeUserImage.mockResolvedValue(true);
    mocks.removeUnclassifiedUserImages.mockResolvedValue(0);
    mocks.rearmStorageUsageAlerts.mockResolvedValue(false);
    mocks.reserveStorageUsageAlert.mockResolvedValue(false);
    mocks.listMarketplaceBrandPresets.mockResolvedValue([]);
    mocks.listMarketplaceWorkflows.mockResolvedValue([]);
    mocks.listSavedMarketplaceProducts.mockResolvedValue([]);
    mocks.createMarketplaceBrandPreset.mockResolvedValue({ id: 1, userId: 42, name: "SIM uncle", accentColor: "#176BD2", fontStyle: "clean", logoUrl: null, logoMimeType: null, isDefault: 1 });
    mocks.createMarketplaceWorkflow.mockResolvedValue({ id: 10, userId: 42, name: "Amazon 家居四圖", channel: "amazon", selectedRoles: ["main", "studio", "detail", "lifestyle"], lifestyleStyle: "home", projectId: 7, brandPresetId: null, useCustomBrandStyle: true, brandStyle: { accentColor: "#176BD2", fontStyle: "clean" }, createdAt: new Date(), updatedAt: new Date() });
    mocks.updateMarketplaceBrandPreset.mockResolvedValue({ id: 1, userId: 42, name: "SIM uncle", accentColor: "#176BD2", fontStyle: "clean", logoUrl: null, logoMimeType: null, isDefault: 1 });
    mocks.upsertSavedMarketplaceProduct.mockResolvedValue({
      id: 6,
      userId: 42,
      projectId: 7,
      sku: "BOX-BLK-01",
      productName: "透明收納盒",
      summary: "透明盒身配有深色扣件。",
      brief: { productName: "透明收納盒", summary: "透明盒身配有深色扣件。", confirmedFacts: ["透明盒身"], visualHighlights: ["深色扣件"], usageIdeas: ["家居收納"], reviewQuestions: [] },
      listingCopy: null,
    });
    mocks.setMarketplaceBrandPresetDefault.mockResolvedValue({ id: 1 });
    mocks.removeMarketplaceBrandPreset.mockResolvedValue(true);
    mocks.removeMarketplaceWorkflow.mockResolvedValue(true);
    mocks.setPhotoProjectBrandPreset.mockResolvedValue({ id: 7, userId: 42, name: "九月產品圖", brandPresetId: 1 });
    mocks.markStorageUsageAlertSent.mockResolvedValue(undefined);
    mocks.releaseStorageUsageAlert.mockResolvedValue(undefined);
    mocks.setStorageEmailAlertsEnabled.mockResolvedValue({ storageEmailAlertsEnabled: 1 });
  });

  it("stores a commercial image and requests subject-preserving transparent-background editing", async () => {
    const caller = appRouter.createCaller(createContext());

    const result = await caller.editor.process({
      imageData: sampleData,
      fileName: "product-display.jpg",
      mimeType: "image/jpeg",
      mode: "background",
      backgroundStyle: "transparent",
    });

    expect(mocks.storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^iwantphoto\/uploads\//),
      expect.any(Buffer),
      "image/jpeg",
    );
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({
      originalImages: [{ url: "https://signed-storage.iwantphoto.test/uploads/source.jpg", mimeType: "image/jpeg" }],
      model: "MODEL_GPT_IMAGE_2",
      quality: "medium",
      prompt: expect.stringContaining("fully transparent background"),
    }));
    const backgroundPrompt = mocks.generateImage.mock.calls[0]?.[0]?.prompt as string;
    expect(backgroundPrompt).toContain("primary business-relevant subject");
    expect(backgroundPrompt).toContain("labels, logos, meaningful text");
    expect(backgroundPrompt).toContain("original input canvas dimensions, aspect ratio, and orientation");
    expect(backgroundPrompt).toContain("exact same x/y coordinates on the canvas");
    expect(backgroundPrompt).toContain("Do not crop, rotate, expand, reframe, move, resize, reposition");
    expect(backgroundPrompt).not.toContain("floral tribute");
    expect(result).toEqual({
      url: "/manus-storage/processed/result.png",
      originalUrl: "/manus-storage/uploads/source.jpg",
    });
  });

  it("passes the user's cleanup request while preserving all non-target commercial content", async () => {
    const caller = appRouter.createCaller(createContext());

    await caller.editor.process({
      imageData: sampleData,
      fileName: "shopfront.png",
      mimeType: "image/png",
      mode: "cleanup",
      backgroundStyle: "white",
      cleanupNote: "右下角的雜物箱",
    });

    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("右下角的雜物箱"),
    }));
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("Preserve every non-target element"),
    }));
    const cleanupPrompt = mocks.generateImage.mock.calls[0]?.[0]?.prompt as string;
    expect(cleanupPrompt).toContain("leave the image unchanged rather than inventing an edit");
    expect(cleanupPrompt).toContain("Do not crop, rotate, expand, reframe, move, resize, reposition");
    expect(cleanupPrompt).toContain("exact same x/y coordinates on the canvas");
  });

  it("provides a painted PNG mask as a second reference for precise cleanup", async () => {
    mocks.storagePut
      .mockResolvedValueOnce({ key: "uploads/source.jpg", url: "/manus-storage/uploads/source.jpg" })
      .mockResolvedValueOnce({ key: "masks/selection.png", url: "/manus-storage/masks/selection.png" });
    const caller = appRouter.createCaller(createContext());

    await caller.editor.process({
      imageData: sampleData,
      fileName: "retail-display.jpg",
      mimeType: "image/jpeg",
      mode: "cleanup",
      backgroundStyle: "white",
      cleanupNote: "移除桌面右側的雜物",
      maskData: sampleMask,
    });

    expect(mocks.storagePut).toHaveBeenNthCalledWith(2, expect.stringMatching(/^iwantphoto\/masks\//), expect.any(Buffer), "image/png");
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({
      originalImages: [
        { url: "https://signed-storage.iwantphoto.test/uploads/source.jpg", mimeType: "image/jpeg" },
        { url: "https://signed-storage.iwantphoto.test/masks/selection.png", mimeType: "image/png" },
      ],
      prompt: expect.stringContaining("red painted strokes mark the exact areas"),
    }));
  });

  it("rejects malformed image data before uploading", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.editor.process({
      imageData: "not-an-image",
      fileName: "bad.jpg",
      mimeType: "image/jpeg",
      mode: "background",
      backgroundStyle: "white",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it("uses a new signed source URL for each consecutive image request", async () => {
    mocks.storagePut
      .mockResolvedValueOnce({ key: "uploads/first.jpg", url: "/manus-storage/uploads/first.jpg" })
      .mockResolvedValueOnce({ key: "uploads/second.jpg", url: "/manus-storage/uploads/second.jpg" });
    const caller = appRouter.createCaller(createContext());

    await caller.editor.process({ imageData: sampleData, fileName: "first.jpg", mimeType: "image/jpeg", mode: "background", backgroundStyle: "white" });
    await caller.editor.process({ imageData: sampleData, fileName: "second.jpg", mimeType: "image/jpeg", mode: "background", backgroundStyle: "white" });

    expect(mocks.storageGetSignedUrl).toHaveBeenNthCalledWith(1, "uploads/first.jpg");
    expect(mocks.storageGetSignedUrl).toHaveBeenNthCalledWith(2, "uploads/second.jpg");
    expect(mocks.generateImage.mock.calls[0]?.[0]?.originalImages[0]?.url).toBe("https://signed-storage.iwantphoto.test/uploads/first.jpg");
    expect(mocks.generateImage.mock.calls[1]?.[0]?.originalImages[0]?.url).toBe("https://signed-storage.iwantphoto.test/uploads/second.jpg");
  });

  it("saves completed images only to the authenticated account library", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const result = await caller.editor.process({ imageData: sampleData, fileName: "saved-product.jpg", mimeType: "image/jpeg", mode: "background", backgroundStyle: "transparent" });

    expect(mocks.createUserImage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      fileName: "saved-product.jpg",
      originalUrl: "/manus-storage/uploads/source.jpg",
      processedUrl: "/manus-storage/processed/result.png",
      mode: "background",
      backgroundStyle: "transparent",
    }));
    expect(mocks.recordProcessingUsage).toHaveBeenCalledWith({ userId: 42, source: "editor_background" });
    expect(result).toMatchObject({ savedImageId: 88 });
  });

  it("creates an editable product brief from an authenticated product upload without generating images", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const draft = await caller.editor.marketplaceBriefDraft({
      imageData: sampleData,
      mimeType: "image/jpeg",
      referenceImages: [
        { imageData: sampleData, mimeType: "image/jpeg", fileName: "front.jpg" },
        { imageData: sampleData, mimeType: "image/jpeg", fileName: "side.jpg" },
      ],
    });

    expect(mocks.draftMarketplaceProductBrief).toHaveBeenCalledWith(expect.objectContaining({
      references: [
        expect.objectContaining({ mimeType: "image/jpeg", buffer: expect.any(Buffer) }),
        expect.objectContaining({ mimeType: "image/jpeg", buffer: expect.any(Buffer) }),
      ],
    }));
    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(draft).toMatchObject({
      brief: { productName: "透明收納盒", reviewQuestions: ["請確認容量。"] },
      lifestyleRecommendation: { style: "home" },
    });
  });

  it("passes the editable draft and revision request to the product-draft service", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const currentBrief = {
      productName: "維生素 D3 補充劑",
      summary: "深棕色瓶身配有綠色瓶蓋。",
      weight: "",
      dimensions: "",
      confirmedFacts: ["深棕色瓶身"],
      visualHighlights: ["正面標籤"],
      usageIdeas: [],
      reviewQuestions: ["請確認每瓶實際錠數。"],
    };

    await caller.editor.marketplaceBriefDraft({
      imageData: sampleData,
      mimeType: "image/jpeg",
      currentBrief,
      revisionInstruction: "名稱改得較簡潔，刪除未能確認的健康功效。",
    });

    expect(mocks.draftMarketplaceProductBrief).toHaveBeenCalledWith(expect.objectContaining({
      currentBrief,
      revisionInstruction: "名稱改得較簡潔，刪除未能確認的健康功效。",
      references: [expect.objectContaining({ buffer: expect.any(Buffer), mimeType: "image/jpeg" })],
    }));
  });

  it("creates platform-aware listing copy only from the merchant-confirmed brief", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const brief = {
      productName: "透明收納盒",
      summary: "透明盒身配有深色扣件。",
      weight: "",
      dimensions: "",
      confirmedFacts: ["透明盒身"],
      visualHighlights: ["深色扣件"],
      usageIdeas: ["家居收納"],
    };

    const copy = await caller.editor.marketplaceListingCopy({ channel: "shopee", productBrief: brief });

    expect(mocks.draftMarketplaceListingCopy).toHaveBeenCalledWith({ channel: "shopee", productBrief: brief });
    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(copy).toMatchObject({ title: "透明收納盒", bullets: expect.any(Array) });
  });

  it("stores and lists a confirmed SKU only within the authenticated project", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const productBrief = {
      productName: "透明收納盒",
      summary: "透明盒身配有深色扣件。",
      weight: "",
      dimensions: "",
      confirmedFacts: ["透明盒身"],
      visualHighlights: ["深色扣件"],
      usageIdeas: ["家居收納"],
      reviewQuestions: ["請確認容量"],
    };

    const saved = await caller.marketplace.saveProduct({
      projectId: 7,
      sku: "BOX-BLK-01",
      productBrief,
      listingCopy: null,
    });
    await caller.marketplace.savedProducts({ projectId: 7 });

    expect(mocks.upsertSavedMarketplaceProduct).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      projectId: 7,
      sku: "BOX-BLK-01",
      brief: productBrief,
    }));
    expect(mocks.listSavedMarketplaceProducts).toHaveBeenCalledWith(42, 7);
    expect(saved).toMatchObject({ sku: "BOX-BLK-01", projectId: 7 });
  });

  it("builds and saves a four-image Amazon product suite for the signed-in account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const result = await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "tote-bag.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      productBrief: {
        productName: "黑色棉質手提袋",
        summary: "一個黑色棉質手提袋。",
        confirmedFacts: ["只售一個袋"],
        visualHighlights: ["可見手提帶"],
        usageIdeas: ["日常外出"],
      },
      projectId: 7,
    });

    expect(mocks.storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^iwantphoto\/marketplace\//),
      expect.any(Buffer),
      "image/jpeg",
    );
    expect(mocks.generateMarketplaceImage).toHaveBeenCalledTimes(4);
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("pure white RGB 255/255/255");
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("sole visual source of truth");
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("黑色棉質手提袋");
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("show the exact complete sellable set");
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("Do not duplicate a product");
    expect(mocks.createUserImage).toHaveBeenCalledTimes(4);
    expect(mocks.createUserImage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      projectId: 7,
      mode: "marketplace",
      cleanupNote: expect.stringContaining("Amazon"),
    }));
    expect(result.outputs).toHaveLength(4);
    expect(result.failures).toEqual([]);
    expect(mocks.recordProcessingUsage).toHaveBeenCalledTimes(4);
    expect(mocks.recordProcessingUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, source: "marketplace_lifestyle" }));
  });

  it("refreshes the signed product reference before every role so the final image cannot inherit an expired URL", async () => {
    let signature = 0;
    mocks.storageGetSignedUrl.mockImplementation(async (key: string) => `https://signed-storage.iwantphoto.test/${key}?signature=${++signature}`);
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "long-running-suite.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      productBrief: {
        productName: "測試產品",
        summary: "一件供測試的產品。",
        confirmedFacts: [],
        visualHighlights: [],
        usageIdeas: [],
      },
    });

    const sourceUrls = mocks.generateMarketplaceImage.mock.calls.map(([input]) => input.originalImages[0]?.url);
    expect(sourceUrls).toHaveLength(4);
    expect(new Set(sourceUrls).size).toBe(4);
    expect(mocks.storageGetSignedUrl.mock.calls.filter(([key]) => key === "uploads/source.jpg")).toHaveLength(4);
  });

  it("requires the merchant to confirm a product name and description before creating a reviewed suite", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const request = caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "unconfirmed-product.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      productBrief: {
        productName: "產品",
        summary: "",
        confirmedFacts: [],
        visualHighlights: [],
        usageIdeas: [],
      },
    });
    await expect(request).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(request).rejects.toThrow("請先確認產品名稱及產品描述");
    expect(mocks.generateMarketplaceImage).not.toHaveBeenCalled();
  });

  it("uses selected image roles, merchant brand styling and extra angles without saving extra reference files", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const result = await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "front.jpg",
      mimeType: "image/jpeg",
      referenceImages: [
        { imageData: sampleData, fileName: "front.jpg", mimeType: "image/jpeg" },
        { imageData: sampleData, fileName: "side.jpg", mimeType: "image/jpeg" },
      ],
      channel: "shopee",
      selectedRoles: ["main", "detail"],
      detailSpecificationLayout: "bottom_strip",
      brandStyle: { accentColor: "#2F7A63", fontStyle: "editorial" },
      productBrief: {
        productName: "透明收納盒",
        summary: "透明盒身配有深色扣件。",
        weight: "180 g",
        dimensions: "12 × 8 × 4 cm",
        confirmedFacts: ["透明盒身"],
        visualHighlights: ["深色扣件"],
        usageIdeas: ["家居收納"],
      },
    });

    expect(result.outputs).toHaveLength(2);
    expect(result.outputs.find((output) => output.role === "detail")?.specificationLines).toEqual(["重量：180 g", "尺寸：12 × 8 × 4 cm"]);
    expect(mocks.generateMarketplaceImage).toHaveBeenCalledTimes(2);
    expect(mocks.storagePut).toHaveBeenCalledTimes(1);
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.originalImages).toEqual([
      { url: "https://signed-storage.iwantphoto.test/uploads/source.jpg", mimeType: "image/jpeg" },
      { b64Json: Buffer.from("small-photo").toString("base64"), mimeType: "image/jpeg" },
    ]);
    const mainPrompt = mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt as string;
    const detailPrompt = mocks.generateMarketplaceImage.mock.calls[1]?.[0]?.prompt as string;
    expect(mainPrompt).toContain("2 reference photos");
    expect(mainPrompt).toContain("Do not apply the merchant brand colour");
    expect(detailPrompt).toContain("#2F7A63");
    expect(detailPrompt).toContain("高級雜誌感");
    expect(detailPrompt).toContain("VERIFIED SPECIFICATION OVERLAY");
    expect(detailPrompt).toContain("重量：180 g");
    expect(detailPrompt).toContain("尺寸：12 × 8 × 4 cm");
    expect(detailPrompt).toContain("Merchant-selected layout: 底部規格列");
    expect(mainPrompt).toContain("No specification overlay is permitted for this role.");
  });

  it("passes an approved brand logo only to non-main, non-Google supplementary images", async () => {
    mocks.getMarketplaceBrandPresetForUser.mockResolvedValue({
      id: 9,
      userId: 42,
      name: "SIM uncle",
      accentColor: "#2F7A63",
      fontStyle: "friendly",
      logoUrl: "/manus-storage/brand-logos/42/sim-uncle.png",
      logoMimeType: "image/png",
      isDefault: 1,
    });
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "front.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      selectedRoles: ["main", "detail"],
      brandPresetId: 9,
      productBrief: {
        productName: "透明收納盒",
        summary: "透明盒身配有深色扣件。",
        confirmedFacts: ["透明盒身"],
        visualHighlights: ["深色扣件"],
        usageIdeas: ["家居收納"],
      },
    });

    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.originalImages).toHaveLength(1);
    expect(mocks.generateMarketplaceImage.mock.calls[1]?.[0]?.originalImages).toEqual(expect.arrayContaining([
      { url: "https://signed-storage.iwantphoto.test/brand-logos/42/sim-uncle.png", mimeType: "image/png" },
    ]));
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("Do not apply the merchant brand colour");
    expect(mocks.generateMarketplaceImage.mock.calls[1]?.[0]?.prompt).toContain("last supplied reference is the merchant's approved logo");
  });

  it("keeps an explicit one-off brand style instead of falling back to the account default", async () => {
    mocks.listMarketplaceBrandPresets.mockResolvedValue([{ id: 3, userId: 42, name: "帳戶預設", accentColor: "#176BD2", fontStyle: "clean", logoUrl: null, logoMimeType: null, isDefault: 1 }]);
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "product.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      selectedRoles: ["detail"],
      useCustomBrandStyle: true,
      brandStyle: { accentColor: "#A16324", fontStyle: "editorial" },
      productBrief: {
        productName: "透明收納盒",
        summary: "透明盒身配有深色扣件。",
        confirmedFacts: ["透明盒身"],
        visualHighlights: ["深色扣件"],
        usageIdeas: ["家居收納"],
      },
    });

    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("#A16324");
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).not.toContain("#176BD2");
  });

  it("re-encodes Google Merchant Center suite exports with embedded AI source metadata", async () => {
    mocks.storagePut
      .mockResolvedValueOnce({ key: "marketplace/source.jpg", url: "/manus-storage/marketplace/source.jpg" })
      .mockImplementation(async (_key: string, _data: Buffer, _mimeType: string) => ({
        key: "marketplace/google/tagged-output.png",
        url: "/manus-storage/marketplace/google/tagged-output.png",
      }));
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const result = await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "tote-bag.jpg",
      mimeType: "image/jpeg",
      channel: "google",
      projectId: 7,
    });

    expect(mocks.createGoogleMerchantAiImage).toHaveBeenCalledTimes(4);
    expect(mocks.createGoogleMerchantAiImage).toHaveBeenCalledWith(expect.objectContaining({
      imageUrl: "https://signed-storage.iwantphoto.test/processed/result.png",
    }));
    expect(mocks.storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^iwantphoto\/marketplace\/google\//),
      Buffer.from("tagged-google-merchant-png"),
      "image/png",
    );
    expect(mocks.createUserImage).toHaveBeenCalledWith(expect.objectContaining({
      fileName: "tote-bag-google-main.png",
      mimeType: "image/png",
      processedUrl: "/manus-storage/marketplace/google/tagged-output.png",
      processedBytes: 25,
    }));
    expect(result.outputs).toHaveLength(4);
    expect(result.outputs.every((output) => output.googleMerchantMetadataEmbedded)).toBe(true);
  });

  it("reports an actionable no-charge recovery message when all suite roles fail", async () => {
    mocks.generateMarketplaceImage.mockRejectedValue(new Error("both providers unavailable"));
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "failed-product.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      selectedRoles: ["main"],
      productBrief: {
        productName: "測試產品",
        summary: "一件供測試的產品。",
        confirmedFacts: [],
        visualHighlights: [],
        usageIdeas: [],
      },
    })).rejects.toThrow("系統已嘗試備用影像服務");
    expect(mocks.generateMarketplaceImage).toHaveBeenCalledTimes(1);
    expect(mocks.spendPrepaidCredit).not.toHaveBeenCalled();
  });

  it("returns a clear no-charge message when product reference storage cannot be prepared", async () => {
    mocks.storagePut.mockRejectedValueOnce(new Error("The string did not match the expected pattern."));
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "storage-failure-product.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      selectedRoles: ["main"],
      productBrief: {
        productName: "測試產品",
        summary: "一件供測試的產品。",
        confirmedFacts: [],
        visualHighlights: [],
        usageIdeas: [],
      },
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "產品參考相片暫時未能準備，請重新上載後再試；未有生成圖片不會扣除額度。",
    });

    expect(mocks.generateMarketplaceImage).not.toHaveBeenCalled();
    expect(mocks.recordProcessingUsage).not.toHaveBeenCalled();
    expect(mocks.spendPrepaidCredit).not.toHaveBeenCalled();
    expect(mocks.refundPrepaidCredit).not.toHaveBeenCalled();
  });

  it("automatically retries a weak lifestyle composition once without charging another credit", async () => {
    mocks.inspectMarketplaceCompositionFromUrl
      .mockResolvedValueOnce({
        whiteRatio: 0.97,
        signature: "white-catalog-shot",
        shouldRetry: true,
        warning: "情境圖仍過於像白底主圖，未能呈現足夠的真實場景。",
        correction: "Do not return an isolated front-facing product on a pure or near-white seamless background. Create the requested believable use or ownership scene in a non-white real-world setting.",
      })
      .mockResolvedValueOnce({ whiteRatio: 0.42, signature: "home-cabinet-scene", shouldRetry: false });
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const result = await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "vitamin.jpg",
      mimeType: "image/jpeg",
      channel: "shopee",
      selectedRoles: ["lifestyle"],
      lifestyleStyle: "outdoor",
      lifestyleScene: {
        id: "outdoor-patio",
        style: "outdoor",
        title: "自然日光露台",
        description: "以戶外檯面及欄杆深度呈現。",
      },
      avoidLifestyleStyles: ["home", "office"],
      productBrief: {
        productName: "維生素 D3 補充劑",
        summary: "深棕色瓶身配有綠色瓶蓋。",
        confirmedFacts: ["180 粒裝"],
        visualHighlights: ["綠色瓶蓋"],
        usageIdeas: ["戶外遊戲"],
      },
    });

    expect(mocks.generateMarketplaceImage).toHaveBeenCalledTimes(2);
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("The merchant selected this lifestyle style: 戶外");
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("unmistakably outdoor, natural-daylight setting");
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("merchant selected this non-factual scene direction: 自然日光露台");
    expect(mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt).toContain("Avoid these unrelated setting categories for this image: 家居, 辦公室");
    expect(mocks.inspectMarketplaceCompositionFromUrl).toHaveBeenCalledWith(expect.objectContaining({
      imageUrl: "https://signed-storage.iwantphoto.test/processed/result.png",
      role: "lifestyle",
      lifestyleStyle: "outdoor",
    }));
    expect(mocks.generateMarketplaceImage.mock.calls[1]?.[0]?.prompt).toContain("first attempt was rejected");
    expect(mocks.generateMarketplaceImage.mock.calls[1]?.[0]?.prompt).toContain("non-white real-world setting");
    expect(mocks.generateMarketplaceImage.mock.calls[1]?.[0]?.prompt).toContain("natural-daylight setting");
    expect(mocks.spendPrepaidCredit).not.toHaveBeenCalled();
    expect(result.outputs[0]).toMatchObject({ role: "lifestyle", compositionCorrected: true });
  });

  it("ignores a tampered scene candidate that conflicts with the selected lifestyle style", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "storage-box.jpg",
      mimeType: "image/jpeg",
      channel: "shopee",
      selectedRoles: ["lifestyle"],
      lifestyleStyle: "home",
      lifestyleScene: { id: "outdoor-patio", style: "outdoor", title: "露台場景", description: "戶外欄杆與日光。" },
      avoidLifestyleStyles: ["home", "outdoor", "outdoor"],
      productBrief: {
        productName: "透明收納盒",
        summary: "透明盒身配有深色扣件。",
        confirmedFacts: ["透明盒身"],
        visualHighlights: [],
        usageIdeas: ["家居收納"],
      },
    });

    const prompt = mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain("The merchant selected this lifestyle style: 家居");
    expect(prompt).not.toContain("露台場景");
    expect(prompt).toContain("Avoid these unrelated setting categories for this image: 戶外");
    expect(prompt).not.toContain("家居, 戶外");
  });

  it("retries one failed role from an owned marketplace source without uploading or counting the original again", async () => {
    mocks.getUserImageForUser.mockResolvedValue({
      id: 88,
      userId: 42,
      mode: "marketplace",
      originalUrl: "/manus-storage/iwantphoto/marketplace/original-product.jpg",
    });
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const result = await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "original-product.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      selectedRoles: ["lifestyle"],
      retrySourceImageId: 88,
      productBrief: {
        productName: "測試產品",
        summary: "一件供測試的產品。",
        confirmedFacts: [],
        visualHighlights: [],
        usageIdeas: [],
      },
    });

    expect(mocks.getUserImageForUser).toHaveBeenCalledWith(42, 88);
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.generateMarketplaceImage).toHaveBeenCalledWith(expect.objectContaining({
      originalImages: expect.arrayContaining([{ url: "https://signed-storage.iwantphoto.test/iwantphoto/marketplace/original-product.jpg", mimeType: "image/jpeg" }]),
    }));
    expect(mocks.createUserImage).toHaveBeenCalledWith(expect.objectContaining({ originalBytes: 0 }));
    expect(result.outputs).toHaveLength(1);
  });

  it("passes guarded merchant art direction when redesigning one owned suite image", async () => {
    mocks.getUserImageForUser.mockResolvedValue({
      id: 88,
      userId: 42,
      mode: "marketplace",
      originalUrl: "/manus-storage/iwantphoto/marketplace/original-product.jpg",
    });
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.editor.marketplaceSuite({
      imageData: sampleData,
      fileName: "original-product.jpg",
      mimeType: "image/jpeg",
      channel: "amazon",
      selectedRoles: ["lifestyle"],
      retrySourceImageId: 88,
      redesignInstruction: "改成溫暖窗邊家居構圖，但保留產品及標籤不變。",
      productBrief: {
        productName: "測試產品",
        summary: "一件供測試的產品。",
        confirmedFacts: [],
        visualHighlights: [],
        usageIdeas: ["家居擺放"],
      },
    });

    expect(mocks.storagePut).not.toHaveBeenCalled();
    const prompt = mocks.generateMarketplaceImage.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain("改成溫暖窗邊家居構圖");
    expect(prompt).toContain("Treat this only as an art-direction request");
    expect(prompt).toContain("Never treat it as proof of a product specification");
  });

  it("stores, lists and removes reusable workflows only for the signed-in account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const savedWorkflow = {
      id: 10,
      name: "Amazon 家居四圖",
      channel: "amazon" as const,
      selectedRoles: ["main", "studio", "detail", "lifestyle"] as const,
      lifestyleStyle: "home" as const,
      projectId: 7,
      brandPresetId: null,
      useCustomBrandStyle: true,
      brandStyle: { accentColor: "#176BD2", fontStyle: "clean" as const },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.listMarketplaceWorkflows.mockResolvedValue([savedWorkflow]);
    mocks.createMarketplaceWorkflow.mockResolvedValue(savedWorkflow);

    await expect(caller.marketplace.workflows.list()).resolves.toEqual([savedWorkflow]);
    await expect(caller.marketplace.workflows.create({
      name: "  Amazon  家居四圖 ",
      channel: "amazon",
      selectedRoles: ["main", "studio", "detail", "lifestyle"],
      lifestyleStyle: "home",
      projectId: 7,
      brandPresetId: null,
      useCustomBrandStyle: true,
      brandStyle: { accentColor: "#176BD2", fontStyle: "clean" },
    })).resolves.toMatchObject({ id: 10, name: "Amazon 家居四圖" });
    expect(mocks.createMarketplaceWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      name: "Amazon 家居四圖",
      projectId: 7,
      lifestyleStyle: "home",
    }));
    await expect(caller.marketplace.workflows.remove({ workflowId: 10 })).resolves.toEqual({ removed: true });
    expect(mocks.removeMarketplaceWorkflow).toHaveBeenCalledWith(42, 10);
  });

  it("limits library reads to the current authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    mocks.listUserImages.mockResolvedValue([{ id: 9, userId: 42, fileName: "saved-product.jpg" }]);

    await expect(caller.library.list()).resolves.toEqual([{ id: 9, userId: 42, fileName: "saved-product.jpg" }]);
    expect(mocks.listUserImages).toHaveBeenCalledWith(42);
  });

  it("returns this month's processing timeline only for the authenticated account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const events = [{ id: 31, units: 1, source: "marketplace_lifestyle", createdAt: new Date("2026-09-20T10:30:00.000Z") }];
    mocks.listUserProcessingUsageSince.mockResolvedValue(events);

    await expect(caller.library.usageTimeline()).resolves.toEqual(events);
    expect(mocks.listUserProcessingUsageSince).toHaveBeenCalledWith(42, expect.any(Date));
  });

  it("returns per-project saved-image storage only for the authenticated account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    mocks.getUserProjectStorageSummary.mockResolvedValue([{ projectId: 7, name: "九月產品圖", imageCount: 3, usedBytes: 900 }]);

    await expect(caller.library.projectStorage()).resolves.toEqual([{ projectId: 7, name: "九月產品圖", imageCount: 3, usedBytes: 900 }]);
    expect(mocks.getUserProjectStorageSummary).toHaveBeenCalledWith(42);
  });

  it("refreshes legacy zero-byte entries only within the authenticated account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.library.refreshStorageMetering()).resolves.toEqual({ checked: 0, updated: 0, failed: 0 });
    expect(mocks.refreshStoredImageSizes).toHaveBeenCalledWith(42, expect.objectContaining({
      listMissing: mocks.listUserImagesMissingStorageBytes,
      update: mocks.updateUserImageStorageBytes,
    }));
  });

  it("bulk removes only selected unclassified images owned by the signed-in account", async () => {
    mocks.removeUnclassifiedUserImages.mockResolvedValue(2);
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.library.removeUnclassified({ imageIds: [12, 13] })).resolves.toEqual({ removed: 2 });
    expect(mocks.removeUnclassifiedUserImages).toHaveBeenCalledWith(42, [12, 13]);
    expect(mocks.getUserImageStorageBytes).toHaveBeenCalledWith(42);
  });

  it("lets the signed-in account control storage email alerts", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    mocks.setStorageEmailAlertsEnabled.mockResolvedValue({ storageEmailAlertsEnabled: 0 });

    await expect(caller.library.setStorageEmailAlerts({ enabled: false })).resolves.toEqual({ enabled: false });
    expect(mocks.setStorageEmailAlertsEnabled).toHaveBeenCalledWith(42, false);
  });

  it("creates and assigns account-owned projects without exposing another account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    mocks.createPhotoProject.mockImplementation(async (project: { userId: number; name: string; clientName: string | null; description: string | null }) => ({ id: 7, ...project }));

    await expect(caller.projects.create({ name: "  九月 產品圖  ", clientName: "  Juno   Store ", description: "  日本  秋季新品  " })).resolves.toMatchObject({ id: 7, name: "九月 產品圖", clientName: "Juno Store", description: "日本 秋季新品" });
    await expect(caller.projects.assignImage({ imageId: 88, projectId: 7 })).resolves.toMatchObject({ projectId: 7 });

    expect(mocks.createPhotoProject).toHaveBeenCalledWith({ userId: 42, name: "九月 產品圖", clientName: "Juno Store", description: "日本 秋季新品" });
    expect(mocks.assignImageToProject).toHaveBeenCalledWith(42, 88, 7);
  });

  it("validates a selected project belongs to the signed-in account before saving a processed image", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.editor.process({ imageData: sampleData, fileName: "assigned-product.jpg", mimeType: "image/jpeg", mode: "background", backgroundStyle: "transparent", projectId: 7 });

    expect(mocks.getPhotoProjectForUser).toHaveBeenCalledWith(42, 7);
    expect(mocks.createUserImage).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, projectId: 7 }));
  });

  it("returns the current plan's saved-image allowance for the authenticated account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    mocks.countUserProcessingUsageSince.mockResolvedValue(7);

    await expect(caller.library.usage()).resolves.toMatchObject({
      plan: "starter",
      allowance: 10,
      used: 7,
      remaining: 3,
      creditBalance: 0,
      storage: expect.objectContaining({
        usedBytes: 0,
        allowanceBytes: 1024 * 1024 * 1024,
        includedGb: 1,
        addOnGb: 0,
      }),
    });
    expect(mocks.countUserProcessingUsageSince).toHaveBeenCalledWith(42, expect.any(Date));
  });

  it("manages named marketplace brand presets only for the signed-in account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const existingPreset = {
      id: 9,
      userId: 42,
      name: "SIM uncle",
      accentColor: "#2F7A63",
      fontStyle: "editorial",
      logoUrl: "/manus-storage/brand/logo.png",
      logoMimeType: "image/png",
      isDefault: 1,
    };
    mocks.listMarketplaceBrandPresets.mockResolvedValue([existingPreset]);
    mocks.createMarketplaceBrandPreset.mockResolvedValue({ ...existingPreset, id: 10, name: "新品系列", accentColor: "#A16324", fontStyle: "friendly" });

    await expect(caller.marketplace.presets()).resolves.toEqual([existingPreset]);
    expect(mocks.listMarketplaceBrandPresets).toHaveBeenCalledWith(42);

    await expect(caller.marketplace.createPreset({ name: "新品系列", accentColor: "#a16324", fontStyle: "friendly" })).resolves.toMatchObject({
      id: 10,
      name: "新品系列",
      accentColor: "#A16324",
    });
    expect(mocks.createMarketplaceBrandPreset).toHaveBeenCalledWith({
      userId: 42,
      name: "新品系列",
      accentColor: "#A16324",
      fontStyle: "friendly",
      logoUrl: undefined,
      logoMimeType: null,
      setAsDefault: undefined,
    });

    await expect(caller.projects.setBrandPreset({ projectId: 7, presetId: 9 })).resolves.toMatchObject({ id: 7, brandPresetId: 1 });
    expect(mocks.setPhotoProjectBrandPreset).toHaveBeenCalledWith(42, 7, 9);
  });

  it("stores an uploaded PNG logo under the signed-in account before creating a preset", async () => {
    mocks.storagePut.mockResolvedValueOnce({ key: "brand-logos/42/sim.png", url: "/manus-storage/brand-logos/42/sim.png" });
    mocks.createMarketplaceBrandPreset.mockResolvedValue({ id: 12, userId: 42, name: "SIM uncle", accentColor: "#176BD2", fontStyle: "clean", logoUrl: "/manus-storage/brand-logos/42/sim.png", logoMimeType: "image/png", isDefault: 1 });
    const logoData = `data:image/png;base64,${Buffer.from("approved-brand-logo").toString("base64")}`;
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.marketplace.createPreset({
      name: "SIM uncle",
      accentColor: "#176bd2",
      fontStyle: "clean",
      logoData,
      logoMimeType: "image/png",
    })).resolves.toMatchObject({ id: 12, logoMimeType: "image/png" });

    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringMatching(/^iwantphoto\/brand-logos\/42\//), expect.any(Buffer), "image/png");
    expect(mocks.createMarketplaceBrandPreset).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      name: "SIM uncle",
      logoUrl: "/manus-storage/brand-logos/42/sim.png",
      logoMimeType: "image/png",
    }));
  });

  it("prevents authenticated processing after the monthly plan allowance is used", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    mocks.countUserProcessingUsageSince.mockResolvedValue(10);

    await expect(caller.editor.process({
      imageData: sampleData,
      fileName: "monthly-limit.jpg",
      mimeType: "image/jpeg",
      mode: "background",
      backgroundStyle: "transparent",
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("10 張額度及加購額度已用完") });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("prevents a saved image from exceeding the account storage allowance", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    mocks.getUserImageStorageBytes.mockResolvedValue(1024 * 1024 * 1024 - 1024);

    await expect(caller.editor.process({ imageData: sampleData, fileName: "storage-limit.jpg", mimeType: "image/jpeg", mode: "background", backgroundStyle: "white" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("儲存空間不足"),
    });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("uses a prepaid credit only after the monthly allowance is exhausted", async () => {
    const caller = appRouter.createCaller({
      ...createAuthenticatedContext(),
      user: { ...createAuthenticatedContext().user!, creditBalance: 8 },
    });
    mocks.countUserProcessingUsageSince.mockResolvedValue(10);
    mocks.spendPrepaidCredit.mockResolvedValue({ spent: true, balance: 7 });

    await expect(caller.editor.process({ imageData: sampleData, fileName: "credit-pack.jpg", mimeType: "image/jpeg", mode: "background", backgroundStyle: "white" })).resolves.toMatchObject({
      url: "/manus-storage/processed/result.png",
    });
    expect(mocks.spendPrepaidCredit).toHaveBeenCalledWith(42);
    expect(mocks.refundPrepaidCredit).not.toHaveBeenCalled();
  });

  it("refunds a reserved prepaid credit when the AI edit fails", async () => {
    const caller = appRouter.createCaller({
      ...createAuthenticatedContext(),
      user: { ...createAuthenticatedContext().user!, creditBalance: 8 },
    });
    mocks.countUserProcessingUsageSince.mockResolvedValue(10);
    mocks.spendPrepaidCredit.mockResolvedValue({ spent: true, balance: 7 });
    mocks.generateImage.mockRejectedValueOnce(new Error("image provider busy"));

    await expect(caller.editor.process({ imageData: sampleData, fileName: "credit-refund.jpg", mimeType: "image/jpeg", mode: "background", backgroundStyle: "white" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.refundPrepaidCredit).toHaveBeenCalledWith(42);
  });

  it("returns only safe subscription status metadata to an authenticated account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.billing.status()).resolves.toMatchObject({
      plan: "starter",
      hasCustomerPortal: false,
    });
  });

  it("rejects anonymous access to the account photo library", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.library.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("removes only the signed-in account's saved image record", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.library.remove({ imageId: 88 })).resolves.toEqual({ removed: true });
    expect(mocks.removeUserImage).toHaveBeenCalledWith(42, 88);
  });

  it("keeps the monthly processing allowance consumed after a library record is deleted", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    mocks.countUserProcessingUsageSince.mockResolvedValue(7);

    await expect(caller.library.usage()).resolves.toMatchObject({ used: 7, remaining: 3 });
    await expect(caller.library.remove({ imageId: 88 })).resolves.toEqual({ removed: true });
    await expect(caller.library.usage()).resolves.toMatchObject({ used: 7, remaining: 3 });

    expect(mocks.removeUserImage).toHaveBeenCalledWith(42, 88);
    expect(mocks.countUserProcessingUsageSince).toHaveBeenCalledTimes(2);
    expect(mocks.recordProcessingUsage).not.toHaveBeenCalled();
  });

  it("bulk removes only selected unclassified images owned by the signed-in account", async () => {
    mocks.removeUnclassifiedUserImages.mockResolvedValue(2);
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.library.removeUnclassified({ imageIds: [12, 13] })).resolves.toEqual({ removed: 2 });
    expect(mocks.removeUnclassifiedUserImages).toHaveBeenCalledWith(42, [12, 13]);
    expect(mocks.getUserImageStorageBytes).toHaveBeenCalledWith(42);
  });
});

describe("auth.updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateUserDisplayName.mockResolvedValue({ ...createAuthenticatedContext().user, displayName: "新 帳戶 名稱" });
  });

  it("updates only the authenticated account's normalized display name", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    const result = await caller.auth.updateProfile({ displayName: "  新   帳戶  名稱 " });

    expect(mocks.updateUserDisplayName).toHaveBeenCalledWith(42, "新 帳戶 名稱");
    expect(result).toMatchObject({ id: 42, displayName: "新 帳戶 名稱" });
  });
});

describe("account avatar, security activity, and administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storagePut.mockResolvedValue({ key: "account-avatars/42/avatar.webp", url: "/manus-storage/account-avatars/42/avatar.webp" });
    mocks.createAccountAvatar.mockResolvedValue({ buffer: Buffer.from("avatar-webp"), mimeType: "image/webp", width: 256, height: 256 });
    mocks.updateUserAvatarUrl.mockResolvedValue({ ...createAuthenticatedContext().user, avatarUrl: "/manus-storage/account-avatars/42/avatar.webp" });
    mocks.recordAccountSecurityEvent.mockResolvedValue(undefined);
    mocks.listAccountSecurityEvents.mockResolvedValue([{ id: 4, userId: 42, event: "signed_in", detail: "已透過安全帳戶登入", createdAt: new Date("2026-09-20T00:00:00Z") }]);
    mocks.getAdminWorkspaceOverview.mockResolvedValue({ totals: { users: 2, activeUsers: 1, savedImages: 3, monthlyImages: 2, storedBytes: 1024 }, plans: [], accounts: [], activities: [] });
  });

  it("normalizes and saves an authenticated account avatar only for its owner", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const result = await caller.auth.updateAvatar({ imageData: sampleData, mimeType: "image/jpeg" });

    expect(mocks.createAccountAvatar).toHaveBeenCalledWith(sampleData, "image/jpeg");
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringMatching(/^iwantphoto\/account-avatars\/42\//), Buffer.from("avatar-webp"), "image/webp");
    expect(mocks.updateUserAvatarUrl).toHaveBeenCalledWith(42, "/manus-storage/account-avatars/42/avatar.webp");
    expect(mocks.recordAccountSecurityEvent).toHaveBeenCalledWith(42, "avatar_updated", "已更新帳戶頭像");
    expect(result).toMatchObject({ id: 42, avatarUrl: "/manus-storage/account-avatars/42/avatar.webp" });
  });

  it("returns security activity for the signed-in account", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    await expect(caller.auth.securityEvents()).resolves.toHaveLength(1);
    expect(mocks.listAccountSecurityEvents).toHaveBeenCalledWith(42);
  });

  it("limits operational overview data to administrators", async () => {
    const memberCaller = appRouter.createCaller(createAuthenticatedContext());
    await expect(memberCaller.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });

    const adminContext = createAuthenticatedContext();
    adminContext.user = { ...adminContext.user!, role: "admin" };
    const adminCaller = appRouter.createCaller(adminContext);
    await expect(adminCaller.admin.overview()).resolves.toMatchObject({ totals: { users: 2 } });
    expect(mocks.getAdminWorkspaceOverview).toHaveBeenCalledOnce();
  });

  it("lets an administrator change only their own non-billing test entitlement", async () => {
    const adminContext = createAuthenticatedContext();
    adminContext.user = { ...adminContext.user!, role: "admin", plan: "starter", adminTestPlan: null };
    mocks.updateAdminTestPlan.mockResolvedValue({ ...adminContext.user, adminTestPlan: "business" });
    const adminCaller = appRouter.createCaller(adminContext);

    await expect(adminCaller.admin.setSelfTestPlan({ plan: "business" })).resolves.toEqual({
      commercialPlan: "starter",
      testPlan: "business",
      effectivePlan: "business",
    });
    expect(mocks.updateAdminTestPlan).toHaveBeenCalledWith(42, "business");
    expect(mocks.recordAccountSecurityEvent).toHaveBeenCalledWith(42, "admin_test_plan_changed", expect.stringContaining("不會更改 Stripe"));
  });

  it("applies the administrator test plan to personal usage without changing commercial billing", async () => {
    const adminContext = createAuthenticatedContext();
    adminContext.user = { ...adminContext.user!, role: "admin", plan: "starter", adminTestPlan: "pro" };
    mocks.countUserProcessingUsageSince.mockResolvedValue(12);
    mocks.getUserImageStorageBytes.mockResolvedValue(0);
    const adminCaller = appRouter.createCaller(adminContext);

    await expect(adminCaller.library.usage()).resolves.toMatchObject({ plan: "pro", commercialPlan: "starter", adminTestPlan: "pro", allowance: 200 });
    await expect(adminCaller.billing.status()).resolves.toMatchObject({ plan: "pro", commercialPlan: "starter", adminTestPlan: "pro" });
  });

  it("does not expose test plan changes to standard users", async () => {
    const memberCaller = appRouter.createCaller(createAuthenticatedContext());
    await expect(memberCaller.admin.setSelfTestPlan({ plan: "pro" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateAdminTestPlan).not.toHaveBeenCalled();
  });
});
