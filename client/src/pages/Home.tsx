import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowRight,
  Brush,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Download,
  Eraser,
  ImagePlus,
  Images,
  LayoutGrid,
  Loader2,
  LogOut,
  Maximize2,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { BrushMaskCanvas } from "@/components/BrushMaskCanvas";
import { BeforeAfterComparison } from "@/components/BeforeAfterComparison";
import { CompactMarketingSections } from "@/components/CompactMarketingSections";
import { AccountProfileDialog } from "@/components/AccountProfileDialog";
import { MarketplaceSuiteDialog } from "@/components/MarketplaceSuiteDialog";
import { BrandPresetManagerDialog, type BrandPresetPayload, type MarketplaceBrandPreset } from "@/components/BrandPresetManagerDialog";
import { PhotoLibraryDialog, type SavedLibraryImage } from "@/components/PhotoLibraryDialog";
import { PlanComparisonTable } from "@/components/PlanComparisonTable";
import { ProcessedImageComparison } from "@/components/ProcessedImageComparison";
import { StorageCapacityPanel, type StorageUsageSummary } from "@/components/StorageCapacityPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { canUseNativeFileShare, createOutputFileName, imageUrlToShareFile } from "@/lib/imageShare";
import { MAX_BATCH_FILES, queueEligible, queueFailed, selectBatchFiles } from "@/lib/batchQueue";
import { estimateBatchProgress, estimateSingleImageProgress, formatEstimatedSeconds, type BatchProgressState } from "@/lib/batchProgress";
import { getCaseStudyPreset, type CaseStudyPresetKey } from "@/lib/caseStudyPresets";
import { selectImagePreviewUrl, type ImagePreviewMode } from "@/lib/imagePreview";
import { returnToOriginalPreview, shouldShowImageComparison } from "@/lib/imageComparisonDisplay";
import { getProcessingErrorMessage, shouldResetBatchFeedback } from "@/lib/processingFeedback";
import { formatProcessingDuration, getProcessingMethodLabel, trimProcessingHistory, type ProcessingHistoryRecord } from "@/lib/processingHistory";
import { getReprocessOptionLabel, getReprocessRequest, type ReprocessOption } from "@/lib/reprocessWorkflow";
import { adjustComparisonAlignment, adjustComparisonScale, DEFAULT_COMPARISON_ALIGNMENT, type ComparisonAlignment, updateComparisonAlignment } from "@/lib/imageAlignment";
import { clearComparisonAlignmentPreference, loadComparisonAlignmentPreference, saveComparisonAlignmentPreference } from "@/lib/comparisonAlignmentPreference";
import { createProcessedDownloadFileName, getMonthlyImageUsage } from "@/lib/photoLibrary";
import { getProjectOptionLabel, type PhotoProject, type PhotoProjectCreateInput } from "@/lib/photoProjects";
import { getUsageAlert } from "@/lib/usageAlerts";
import { getDesktopSettingsPanelCopy, toggleDesktopSettingsPanel, type DesktopSettingsPanelState } from "@/lib/editorPanel";
import { getMobileAccountIdentity, getMobileAccountMenuItems } from "@/lib/mobileAccountMenu";
import { formatAccountLastSignedIn, normaliseAccountDisplayName } from "@/lib/accountProfile";
import type { AccountSecurityActivity } from "@/lib/accountSecurity";
import { getMarketplaceResultFileName, getMarketplaceRoleRequestPlan, mergeMarketplaceSuiteResult, type MarketplaceReferenceImage, type MarketplaceSuiteResult } from "@/lib/marketplaceSuite";
import { resolveMarketplaceLifestyleStyle } from "@/lib/marketplaceLifestyleRecommendation";
import { formatMarketplaceGenerationSeconds, getMarketplaceGenerationProgress } from "@/lib/marketplaceGenerationProgress";
import { inspectMarketplaceReferenceQuality } from "@/lib/marketplaceReferenceQuality";
import { addMarketplaceDraftSnapshot, cloneMarketplaceProductBrief, createMarketplaceDraftSnapshot, formatMarketplaceDraftElapsed, getMarketplaceDraftProgress, hasMarketplaceProductBriefContent, renameMarketplaceDraftSnapshot, type MarketplaceProductBriefSnapshot } from "@/lib/marketplaceDraftHistory";
import { createMarketplacePlatformTemplateCsv, createMarketplacePlatformTemplateXlsx, createMarketplaceProductCsv, createMarketplaceProductXlsx, getMarketplacePlatformTemplateFileName, getMarketplaceProductExportFileName, triggerMarketplaceProductDownload } from "@/lib/marketplaceProductExport";
import { copyMarketplaceText, formatMarketplaceListingBullets, getSavedMarketplaceListingCopyForChannel, type SavedMarketplaceProduct } from "@/lib/marketplaceProductLibrary";
import { PLAN_DIALOG_CONTAINER_CLASS, PLAN_DIALOG_SCROLL_BODY_CLASS } from "@/lib/planDialogLayout";
import { isRecommendedMonthlyPlan } from "@/lib/planRecommendation";
import type { ProjectStorageSummary } from "@/lib/projectStorage";
import { ACCOUNT_PLANS, type AccountPlan } from "@shared/plans";
import { CREDIT_PACKS, type CreditPackKey } from "@shared/creditPacks";
import { storageAllowanceBytes, type StorageAddOnKey } from "@shared/storagePlans";
import { DEFAULT_MARKETPLACE_BRAND_STYLE, getMarketplaceSuite, type MarketplaceBrandStyle, type MarketplaceChannel, type MarketplaceImageRole, type MarketplaceLifestyleStyle } from "@shared/marketplaceSuites";
import { EMPTY_MARKETPLACE_PRODUCT_BRIEF, type MarketplaceDetailSpecificationLayout, type MarketplaceLifestyleRecommendation, type MarketplaceLifestyleSceneCandidate, type MarketplaceProductBrief, type MarketplaceProductBriefDraft } from "@shared/marketplaceProductBrief";
import type { MarketplaceListingCopy } from "@shared/marketplaceListingCopy";
import type { MarketplaceWorkflow } from "@shared/marketplaceWorkflows";
import { emptyThailandMarketplaceListingFields, getThailandMarketplaceListingRequirements } from "@shared/thailandMarketplaceListing";

type EditMode = "background" | "cleanup";
type BackgroundStyle = "transparent" | "white";
type WorkspaceViewMode = "single" | "compare";

type ImageState = {
  previewUrl: string;
  originalData: string;
  fileName: string;
  mimeType: string;
};

type QueueItem = ImageState & {
  id: string;
  resultUrl?: string;
  errorMessage?: string;
  errorMode?: EditMode;
  comparisonAlignment?: ComparisonAlignment;
  status: "ready" | "processing" | "done" | "error";
};

type BatchFailure = Pick<QueueItem, "id" | "fileName">;

type SavedImageRecord = SavedLibraryImage;

const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function normaliseImage(file: File): Promise<File> {
  const isHeic = file.type === "image/heic" || file.type === "image/heif" || /\.hei[cf]$/i.test(file.name);
  if (!isHeic) return file;

  try {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
  } catch {
    throw new Error("HEIC 轉換未能完成，請嘗試改用 JPG 或 PNG 相片。");
  }
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const libraryUtils = trpc.useUtils();
  const [images, setImages] = useState<QueueItem[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>("transparent");
  const [cleanupNote, setCleanupNote] = useState("");
  const [activeMode, setActiveMode] = useState<EditMode | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isBatchSharing, setIsBatchSharing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState | null>(null);
  const [batchFailures, setBatchFailures] = useState<BatchFailure[]>([]);
  const [progressClock, setProgressClock] = useState(() => Date.now());
  const [singleProcessStartedAt, setSingleProcessStartedAt] = useState<number | null>(null);
  const [brushEnabled, setBrushEnabled] = useState(false);
  const [brushSize, setBrushSize] = useState(34);
  const [maskData, setMaskData] = useState<string | null>(null);
  const [brushResetKey, setBrushResetKey] = useState(0);
  const [previewMode, setPreviewMode] = useState<ImagePreviewMode>("original");
  const [workspaceViewMode, setWorkspaceViewMode] = useState<WorkspaceViewMode>("single");
  const [detailPreviewOpen, setDetailPreviewOpen] = useState(false);
  const [desktopSettingsPanel, setDesktopSettingsPanel] = useState<DesktopSettingsPanelState>("expanded");
  const [reprocessOption, setReprocessOption] = useState<ReprocessOption>("background-transparent");
  const [processingHistory, setProcessingHistory] = useState<ProcessingHistoryRecord[]>([]);
  const [savedComparisonAlignment, setSavedComparisonAlignment] = useState<ComparisonAlignment | null>(() => loadComparisonAlignmentPreference(typeof window === "undefined" ? undefined : window.localStorage));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [accountProfileOpen, setAccountProfileOpen] = useState(false);
  const [restoringLibraryImageId, setRestoringLibraryImageId] = useState<number | null>(null);
  const [deletingLibraryImageId, setDeletingLibraryImageId] = useState<number | null>(null);
  const [batchDeletingUnclassified, setBatchDeletingUnclassified] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [marketplaceChannel, setMarketplaceChannel] = useState<MarketplaceChannel>("amazon");
  const [marketplaceProductBrief, setMarketplaceProductBrief] = useState<MarketplaceProductBrief>(EMPTY_MARKETPLACE_PRODUCT_BRIEF);
  const [marketplaceDraftStartedAt, setMarketplaceDraftStartedAt] = useState<number | null>(null);
  const [marketplaceDraftFailure, setMarketplaceDraftFailure] = useState<string | null>(null);
  const [marketplaceDraftRevisionInstruction, setMarketplaceDraftRevisionInstruction] = useState("");
  const [marketplaceDraftHistory, setMarketplaceDraftHistory] = useState<MarketplaceProductBriefSnapshot[]>([]);
  const [marketplaceListingCopy, setMarketplaceListingCopy] = useState<MarketplaceListingCopy | null>(null);
  const [marketplaceSku, setMarketplaceSku] = useState("");
  const [marketplaceReferences, setMarketplaceReferences] = useState<MarketplaceReferenceImage[]>([]);
  const [marketplaceSelectedRoles, setMarketplaceSelectedRoles] = useState<MarketplaceImageRole[]>(["main", "studio", "detail", "lifestyle"]);
  const [marketplaceDetailSpecificationLayout, setMarketplaceDetailSpecificationLayout] = useState<MarketplaceDetailSpecificationLayout>("auto");
  const [marketplaceLifestyleStyle, setMarketplaceLifestyleStyle] = useState<MarketplaceLifestyleStyle>("auto");
  const [marketplaceLifestyleRecommendation, setMarketplaceLifestyleRecommendation] = useState<MarketplaceLifestyleRecommendation | null>(null);
  const [marketplaceLifestyleScene, setMarketplaceLifestyleScene] = useState<MarketplaceLifestyleSceneCandidate | null>(null);
  const [marketplaceLifestyleAvoidStyles, setMarketplaceLifestyleAvoidStyles] = useState<Array<"home" | "office" | "outdoor">>([]);
  const [marketplaceLifestyleStyleIsMerchantSelected, setMarketplaceLifestyleStyleIsMerchantSelected] = useState(false);
  const [marketplaceBrandStyle, setMarketplaceBrandStyle] = useState<MarketplaceBrandStyle>(DEFAULT_MARKETPLACE_BRAND_STYLE);
  const [marketplaceBrandPresetId, setMarketplaceBrandPresetId] = useState<number | null>(null);
  const [marketplaceUsesCustomBrandStyle, setMarketplaceUsesCustomBrandStyle] = useState(false);
  const [brandPresetManagerOpen, setBrandPresetManagerOpen] = useState(false);
  const [marketplaceResult, setMarketplaceResult] = useState<MarketplaceSuiteResult | null>(null);
  const [marketplaceSuiteRunning, setMarketplaceSuiteRunning] = useState(false);
  const [marketplaceSharingRole, setMarketplaceSharingRole] = useState<MarketplaceImageRole | "all" | null>(null);
  const [marketplaceGenerationStartedAt, setMarketplaceGenerationStartedAt] = useState<number | null>(null);
  const [marketplaceGenerationRoles, setMarketplaceGenerationRoles] = useState<MarketplaceImageRole[]>([]);
  const [marketplaceGenerationCompletedCount, setMarketplaceGenerationCompletedCount] = useState(0);
  const [marketplaceRetryingRole, setMarketplaceRetryingRole] = useState<MarketplaceImageRole | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const attemptedLegacyStorageMetering = useRef(false);
  const appliedMarketplaceBrandDefault = useRef<string | null>(null);

  const processImage = trpc.editor.process.useMutation();
  const updateAccountProfileMutation = trpc.auth.updateProfile.useMutation();
  const updateAccountAvatarMutation = trpc.auth.updateAvatar.useMutation();
  const accountSecurityEventsQuery = trpc.auth.securityEvents.useQuery(undefined, { enabled: isAuthenticated && accountProfileOpen, retry: false, refetchOnWindowFocus: false });
  const marketplaceBriefDraftMutation = trpc.editor.marketplaceBriefDraft.useMutation();
  const marketplaceListingCopyMutation = trpc.editor.marketplaceListingCopy.useMutation();
  const marketplaceSuiteMutation = trpc.editor.marketplaceSuite.useMutation();
  const savedMarketplaceProductsQuery = trpc.marketplace.savedProducts.useQuery({ projectId: selectedProjectId ?? 0 }, { enabled: isAuthenticated && Boolean(selectedProjectId), retry: false, refetchOnWindowFocus: false });
  const saveMarketplaceProductMutation = trpc.marketplace.saveProduct.useMutation();
  const marketplaceBrandPresetsQuery = trpc.marketplace.presets.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const createMarketplaceBrandPresetMutation = trpc.marketplace.createPreset.useMutation();
  const updateMarketplaceBrandPresetMutation = trpc.marketplace.updatePreset.useMutation();
  const setMarketplaceBrandDefaultMutation = trpc.marketplace.setDefaultPreset.useMutation();
  const removeMarketplaceBrandPresetMutation = trpc.marketplace.removePreset.useMutation();
  const marketplaceWorkflowsQuery = trpc.marketplace.workflows.list.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const createMarketplaceWorkflowMutation = trpc.marketplace.workflows.create.useMutation();
  const removeMarketplaceWorkflowMutation = trpc.marketplace.workflows.remove.useMutation();
  const libraryQuery = trpc.library.list.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const usageQuery = trpc.library.usage.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const usageTimelineQuery = trpc.library.usageTimeline.useQuery(undefined, { enabled: isAuthenticated && libraryOpen, retry: false, refetchOnWindowFocus: false });
  const projectStorageQuery = trpc.library.projectStorage.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const billingStatusQuery = trpc.billing.status.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const createProjectMutation = trpc.projects.create.useMutation();
  const assignProjectMutation = trpc.projects.assignImage.useMutation();
  const assignProjectBrandPresetMutation = trpc.projects.setBrandPreset.useMutation();
  const removeLibraryImageMutation = trpc.library.remove.useMutation();
  const removeUnclassifiedLibraryImagesMutation = trpc.library.removeUnclassified.useMutation();
  const storageEmailAlertsMutation = trpc.library.setStorageEmailAlerts.useMutation();
  const storageMeteringMutation = trpc.library.refreshStorageMetering.useMutation();
  const checkoutMutation = trpc.billing.createCheckout.useMutation();
  const creditCheckoutMutation = trpc.billing.createCreditCheckout.useMutation();
  const storageCheckoutMutation = trpc.billing.createStorageCheckout.useMutation();
  const portalMutation = trpc.billing.createPortal.useMutation();
  const activeImage = images.find((entry) => entry.id === activeImageId) ?? null;
  const savedImages = (libraryQuery.data ?? []) as SavedImageRecord[];
  const processingTimeline = usageTimelineQuery.data ?? [];
  const projectStorage = (projectStorageQuery.data ?? []) as ProjectStorageSummary[];
  const projects = (projectsQuery.data ?? []) as PhotoProject[];
  const marketplaceBrandPresets = (marketplaceBrandPresetsQuery.data ?? []) as MarketplaceBrandPreset[];
  const marketplaceWorkflows = (marketplaceWorkflowsQuery.data ?? []) as MarketplaceWorkflow[];
  const savedMarketplaceProducts = (savedMarketplaceProductsQuery.data ?? []) as SavedMarketplaceProduct[];
  const accountPlan = (usageQuery.data?.plan ?? user?.plan ?? "starter") as AccountPlan;
  const adminTestModeActive = user?.role === "admin" && Boolean(user.adminTestPlan);
  const usage = getMonthlyImageUsage(usageQuery.data?.used ?? 0, usageQuery.data?.allowance ?? ACCOUNT_PLANS[accountPlan].allowance);
  const creditBalance = usageQuery.data?.creditBalance ?? billingStatusQuery.data?.creditBalance ?? user?.creditBalance ?? 0;
  // What the user can still process: the monthly allowance first, then one-time credits.
  const totalRemaining = usage.remaining + Math.max(0, creditBalance);
  const mobileAccountMenuItems = getMobileAccountMenuItems(ACCOUNT_PLANS[accountPlan].name, totalRemaining);
  const mobileAccountIdentity = getMobileAccountIdentity(user?.displayName || user?.name, user?.email);
  const accountSecurityActivities = (accountSecurityEventsQuery.data ?? []) as AccountSecurityActivity[];
  const usageAlert = getUsageAlert(usage.used, usage.allowance, accountPlan, creditBalance);
  const billingEnabled = Boolean(billingStatusQuery.data?.billingEnabled);
  const storage = (usageQuery.data?.storage ?? {
    usedBytes: 0,
    allowanceBytes: storageAllowanceBytes(accountPlan, user?.storageAddonGb ?? 0),
    remainingBytes: storageAllowanceBytes(accountPlan, user?.storageAddonGb ?? 0),
    includedGb: ACCOUNT_PLANS[accountPlan].includedStorageGb,
    addOnGb: user?.storageAddonGb ?? 0,
  }) as StorageUsageSummary;
  const hasActiveStorageAddOn = Boolean(billingStatusQuery.data?.storageSubscriptionStatus && billingStatusQuery.data.storageSubscriptionStatus !== "canceled" && storage.addOnGb > 0);
  const readyImageCount = queueEligible(images).length;
  const completedImages = images.filter((entry) => entry.status === "done" && Boolean(entry.resultUrl));
  const batchProgressSummary = batchProgress ? estimateBatchProgress(batchProgress, progressClock) : null;
  const singleProgressSummary = singleProcessStartedAt ? estimateSingleImageProgress(singleProcessStartedAt, progressClock) : null;
  const marketplaceDraftProgress = getMarketplaceDraftProgress(marketplaceDraftStartedAt, progressClock);
  const marketplaceDraftElapsed = formatMarketplaceDraftElapsed(marketplaceDraftStartedAt, progressClock);
  const marketplaceGenerationProgress = getMarketplaceGenerationProgress({
    channel: marketplaceChannel,
    roles: marketplaceGenerationRoles,
    startedAt: marketplaceGenerationStartedAt,
    completedCount: marketplaceGenerationCompletedCount,
    now: progressClock,
  });
  const desktopSettingsCopy = getDesktopSettingsPanelCopy(desktopSettingsPanel);

  useEffect(() => {
    if (!isAuthenticated) {
      appliedMarketplaceBrandDefault.current = null;
      setMarketplaceBrandPresetId(null);
      return;
    }
    const projectPresetId = projects.find((project) => project.id === selectedProjectId)?.brandPresetId ?? null;
    if (marketplaceUsesCustomBrandStyle && !projectPresetId) return;
    const preferredPreset = marketplaceBrandPresets.find((preset) => preset.id === projectPresetId)
      ?? marketplaceBrandPresets.find((preset) => preset.id === marketplaceBrandPresetId)
      ?? marketplaceBrandPresets.find((preset) => preset.isDefault === 1)
      ?? marketplaceBrandPresets[0];
    if (!preferredPreset) return;
    const savedKey = `${preferredPreset.id}:${preferredPreset.accentColor}:${preferredPreset.fontStyle}`;
    if (appliedMarketplaceBrandDefault.current === savedKey) return;
    setMarketplaceBrandStyle({ accentColor: preferredPreset.accentColor, fontStyle: preferredPreset.fontStyle });
    setMarketplaceBrandPresetId(preferredPreset.id);
    appliedMarketplaceBrandDefault.current = savedKey;
  }, [isAuthenticated, marketplaceBrandPresets, marketplaceBrandPresetId, marketplaceUsesCustomBrandStyle, projects, selectedProjectId]);

  const addProcessingHistory = (record: ProcessingHistoryRecord) => {
    setProcessingHistory((records) => trimProcessingHistory([record, ...records]));
  };

  const returnToOriginal = () => {
    const next = returnToOriginalPreview();
    setWorkspaceViewMode(next.view);
    setPreviewMode(next.preview);
  };

  const persistComparisonAlignment = (alignment: ComparisonAlignment) => {
    const saved = saveComparisonAlignmentPreference(alignment, typeof window === "undefined" ? undefined : window.localStorage);
    setSavedComparisonAlignment(saved);
    return saved;
  };

  const adjustActiveComparisonAlignment = (horizontalDelta: number, verticalDelta: number) => {
    if (!activeImage) return;
    const comparisonAlignment = adjustComparisonAlignment(activeImage.comparisonAlignment || DEFAULT_COMPARISON_ALIGNMENT, horizontalDelta, verticalDelta);
    updateImage(activeImage.id, {
      comparisonAlignment,
    });
    persistComparisonAlignment(comparisonAlignment);
  };

  const resetActiveComparisonAlignment = () => {
    if (!activeImage) return;
    updateImage(activeImage.id, { comparisonAlignment: DEFAULT_COMPARISON_ALIGNMENT });
  };

  const saveActiveComparisonAlignmentAsDefault = () => {
    if (!activeImage) return;
    persistComparisonAlignment(activeImage.comparisonAlignment || DEFAULT_COMPARISON_ALIGNMENT);
    toast.success("已儲存為日後預設", { description: "此瀏覽器日後完成的新相片會自動套用此微調比例。" });
  };

  const clearSavedComparisonAlignment = () => {
    clearComparisonAlignmentPreference(typeof window === "undefined" ? undefined : window.localStorage);
    setSavedComparisonAlignment(null);
    toast.message("已取消日後預設", { description: "現時這張相片的微調不會受影響。" });
  };

  const downloadSavedImage = async (record: SavedImageRecord) => {
    const response = await fetch(record.processedUrl);
    if (!response.ok) throw new Error("Unable to retrieve saved output");
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = createProcessedDownloadFileName(record.fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 800);
  };

  const openPlans = () => {
    setLibraryOpen(false);
    setPlanOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveAccountDisplayName = async (value: string) => {
    const displayName = normaliseAccountDisplayName(value);
    if (!displayName) {
      toast.error("請輸入顯示名稱。");
      return false;
    }
    try {
      const updated = await updateAccountProfileMutation.mutateAsync({ displayName });
      libraryUtils.auth.me.setData(undefined, updated);
      await libraryUtils.auth.me.invalidate();
      toast.success("已更新帳戶資料", { description: "新的顯示名稱已套用至這個工作台。" });
      return true;
    } catch (error) {
      toast.error("未能儲存帳戶資料", { description: getProcessingErrorMessage(error) });
      return false;
    }
  };

  const uploadAccountAvatar = async (file: File) => {
    const supportedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!supportedTypes.includes(file.type)) {
      toast.error("頭像請使用 PNG、JPG 或 WEBP 檔案。");
      return false;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("頭像必須小於 2 MB。");
      return false;
    }
    try {
      const updated = await updateAccountAvatarMutation.mutateAsync({ imageData: await fileToDataUrl(file), mimeType: file.type });
      libraryUtils.auth.me.setData(undefined, updated);
      await Promise.all([libraryUtils.auth.me.invalidate(), libraryUtils.auth.securityEvents.invalidate()]);
      toast.success("已更新帳戶頭像", { description: "頭像只會用於 Iwantphoto 工作台帳戶辨識。" });
      return true;
    } catch (error) {
      toast.error("未能更新頭像", { description: getProcessingErrorMessage(error) });
      return false;
    }
  };

  const switchAccount = async () => {
    try {
      await logout();
      startLogin();
    } catch (error) {
      toast.error("未能切換帳戶", { description: getProcessingErrorMessage(error) });
    }
  };

  const showPlanActivationNotice = (plan: AccountPlan) => {
    if (plan === "starter") {
      setPlanOpen(false);
      toast.message("Starter 已是免費預設方案", { description: "每月可完成處理 10 張相片。" });
      return;
    }
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!billingEnabled) {
      setPlanOpen(false);
      toast.message("付款服務即將開放", { description: "正在完成安全驗證；確認 webhook 後才會開放結帳。" });
      return;
    }
    if (plan === accountPlan && usageQuery.data?.plan !== "starter") {
      void openBillingPortal();
      return;
    }
    setPlanOpen(false);
    void startCheckout(plan);
  };

  const startCheckout = async (plan: Exclude<AccountPlan, "starter">) => {
    try {
      const result = await checkoutMutation.mutateAsync({ plan });
      window.location.assign(result.url);
    } catch (error) {
      toast.error("未能開啟安全付款頁", { description: getProcessingErrorMessage(error) });
    }
  };

  const startCreditCheckout = async (pack: CreditPackKey) => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!billingEnabled) {
      toast.message("付款服務即將開放", { description: "正在完成安全驗證；確認 webhook 後才會開放結帳。" });
      return;
    }
    try {
      const result = await creditCheckoutMutation.mutateAsync({ pack });
      window.location.assign(result.url);
    } catch (error) {
      toast.error("未能開啟安全付款頁", { description: getProcessingErrorMessage(error) });
    }
  };

  const startStorageCheckout = async (addOn: StorageAddOnKey) => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!billingEnabled) {
      toast.message("付款服務即將開放", { description: "正在完成安全驗證；確認 webhook 後才會開放結帳。" });
      return;
    }
    try {
      const result = await storageCheckoutMutation.mutateAsync({ addOn });
      window.location.assign(result.url);
    } catch (error) {
      toast.error("未能開啟儲存空間付款頁", { description: getProcessingErrorMessage(error) });
    }
  };

  const openBillingPortal = async () => {
    try {
      const result = await portalMutation.mutateAsync();
      window.location.assign(result.url);
    } catch (error) {
      toast.error("未能開啟付款管理", { description: getProcessingErrorMessage(error) });
    }
  };

  const createProject = async (input: PhotoProjectCreateInput) => {
    try {
      const project = await createProjectMutation.mutateAsync(input);
      libraryUtils.projects.list.setData(undefined, (current) => [...(current ?? []), project]);
      await Promise.all([libraryUtils.projects.list.invalidate(), libraryUtils.library.projectStorage.invalidate()]);
      setSelectedProjectId(project.id);
      toast.success("已建立專案", { description: `之後完成的相片會歸入「${project.name}」。` });
    } catch (error) {
      toast.error("未能建立專案", { description: getProcessingErrorMessage(error) });
      throw error;
    }
  };

  const assignSavedImageProject = async (imageId: number, projectId: number | null) => {
    try {
      await assignProjectMutation.mutateAsync({ imageId, projectId });
      await Promise.all([libraryUtils.library.list.invalidate(), libraryUtils.library.projectStorage.invalidate()]);
      toast.success(projectId ? "已更新相片專案" : "已移至未分類相片");
    } catch (error) {
      toast.error("未能更新相片專案", { description: getProcessingErrorMessage(error) });
      throw error;
    }
  };

  const deleteSavedImage = async (record: SavedImageRecord) => {
    setDeletingLibraryImageId(record.id);
    try {
      await removeLibraryImageMutation.mutateAsync({ imageId: record.id });
      await Promise.all([libraryUtils.library.list.invalidate(), libraryUtils.library.usage.invalidate(), libraryUtils.library.projectStorage.invalidate()]);
      toast.success("已移除已儲存相片", { description: "此項已從相片庫移除，帳戶儲存用量會同步更新。" });
    } catch (error) {
      toast.error("未能移除相片", { description: getProcessingErrorMessage(error) });
      throw error;
    } finally {
      setDeletingLibraryImageId(null);
    }
  };

  const deleteUnclassifiedSavedImages = async (imageIds: number[]) => {
    setBatchDeletingUnclassified(true);
    try {
      const result = await removeUnclassifiedLibraryImagesMutation.mutateAsync({ imageIds });
      await Promise.all([
        libraryUtils.library.list.invalidate(),
        libraryUtils.library.usage.invalidate(),
        libraryUtils.library.projectStorage.invalidate(),
      ]);
      return result.removed;
    } catch (error) {
      throw new Error(getProcessingErrorMessage(error));
    } finally {
      setBatchDeletingUnclassified(false);
    }
  };

  const refreshLegacyStorageMetering = async (showFeedback = true) => {
    try {
      const result = await storageMeteringMutation.mutateAsync();
      await Promise.all([
        libraryUtils.library.list.invalidate(),
        libraryUtils.library.usage.invalidate(),
        libraryUtils.library.projectStorage.invalidate(),
      ]);
      if (!showFeedback) return result;
      if (result.updated > 0) {
        toast.success("已更新儲存用量", { description: `已核對 ${result.updated} 張較早儲存的相片；未分類相片亦已計入帳戶總容量。` });
      } else if (result.checked === 0) {
        toast.message("儲存統計已是最新", { description: "所有已儲存相片（包括未分類）均已計入帳戶總容量。" });
      } else {
        toast.message("部分相片未能核對", { description: `已更新 ${result.updated} 張；${result.failed} 張會在下次開啟時再試。` });
      }
      return result;
    } catch (error) {
      if (showFeedback) toast.error("未能重新核對容量", { description: getProcessingErrorMessage(error) });
      return undefined;
    }
  };

  const setStorageEmailAlerts = async (enabled: boolean) => {
    try {
      await storageEmailAlertsMutation.mutateAsync({ enabled });
      await libraryUtils.library.usage.invalidate();
      toast.success(enabled ? "已開啟容量電郵提醒" : "已關閉容量電郵提醒", {
        description: enabled ? "帳戶首次達 80% 或 95% 儲存用量時會通知你。" : "你仍可在「我的相片」查看儲存用量。",
      });
    } catch (error) {
      toast.error("未能更新容量提醒", { description: getProcessingErrorMessage(error) });
    }
  };

  useEffect(() => {
    if (!libraryOpen || !isAuthenticated || attemptedLegacyStorageMetering.current || storageMeteringMutation.isPending) return;
    const hasMissingSize = savedImages.some((image) => image.originalBytes <= 0 || image.processedBytes <= 0);
    if (!hasMissingSize) return;
    attemptedLegacyStorageMetering.current = true;
    void refreshLegacyStorageMetering(false);
  }, [libraryOpen, isAuthenticated, savedImages, storageMeteringMutation.isPending]);

  const restoreLibraryImage = async (record: SavedImageRecord) => {
    setRestoringLibraryImageId(record.id);
    try {
      const response = await fetch(record.originalUrl);
      if (!response.ok) throw new Error("Unable to retrieve the saved original image");
      const originalBlob = await response.blob();
      const previewUrl = URL.createObjectURL(originalBlob);
      const originalData = await blobToDataUrl(originalBlob);
      images.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
      const restoredImage: QueueItem = {
        id: crypto.randomUUID(),
        previewUrl,
        originalData,
        fileName: record.fileName,
        mimeType: record.mimeType,
        resultUrl: record.processedUrl,
        comparisonAlignment: savedComparisonAlignment || DEFAULT_COMPARISON_ALIGNMENT,
        status: "done",
      };
      setImages([restoredImage]);
      setActiveImageId(restoredImage.id);
      setBackgroundStyle(record.backgroundStyle);
      setCleanupNote(record.cleanupNote || "");
      setSelectedProjectId(record.projectId);
      setPreviewMode("processed");
      setWorkspaceViewMode("single");
      setBatchProgress(null);
      setBatchFailures([]);
      setProcessingHistory([]);
      setLibraryOpen(false);
      window.setTimeout(() => document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      toast.success("已重新開啟相片", { description: "已載入原圖與成品，可繼續比較、下載或重新處理。" });
    } catch {
      toast.error("未能重新開啟相片", { description: "檔案暫時無法載入，請稍後重試。" });
    } finally {
      setRestoringLibraryImageId(null);
    }
  };

  const scaleActiveComparisonAlignment = (scaleDelta: number) => {
    if (!activeImage) return;
    const comparisonAlignment = adjustComparisonScale(activeImage.comparisonAlignment || DEFAULT_COMPARISON_ALIGNMENT, scaleDelta);
    updateImage(activeImage.id, {
      comparisonAlignment,
    });
    persistComparisonAlignment(comparisonAlignment);
  };

  const setActiveComparisonAlignment = (updates: Partial<ComparisonAlignment>) => {
    if (!activeImage) return;
    const comparisonAlignment = updateComparisonAlignment(activeImage.comparisonAlignment || DEFAULT_COMPARISON_ALIGNMENT, updates);
    updateImage(activeImage.id, { comparisonAlignment });
    persistComparisonAlignment(comparisonAlignment);
  };

  useEffect(() => {
    if (!isBatchProcessing && !singleProcessStartedAt && !marketplaceDraftStartedAt && !marketplaceGenerationStartedAt) return;
    const timer = window.setInterval(() => setProgressClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [isBatchProcessing, marketplaceDraftStartedAt, marketplaceGenerationStartedAt, singleProcessStartedAt]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const creditPurchaseComplete = params.get("credit_purchase") === "success";
    const storagePurchaseComplete = params.get("storage_purchase") === "success";
    if (!creditPurchaseComplete && !storagePurchaseComplete) return;
    void libraryUtils.library.usage.invalidate();
    void libraryUtils.billing.status.invalidate();
    toast.success("付款已完成", { description: creditPurchaseComplete ? "正在安全核實付款並將加購額度存入帳戶。" : "正在安全核實付款並啟用儲存空間。" });
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  }, [libraryUtils]);

  useEffect(() => {
    setBrushEnabled(false);
    setMaskData(null);
    setBrushResetKey((value) => value + 1);
    setPreviewMode("original");
    setWorkspaceViewMode("single");
    setDetailPreviewOpen(false);
  }, [activeImageId]);

  const updateImage = (id: string, updates: Partial<QueueItem>) => {
    setImages((entries) => entries.map((entry) => entry.id === id ? { ...entry, ...updates } : entry));
  };

  const startCaseWorkflow = (caseKey: CaseStudyPresetKey) => {
    const preset = getCaseStudyPreset(caseKey);
    setBackgroundStyle(preset.backgroundStyle);
    setCleanupNote(preset.cleanupNote);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success(`已套用${preset.label}`, { description: "在頁首按「上載並開始處理」，加入你的相片後即可開始。" });
  };

  const handleFiles = async (selectedFiles: FileList | File[] | null | undefined) => {
    if (!selectedFiles?.length) return;
    if (images.length === 0) {
      setBatchProgress(null);
      setBatchFailures([]);
      setActiveMode(null);
      setProcessingHistory([]);
    }
    const candidates = selectBatchFiles(Array.from(selectedFiles), images.length);
    if (!candidates.length) {
      toast.error(`每次最多可處理 ${MAX_BATCH_FILES} 張相片。`);
      return;
    }

    const prepared: QueueItem[] = [];
    let rejected = 0;
    for (const selected of candidates) {
      if (!acceptedTypes.includes(selected.type) && !/\.(jpe?g|png|webp|hei[cf])$/i.test(selected.name)) {
        rejected += 1;
        continue;
      }
      if (selected.size > 12 * 1024 * 1024) {
        rejected += 1;
        continue;
      }
      try {
        const file = await normaliseImage(selected);
        prepared.push({
          id: crypto.randomUUID(),
          previewUrl: URL.createObjectURL(file),
          originalData: await fileToDataUrl(file),
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          status: "ready",
        });
      } catch {
        rejected += 1;
      }
    }

    if (prepared.length) {
      setImages((entries) => [...entries, ...prepared]);
      setActiveImageId((current) => current ?? prepared[0].id);
      toast.success(`已加入 ${prepared.length} 張相片`, { description: "可逐張修圖，或整批移除背景。" });
    }
    if (rejected || candidates.length < selectedFiles.length) {
      toast.message("部分相片未加入", { description: "只支援每張不超過 12 MB 的 JPG、PNG、WEBP 或 HEIC；每批最多 10 張。" });
    }
  };

  const processEntry = async (entry: QueueItem, mode: EditMode, selectionMask?: string | null, requestedBackgroundStyle: BackgroundStyle = backgroundStyle) => {
    const startedAt = Date.now();
    updateImage(entry.id, { status: "processing", errorMessage: undefined, errorMode: undefined });
    try {
      const data = await processImage.mutateAsync({
        imageData: entry.originalData,
        fileName: entry.fileName,
        mimeType: entry.mimeType,
        mode,
        backgroundStyle: requestedBackgroundStyle,
        cleanupNote: mode === "cleanup" ? cleanupNote.trim() : undefined,
        maskData: mode === "cleanup" ? selectionMask || undefined : undefined,
        projectId: isAuthenticated && selectedProjectId ? selectedProjectId : undefined,
      });
      if (!data.url) throw new Error("未能取得處理後的相片。");
      updateImage(entry.id, { resultUrl: data.url, status: "done", errorMessage: undefined, errorMode: undefined, comparisonAlignment: savedComparisonAlignment || DEFAULT_COMPARISON_ALIGNMENT });
      if (data.savedImageId) void Promise.all([libraryUtils.library.list.invalidate(), libraryUtils.library.usage.invalidate(), libraryUtils.library.usageTimeline.invalidate(), libraryUtils.library.projectStorage.invalidate()]);
      if (entry.id === activeImageId) {
        setPreviewMode("processed");
        setWorkspaceViewMode("single");
      }
      addProcessingHistory({
        id: crypto.randomUUID(),
        imageId: entry.id,
        fileName: entry.fileName,
        mode,
        backgroundStyle: requestedBackgroundStyle,
        durationMs: Date.now() - startedAt,
        completedAt: Date.now(),
        success: true,
      });
      return { success: true as const };
    } catch (error) {
      const message = getProcessingErrorMessage(error);
      updateImage(entry.id, { status: "error", errorMessage: message, errorMode: mode });
      addProcessingHistory({
        id: crypto.randomUUID(),
        imageId: entry.id,
        fileName: entry.fileName,
        mode,
        backgroundStyle: requestedBackgroundStyle,
        durationMs: Date.now() - startedAt,
        completedAt: Date.now(),
        success: false,
        message,
      });
      return { success: false as const, message };
    }
  };

  const runProcess = async (mode: EditMode, requestedBackgroundStyle: BackgroundStyle = backgroundStyle) => {
    if (!activeImage || processImage.isPending || isBatchProcessing) return;
    if (mode === "cleanup" && !cleanupNote.trim() && !maskData) {
      toast.error("請先說明想清除甚麼內容，或用筆刷圈選範圍。");
      return;
    }
    const startedAt = Date.now();
    setProgressClock(startedAt);
    setSingleProcessStartedAt(startedAt);
    setActiveMode(mode);
    const result = await processEntry(activeImage, mode, mode === "cleanup" ? maskData : undefined, requestedBackgroundStyle);
    setActiveMode(null);
    setSingleProcessStartedAt(null);
    if (result.success) {
      if (mode === "cleanup") {
        setBrushEnabled(false);
        setMaskData(null);
        setBrushResetKey((value) => value + 1);
      }
      toast.success("處理完成，請預覽效果。", { description: "你可以下載成品或直接分享到 WhatsApp。" });
    }
    else toast.error("暫時未能完成處理", { description: `${result.message} 可按「重新嘗試本張」再試。` });
  };

  const runSelectedReprocess = () => {
    if (!activeImage || processImage.isPending || isBatchProcessing) return;
    const request = getReprocessRequest(reprocessOption, backgroundStyle);
    setBackgroundStyle(request.backgroundStyle);
    toast.message(`已選擇${getReprocessOptionLabel(reprocessOption)}`, { description: "正在以原始相片重新處理。" });
    void runProcess(request.mode, request.backgroundStyle);
  };

  const runBatchBackground = async (retryFailuresOnly = false) => {
    const queue = retryFailuresOnly ? queueFailed(images) : queueEligible(images);
    if (!queue.length || isBatchProcessing || processImage.isPending) return;
    const startedAt = Date.now();
    setIsBatchProcessing(true);
    setActiveMode("background");
    setBatchFailures([]);
    setBatchProgress({ total: queue.length, completed: 0, completedDurationMs: 0, currentStartedAt: startedAt });
    setProgressClock(startedAt);
    let completed = 0;
    let completedDurationMs = 0;
    const failures: BatchFailure[] = [];
    for (const entry of queue) {
      setActiveImageId(entry.id);
      const imageStartedAt = Date.now();
      if ((await processEntry(entry, "background", undefined, backgroundStyle)).success) completed += 1;
      else failures.push({ id: entry.id, fileName: entry.fileName });
      completedDurationMs += Date.now() - imageStartedAt;
      const processedCount = completed + failures.length;
      setBatchFailures([...failures]);
      setBatchProgress({ total: queue.length, completed: processedCount, completedDurationMs, currentStartedAt: Date.now() });
      setProgressClock(Date.now());
    }
    setActiveMode(null);
    setIsBatchProcessing(false);
    toast[completed === queue.length ? "success" : "message"](`批量去背完成：${completed}/${queue.length} 張`, {
      description: completed === queue.length ? "逐張選擇相片即可下載或直接傳送。" : `${failures.length} 張未能完成，請用失敗名單下方的按鈕重試。`,
    });
  };

  const resetEditor = () => {
    if (!activeImage) return;
    updateImage(activeImage.id, { resultUrl: undefined, status: "ready" });
    setActiveMode(null);
    setPreviewMode("original");
    setWorkspaceViewMode("single");
    setBrushEnabled(false);
    setMaskData(null);
    setBrushResetKey((value) => value + 1);
    toast.message("已還原至原始相片。");
  };

  const toggleBrushSelection = () => {
    if (!activeImage || processImage.isPending || isBatchProcessing) return;
    if (activeImage.resultUrl) {
      toast.message("請先還原至原圖", { description: "筆刷選取會套用至原始相片，以確保圈選位置準確。" });
      return;
    }
    setBrushEnabled((enabled) => !enabled);
  };

  const clearBrushSelection = () => {
    setMaskData(null);
    setBrushResetKey((value) => value + 1);
  };

  const removeImage = (id: string) => {
    const entry = images.find((item) => item.id === id);
    if (entry) URL.revokeObjectURL(entry.previewUrl);
    const remaining = images.filter((entry) => entry.id !== id);
    setImages(remaining);
    setActiveImageId(remaining[0]?.id ?? null);
    if (shouldResetBatchFeedback(remaining.length)) {
      setBatchProgress(null);
      setBatchFailures([]);
      setActiveMode(null);
      setBrushEnabled(false);
      setMaskData(null);
      setProcessingHistory([]);
    }
  };

 const downloadImage = async () => {
    const url = activeImage?.resultUrl || activeImage?.previewUrl;
   if (!url) return;
   try {
     const response = await fetch(url);
     const blob = await response.blob();
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
      link.download = `iwantphoto-${activeImage?.fileName.replace(/\.[^.]+$/, "") || "image"}.png`;
     document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      link.remove();
      toast.success("成品已開始下載。");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.message("已在新分頁開啟圖片，請長按或另存下載。");
    }
  };

 const shareWhatsApp = async () => {
    const url = activeImage?.resultUrl || activeImage?.previewUrl;
   if (!url) return;
   try {
      const imageFile = await imageUrlToShareFile(url, activeImage?.fileName);
      if (canUseNativeFileShare(imageFile)) {
        await navigator.share({
          files: [imageFile],
          title: "商業相片",
        });
        return;
      }

     const link = document.createElement("a");
     link.href = URL.createObjectURL(imageFile);
      link.download = createOutputFileName(activeImage?.fileName, imageFile.type);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.message("此瀏覽器未支援直接分享圖片，已開始下載；請在 WhatsApp 選擇這張相片傳送。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("未能準備圖片分享", { description: "請先下載相片，再在 WhatsApp 內傳送。" });
    }
  };

  const shareBatchWhatsApp = async () => {
    if (completedImages.length < 2 || isBatchSharing) return;
    setIsBatchSharing(true);
    try {
      const files = await Promise.all(completedImages.map((entry) => imageUrlToShareFile(entry.resultUrl!, entry.fileName)));
      if (!canUseNativeFileShare(files)) {
        toast.message("此瀏覽器未支援一次分享多張圖片", { description: "請用手機 Safari 或 Chrome 開啟網站，再選 WhatsApp 傳送。" });
        return;
      }
      await navigator.share({
        files,
        title: "商業相片",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("未能準備批量 WhatsApp 分享", { description: "請確認相片已完成處理，然後再試。" });
    } finally {
      setIsBatchSharing(false);
    }
  };

  const draftMarketplaceProductBrief = async (references = marketplaceReferences, preserveExisting = references === marketplaceReferences, revisionInstruction = marketplaceDraftRevisionInstruction, preserveSceneSelection = marketplaceLifestyleStyleIsMerchantSelected) => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!references.length || marketplaceBriefDraftMutation.isPending) return;
    const previousBrief = cloneMarketplaceProductBrief(marketplaceProductBrief);
    const hadPreviousContent = preserveExisting && hasMarketplaceProductBriefContent(previousBrief);
    const startedAt = Date.now();
    setMarketplaceDraftFailure(null);
    setMarketplaceDraftStartedAt(startedAt);
    setProgressClock(startedAt);
    if (hadPreviousContent) {
      setMarketplaceDraftHistory((history) => addMarketplaceDraftSnapshot(history, createMarketplaceDraftSnapshot(previousBrief, "merchant", startedAt)));
    }
    try {
      const brief = await marketplaceBriefDraftMutation.mutateAsync({
        imageData: references[0].originalData,
        mimeType: references[0].mimeType,
        referenceImages: references.map((reference) => ({
          imageData: reference.originalData,
          mimeType: reference.mimeType,
          fileName: reference.fileName,
        })),
        ...(preserveExisting && hasMarketplaceProductBriefContent(previousBrief) ? { currentBrief: previousBrief } : {}),
        ...(revisionInstruction.trim() ? { revisionInstruction: revisionInstruction.trim() } : {}),
      });
      const drafted = brief as MarketplaceProductBriefDraft;
      const draftedBrief = drafted.brief;
      setMarketplaceProductBrief(draftedBrief);
      setMarketplaceLifestyleRecommendation(drafted.lifestyleRecommendation);
      setMarketplaceLifestyleStyle(resolveMarketplaceLifestyleStyle({
        currentStyle: marketplaceLifestyleStyle,
        recommendation: drafted.lifestyleRecommendation,
        merchantSelected: preserveSceneSelection,
      }));
      if (!preserveSceneSelection) {
        setMarketplaceLifestyleScene(drafted.lifestyleRecommendation.candidates[0] ?? null);
        setMarketplaceLifestyleAvoidStyles(drafted.lifestyleRecommendation.avoidStyles);
      }
      setMarketplaceDraftHistory((history) => addMarketplaceDraftSnapshot(history, createMarketplaceDraftSnapshot(draftedBrief, "ai")));
      setMarketplaceListingCopy(null);
      if (revisionInstruction.trim()) setMarketplaceDraftRevisionInstruction("");
      toast.success(revisionInstruction.trim() ? "已按要求更新產品資料" : "已草擬產品資料", { description: preserveSceneSelection ? "已保留你選擇的情境風格；請逐項核對後再生成。" : "AI 已按產品相片建議情境風格；請逐項核對後再生成。" });
    } catch (error) {
      const message = getProcessingErrorMessage(error);
      setMarketplaceDraftFailure(hadPreviousContent ? `草擬未完成，已保留你目前的資料。${message}` : `草擬未完成。${message}`);
      toast.error("未能草擬產品資料", { description: hadPreviousContent ? "你已填寫的內容沒有被清除，可稍後重試。" : message });
    } finally {
      setMarketplaceDraftStartedAt(null);
    }
  };

  const draftMarketplaceListingCopy = async () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!marketplaceProductBrief.productName.trim() || !marketplaceProductBrief.summary.trim() || marketplaceListingCopyMutation.isPending) {
      toast.error("請先確認產品名稱及產品描述。", { description: "上架文案只會根據你已核實的資料建立。" });
      return;
    }
    try {
      const copy = await marketplaceListingCopyMutation.mutateAsync({ channel: marketplaceChannel, productBrief: marketplaceProductBrief });
      const draftedCopy = copy as MarketplaceListingCopy;
      const thailandRequirements = getThailandMarketplaceListingRequirements(marketplaceChannel);
      setMarketplaceListingCopy(thailandRequirements ? {
        ...draftedCopy,
        thailandFields: {
          ...emptyThailandMarketplaceListingFields(),
          description: [marketplaceProductBrief.summary.trim(), ...draftedCopy.bullets.filter(Boolean)].filter(Boolean).join("\n").slice(0, thailandRequirements.descriptionLimit),
        },
      } : draftedCopy);
      toast.success("已建立上架文案草稿", { description: "請核對五點描述，再匯出或複製到實際上架頁面。" });
    } catch (error) {
      toast.error("未能建立上架文案", { description: getProcessingErrorMessage(error) });
    }
  };

  const exportMarketplaceProductData = async (format: "csv" | "xlsx") => {
    if (!marketplaceProductBrief.productName.trim() || !marketplaceProductBrief.summary.trim()) {
      toast.error("請先填寫產品名稱及產品描述，才可匯出。");
      return;
    }
    try {
      const exportData = { channel: marketplaceChannel, brief: marketplaceProductBrief, listingCopy: marketplaceListingCopy };
      const fileName = getMarketplaceProductExportFileName(marketplaceProductBrief.productName, format);
      const blob = format === "csv"
        ? new Blob([createMarketplaceProductCsv(exportData)], { type: "text/csv;charset=utf-8" })
        : new Blob([await createMarketplaceProductXlsx(exportData)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      triggerMarketplaceProductDownload(blob, fileName);
      toast.success(`已下載 ${format.toUpperCase()} 商品資料`, { description: marketplaceListingCopy ? "包括已生成的商品標題與五點描述。" : "包括已確認的產品資料；可先生成上架文案再重新匯出。" });
    } catch (error) {
      toast.error("未能準備匯出檔案", { description: getProcessingErrorMessage(error) });
    }
  };

  const exportMarketplacePlatformTemplate = async (format: "csv" | "xlsx") => {
    if (!marketplaceSku.trim()) {
      toast.error("請先輸入 SKU，才可建立平台上架模板。", { description: "SKU 會填入平台模板的產品識別欄位。" });
      return;
    }
    if (!marketplaceProductBrief.productName.trim() || !marketplaceProductBrief.summary.trim()) {
      toast.error("請先確認產品名稱及產品描述，才可建立平台上架模板。");
      return;
    }
    try {
      const exportData = { channel: marketplaceChannel, sku: marketplaceSku, brief: marketplaceProductBrief, listingCopy: marketplaceListingCopy };
      const fileName = getMarketplacePlatformTemplateFileName(marketplaceProductBrief.productName, marketplaceChannel, format);
      const blob = format === "csv"
        ? new Blob([createMarketplacePlatformTemplateCsv(exportData)], { type: "text/csv;charset=utf-8" })
        : new Blob([await createMarketplacePlatformTemplateXlsx(exportData)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      triggerMarketplaceProductDownload(blob, fileName);
      toast.success(`已下載 ${marketplaceChannel} 平台模板`, { description: "這是預填起始欄位；請再對照目標類目與最新官方批量上架模板。" });
    } catch (error) {
      toast.error("未能準備平台模板", { description: getProcessingErrorMessage(error) });
    }
  };

  const copyMarketplaceListingText = async (kind: "title" | "bullets") => {
    try {
      const text = kind === "title" ? marketplaceListingCopy?.title ?? "" : formatMarketplaceListingBullets(marketplaceListingCopy);
      await copyMarketplaceText(text);
      toast.success(kind === "title" ? "已複製商品標題" : "已複製五點描述");
    } catch (error) {
      toast.error("未能複製文字", { description: getProcessingErrorMessage(error) });
    }
  };

  const saveMarketplaceProduct = async () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!selectedProjectId) {
      toast.error("請先選擇一個專案。", { description: "SKU 資料會保存在該專案，方便日後重用。" });
      return;
    }
    if (!marketplaceSku.trim()) {
      toast.error("請輸入 SKU，才可儲存產品資料。");
      return;
    }
    if (!marketplaceProductBrief.productName.trim() || !marketplaceProductBrief.summary.trim()) {
      toast.error("請先確認產品名稱及產品描述，才可儲存 SKU 資料。");
      return;
    }
    try {
      const saved = await saveMarketplaceProductMutation.mutateAsync({
        projectId: selectedProjectId,
        sku: marketplaceSku,
        productBrief: marketplaceProductBrief,
        listingCopy: marketplaceListingCopy,
      });
      setMarketplaceSku(saved.sku);
      await libraryUtils.marketplace.savedProducts.invalidate({ projectId: selectedProjectId });
      toast.success("已儲存到專案 SKU 資料庫", { description: "同一專案再次選取此 SKU 時，可直接套用已核實資料。" });
    } catch (error) {
      toast.error("未能儲存 SKU 資料", { description: getProcessingErrorMessage(error) });
    }
  };

  const loadSavedMarketplaceProduct = (product: SavedMarketplaceProduct) => {
    setMarketplaceSku(product.sku);
    setMarketplaceProductBrief(cloneMarketplaceProductBrief(product.brief));
    setMarketplaceLifestyleRecommendation(null);
    setMarketplaceLifestyleScene(null);
    setMarketplaceLifestyleAvoidStyles([]);
    setMarketplaceLifestyleStyleIsMerchantSelected(true);
    setMarketplaceListingCopy(getSavedMarketplaceListingCopyForChannel(product, marketplaceChannel));
    setMarketplaceDraftFailure(null);
    setMarketplaceDraftRevisionInstruction("");
    setMarketplaceResult(null);
    toast.success(`已套用 ${product.sku}`, { description: "已載入該專案已核實資料；請按需要更新並再次儲存。" });
  };

  const selectMarketplaceFiles = async (selectedFiles: File[]) => {
    if (!selectedFiles.length) {
      marketplaceReferences.forEach((reference) => URL.revokeObjectURL(reference.previewUrl));
      setMarketplaceReferences([]);
      setMarketplaceProductBrief(EMPTY_MARKETPLACE_PRODUCT_BRIEF);
      setMarketplaceLifestyleRecommendation(null);
      setMarketplaceLifestyleScene(null);
      setMarketplaceLifestyleAvoidStyles([]);
      setMarketplaceDraftHistory([]);
      setMarketplaceDraftFailure(null);
      setMarketplaceDraftRevisionInstruction("");
      setMarketplaceListingCopy(null);
      setMarketplaceResult(null);
      return;
    }
    if (selectedFiles.length > 3) {
      toast.error("最多可上載 3 張不同角度的產品相片。");
      return;
    }
    if (selectedFiles.some((selected) => !acceptedTypes.includes(selected.type) && !/\.(jpe?g|png|webp|hei[cf])$/i.test(selected.name))) {
      toast.error("請選擇 JPG、PNG、WEBP 或 HEIC 產品相片。");
      return;
    }
    if (selectedFiles.some((selected) => selected.size > 12 * 1024 * 1024)) {
      toast.error("產品相片必須小於 12 MB。");
      return;
    }
    try {
      const references = await Promise.all(selectedFiles.map(async (selected) => {
        const file = await normaliseImage(selected);
        return {
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          originalData: await fileToDataUrl(file),
          previewUrl: URL.createObjectURL(file),
          quality: await inspectMarketplaceReferenceQuality(file),
        };
      }));
      marketplaceReferences.forEach((reference) => URL.revokeObjectURL(reference.previewUrl));
      setMarketplaceReferences(references);
      setMarketplaceProductBrief(EMPTY_MARKETPLACE_PRODUCT_BRIEF);
      setMarketplaceLifestyleRecommendation(null);
      setMarketplaceLifestyleScene(null);
      setMarketplaceLifestyleAvoidStyles([]);
      setMarketplaceLifestyleStyle("auto");
      setMarketplaceLifestyleStyleIsMerchantSelected(false);
      setMarketplaceDraftHistory([]);
      setMarketplaceDraftFailure(null);
      setMarketplaceDraftRevisionInstruction("");
      setMarketplaceListingCopy(null);
      setMarketplaceResult(null);
      if (isAuthenticated) void draftMarketplaceProductBrief(references, false, "", false);
    } catch (error) {
      toast.error("未能準備產品相片", { description: getProcessingErrorMessage(error) });
    }
  };

  const removeMarketplaceReference = (index: number) => {
    const reference = marketplaceReferences[index];
    if (!reference) return;
    URL.revokeObjectURL(reference.previewUrl);
    const nextReferences = marketplaceReferences.filter((_, referenceIndex) => referenceIndex !== index);
    setMarketplaceReferences(nextReferences);
    setMarketplaceProductBrief(EMPTY_MARKETPLACE_PRODUCT_BRIEF);
    setMarketplaceLifestyleRecommendation(null);
    setMarketplaceLifestyleScene(null);
    setMarketplaceLifestyleAvoidStyles([]);
    setMarketplaceLifestyleStyle("auto");
    setMarketplaceLifestyleStyleIsMerchantSelected(false);
    setMarketplaceDraftHistory([]);
    setMarketplaceDraftFailure(null);
    setMarketplaceDraftRevisionInstruction("");
    setMarketplaceListingCopy(null);
    setMarketplaceResult(null);
    if (isAuthenticated && nextReferences.length) void draftMarketplaceProductBrief(nextReferences, false, "", false);
  };

  const refreshMarketplaceBrandPresets = async () => {
    await Promise.all([libraryUtils.marketplace.presets.invalidate(), libraryUtils.projects.list.invalidate()]);
  };

  const createMarketplaceBrandPreset = async (payload: BrandPresetPayload) => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    try {
      const preset = await createMarketplaceBrandPresetMutation.mutateAsync(payload);
      setMarketplaceBrandPresetId(preset.id);
      setMarketplaceUsesCustomBrandStyle(false);
      setMarketplaceBrandStyle({ accentColor: preset.accentColor, fontStyle: preset.fontStyle });
      appliedMarketplaceBrandDefault.current = `${preset.id}:${preset.accentColor}:${preset.fontStyle}`;
      await refreshMarketplaceBrandPresets();
      toast.success("已建立品牌預設", { description: `「${preset.name}」已可用於商品套組。` });
    } catch (error) {
      toast.error("未能建立品牌預設", { description: getProcessingErrorMessage(error) });
    }
  };

  const updateMarketplaceBrandPreset = async (presetId: number, payload: BrandPresetPayload) => {
    try {
      const preset = await updateMarketplaceBrandPresetMutation.mutateAsync({ presetId, ...payload });
      setMarketplaceBrandPresetId(preset.id);
      setMarketplaceUsesCustomBrandStyle(false);
      setMarketplaceBrandStyle({ accentColor: preset.accentColor, fontStyle: preset.fontStyle });
      appliedMarketplaceBrandDefault.current = `${preset.id}:${preset.accentColor}:${preset.fontStyle}`;
      await refreshMarketplaceBrandPresets();
      toast.success("已更新品牌預設", { description: `「${preset.name}」的風格和 Logo 已更新。` });
    } catch (error) {
      toast.error("未能更新品牌預設", { description: getProcessingErrorMessage(error) });
      throw error;
    }
  };

  const setMarketplaceBrandDefault = async (presetId: number) => {
    try {
      await setMarketplaceBrandDefaultMutation.mutateAsync({ presetId });
      const preset = marketplaceBrandPresets.find((item) => item.id === presetId);
      if (preset) {
        setMarketplaceBrandPresetId(preset.id);
        setMarketplaceUsesCustomBrandStyle(false);
        setMarketplaceBrandStyle({ accentColor: preset.accentColor, fontStyle: preset.fontStyle });
      }
      await refreshMarketplaceBrandPresets();
      toast.success("已設為帳戶預設", { description: "未指定品牌的商品套組會自動帶入這個設定。" });
    } catch (error) {
      toast.error("未能更新帳戶預設", { description: getProcessingErrorMessage(error) });
      throw error;
    }
  };

  const removeMarketplaceBrandPreset = async (presetId: number) => {
    const preset = marketplaceBrandPresets.find((item) => item.id === presetId);
    if (!preset || !window.confirm(`刪除「${preset.name}」品牌預設？已指定此品牌的專案會改回帳戶預設。`)) return;
    try {
      await removeMarketplaceBrandPresetMutation.mutateAsync({ presetId });
      if (marketplaceBrandPresetId === presetId) setMarketplaceBrandPresetId(null);
      await refreshMarketplaceBrandPresets();
      toast.success("已刪除品牌預設");
    } catch (error) {
      toast.error("未能刪除品牌預設", { description: getProcessingErrorMessage(error) });
      throw error;
    }
  };

  const assignProjectBrandPreset = async (projectId: number, presetId: number | null) => {
    try {
      await assignProjectBrandPresetMutation.mutateAsync({ projectId, presetId });
      await libraryUtils.projects.list.invalidate();
      toast.success(presetId ? "已指定專案品牌" : "專案會使用帳戶預設");
    } catch (error) {
      toast.error("未能指定專案品牌", { description: getProcessingErrorMessage(error) });
      throw error;
    }
  };

  const saveMarketplaceWorkflow = async (name: string) => {
    if (!isAuthenticated) {
      startLogin();
      return false;
    }
    try {
      const workflow = await createMarketplaceWorkflowMutation.mutateAsync({
        name: name.trim(),
        channel: marketplaceChannel,
        selectedRoles: marketplaceSelectedRoles,
        lifestyleStyle: marketplaceLifestyleStyle,
        projectId: selectedProjectId,
        brandPresetId: marketplaceUsesCustomBrandStyle ? null : marketplaceBrandPresetId,
        useCustomBrandStyle: marketplaceUsesCustomBrandStyle,
        brandStyle: marketplaceBrandStyle,
      });
      await libraryUtils.marketplace.workflows.list.invalidate();
      toast.success("已儲存工作流程", { description: `「${workflow.name}」下次可直接套用設定。` });
      return true;
    } catch (error) {
      toast.error("未能儲存工作流程", { description: getProcessingErrorMessage(error) });
      return false;
    }
  };

  const applyMarketplaceWorkflow = (workflow: MarketplaceWorkflow) => {
    setMarketplaceChannel(workflow.channel);
    setMarketplaceSelectedRoles(workflow.selectedRoles);
    setMarketplaceLifestyleStyle(workflow.lifestyleStyle);
    setMarketplaceLifestyleScene(null);
    setMarketplaceLifestyleAvoidStyles([]);
    setMarketplaceLifestyleStyleIsMerchantSelected(true);
    const projectExists = workflow.projectId && projects.some((project) => project.id === workflow.projectId);
    setSelectedProjectId(projectExists ? workflow.projectId : null);
    const matchedPreset = workflow.brandPresetId ? marketplaceBrandPresets.find((preset) => preset.id === workflow.brandPresetId) : undefined;
    if (!workflow.useCustomBrandStyle && matchedPreset) {
      setMarketplaceBrandPresetId(matchedPreset.id);
      setMarketplaceBrandStyle({ accentColor: matchedPreset.accentColor, fontStyle: matchedPreset.fontStyle });
      setMarketplaceUsesCustomBrandStyle(false);
      appliedMarketplaceBrandDefault.current = `${matchedPreset.id}:${matchedPreset.accentColor}:${matchedPreset.fontStyle}`;
    } else {
      setMarketplaceBrandPresetId(null);
      setMarketplaceBrandStyle(workflow.brandStyle);
      setMarketplaceUsesCustomBrandStyle(true);
      appliedMarketplaceBrandDefault.current = null;
    }
    setMarketplaceResult(null);
    toast.success("已套用工作流程", { description: projectExists ? "平台、圖片計劃、情境、品牌及專案設定已帶入。" : "平台、圖片計劃、情境及品牌設定已帶入；原專案已不存在，請另行選擇。" });
  };

  const removeMarketplaceWorkflow = async (workflow: MarketplaceWorkflow) => {
    if (!window.confirm(`刪除「${workflow.name}」工作流程？這不會影響品牌、專案、SKU 或已生成圖片。`)) return;
    try {
      await removeMarketplaceWorkflowMutation.mutateAsync({ workflowId: workflow.id });
      await libraryUtils.marketplace.workflows.list.invalidate();
      toast.success("已刪除工作流程");
    } catch (error) {
      toast.error("未能刪除工作流程", { description: getProcessingErrorMessage(error) });
    }
  };

  const generateMarketplaceSuite = async (roles = marketplaceSelectedRoles, retryRole?: MarketplaceImageRole, redesignInstruction?: string) => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!marketplaceReferences.length || !roles.length || marketplaceSuiteRunning) return;
    const retrySourceImageId = retryRole ? marketplaceResult?.outputs.find((output) => typeof output.savedImageId === "number")?.savedImageId : undefined;
    if (retryRole && !retrySourceImageId) {
      toast.error("暫時未能只重試這張圖片", { description: "請重新建立整個套組，系統會重新讀取產品參考相片。" });
      return;
    }
    const startedAt = Date.now();
    setMarketplaceSuiteRunning(true);
    setMarketplaceGenerationStartedAt(startedAt);
    setMarketplaceGenerationRoles(roles);
    setMarketplaceGenerationCompletedCount(0);
    setMarketplaceRetryingRole(retryRole ?? null);
    setProgressClock(startedAt);
    if (!retryRole) setMarketplaceResult(null);
    try {
      const baseRequest = {
        imageData: marketplaceReferences[0].originalData,
        fileName: marketplaceReferences[0].fileName,
        mimeType: marketplaceReferences[0].mimeType,
        referenceImages: marketplaceReferences.map((reference) => ({
          imageData: reference.originalData,
          fileName: reference.fileName,
          mimeType: reference.mimeType,
        })),
        channel: marketplaceChannel,
        selectedRoles: roles,
        ...(roles.includes("detail") ? { detailSpecificationLayout: marketplaceDetailSpecificationLayout } : {}),
        ...(roles.includes("lifestyle") ? {
          lifestyleStyle: marketplaceLifestyleStyle,
          ...(marketplaceLifestyleScene ? { lifestyleScene: marketplaceLifestyleScene } : {}),
          ...(marketplaceLifestyleAvoidStyles.length ? { avoidLifestyleStyles: marketplaceLifestyleAvoidStyles } : {}),
        } : {}),
        brandStyle: marketplaceBrandStyle,
        brandPresetId: marketplaceUsesCustomBrandStyle ? undefined : marketplaceBrandPresetId ?? undefined,
        useCustomBrandStyle: marketplaceUsesCustomBrandStyle,
        productBrief: {
          productName: marketplaceProductBrief.productName.trim(),
          summary: marketplaceProductBrief.summary.trim(),
          weight: marketplaceProductBrief.weight.trim(),
          dimensions: marketplaceProductBrief.dimensions.trim(),
          confirmedFacts: marketplaceProductBrief.confirmedFacts,
          visualHighlights: marketplaceProductBrief.visualHighlights,
          usageIdeas: marketplaceProductBrief.usageIdeas,
        },
        projectId: selectedProjectId || undefined,
        ...(redesignInstruction?.trim() ? { redesignInstruction: redesignInstruction.trim() } : {}),
      };
      let combinedResult: MarketplaceSuiteResult | null = retryRole ? marketplaceResult : { channel: marketplaceChannel, outputs: [], failures: [] };
      let activeRetrySourceImageId = retrySourceImageId;
      let completedThisRun = 0;
      let failedThisRun = 0;
      const roleRequestPlan = getMarketplaceRoleRequestPlan(roles);

      for (let index = 0; index < roleRequestPlan.length; index += 1) {
        const selectedRoles = roleRequestPlan[index];
        const role = selectedRoles[0];
        const roleStartedAt = Date.now();
        setMarketplaceGenerationStartedAt(roleStartedAt);
        setProgressClock(roleStartedAt);
        try {
          const result = await marketplaceSuiteMutation.mutateAsync({
            ...baseRequest,
            selectedRoles,
            ...(activeRetrySourceImageId ? { retrySourceImageId: activeRetrySourceImageId } : {}),
          });
          const roleResult = result as MarketplaceSuiteResult;
          combinedResult = mergeMarketplaceSuiteResult(combinedResult, roleResult);
          completedThisRun += roleResult.outputs.length;
          failedThisRun += roleResult.failures.length;
          activeRetrySourceImageId = activeRetrySourceImageId
            ?? roleResult.outputs.find((output) => typeof output.savedImageId === "number")?.savedImageId;
        } catch (error) {
          const roleTitle = getMarketplaceSuite(marketplaceChannel).find((item) => item.role === role)?.title ?? "商品圖片";
          combinedResult = mergeMarketplaceSuiteResult(combinedResult, {
            channel: marketplaceChannel,
            outputs: [],
            failures: [{ role, title: roleTitle, message: getProcessingErrorMessage(error) }],
          });
          failedThisRun += 1;
        }
        setMarketplaceResult(combinedResult);
        setMarketplaceGenerationCompletedCount(index + 1);
      }
      await Promise.all([
        libraryUtils.library.list.invalidate(),
        libraryUtils.library.usage.invalidate(),
        libraryUtils.library.usageTimeline.invalidate(),
        libraryUtils.library.projectStorage.invalidate(),
      ]);
      if (completedThisRun > 0) {
        toast.success(retryRole ? "已更新商品圖片" : `商品套組已完成 ${completedThisRun} 張`, { description: failedThisRun ? `${failedThisRun} 張暫時未完成，可於結果區只重試該張。` : "請先逐張核對實物，再下載上架。" });
      } else {
        toast.error(retryRole ? "未能重試這張商品圖片" : "未能建立商品圖片套組", { description: combinedResult?.failures[0]?.message ?? "AI 暫時未能完成圖片；未完成圖片不會扣除額度。" });
      }
    } catch (error) {
      toast.error(retryRole ? "未能重試這張商品圖片" : "未能建立商品圖片套組", { description: getProcessingErrorMessage(error) });
    } finally {
      setMarketplaceSuiteRunning(false);
      setMarketplaceGenerationStartedAt(null);
      setMarketplaceGenerationRoles([]);
      setMarketplaceGenerationCompletedCount(0);
      setMarketplaceRetryingRole(null);
    }
  };

  const retryMarketplaceRole = async (role: MarketplaceImageRole) => {
    await generateMarketplaceSuite([role], role);
  };

  const redesignMarketplaceRole = async (role: MarketplaceImageRole, instruction: string) => {
    await generateMarketplaceSuite([role], role, instruction);
  };

  const downloadMarketplaceImage = async (url: string, role: "main" | "studio" | "detail" | "lifestyle") => {
    const sourceName = marketplaceReferences[0]?.fileName || "product";
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Unable to retrieve generated marketplace image");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getMarketplaceResultFileName(sourceName, role);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 800);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.message("已在新分頁開啟圖片，請長按或另存下載。");
    }
  };

  const shareMarketplaceImage = async (url: string, role: MarketplaceImageRole) => {
    if (marketplaceSharingRole) return;
    const sourceName = marketplaceReferences[0]?.fileName || "product";
    const shareFileName = `${sourceName.replace(/\.[^.]+$/, "")}-${role}.png`;
    setMarketplaceSharingRole(role);
    try {
      const imageFile = await imageUrlToShareFile(url, shareFileName);
      if (canUseNativeFileShare(imageFile)) {
        await navigator.share({
          files: [imageFile],
          title: "Iwantphoto 商品圖片",
          text: "商品圖片成品",
        });
        return;
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(imageFile);
      link.download = imageFile.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 800);
      toast.message("此瀏覽器未支援直接分享圖片，已開始下載；請在 WhatsApp 選擇這張相片傳送。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("未能準備 WhatsApp 圖片", { description: "請先下載相片，再在 WhatsApp 內傳送。" });
    } finally {
      setMarketplaceSharingRole(null);
    }
  };

  const shareMarketplaceSuite = async () => {
    const outputs = marketplaceResult?.outputs ?? [];
    if (outputs.length < 2 || marketplaceSharingRole) return;
    const sourceName = marketplaceReferences[0]?.fileName || "product";
    const sourceBaseName = sourceName.replace(/\.[^.]+$/, "");
    setMarketplaceSharingRole("all");
    try {
      const files = await Promise.all(outputs.map((output) => imageUrlToShareFile(output.url, `${sourceBaseName}-${output.role}.png`)));
      if (canUseNativeFileShare(files)) {
        await navigator.share({
          files,
          title: "Iwantphoto 商品圖片套組",
          text: `${files.length} 張商品圖片成品`,
        });
        return;
      }

      for (const output of outputs) {
        await downloadMarketplaceImage(output.url, output.role);
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
      toast.message("此瀏覽器未支援一次分享多張圖片，已開始下載；請在 WhatsApp 選擇這些相片傳送。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("未能準備 WhatsApp 圖片套組", { description: "請確認所有成品仍可下載，然後再試。" });
    } finally {
      setMarketplaceSharingRole(null);
    }
  };

  const downloadMarketplaceSuite = async () => {
    if (!marketplaceResult?.outputs.length) return;
    for (const output of marketplaceResult.outputs) {
      await downloadMarketplaceImage(output.url, output.role);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    toast.success(`已開始下載 ${marketplaceResult.outputs.length} 張商品圖片`, { description: "如瀏覽器詢問，請允許多個檔案下載。" });
  };

  const hasImage = Boolean(activeImage);
  const showingUrl = selectImagePreviewUrl(activeImage?.previewUrl, activeImage?.resultUrl, previewMode);
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f8fc] text-[#10213b]">
      <header className={`sticky z-20 border-b border-[#dfe5ef] bg-[#f6f8fc]/92 backdrop-blur-xl ${adminTestModeActive ? "top-12 sm:top-14" : "top-0"}`}>
        <div className="container flex h-[76px] items-center justify-between">
          <a href="#top" className="group flex items-center" aria-label="Iwantphoto 首頁">
            <img src="/manus-storage/iwantphoto-wordmark-alpha_75676375.png" alt="Iwantphoto — One-Click Background Removal & Editing" className="h-10 w-auto max-w-[205px] object-contain object-left transition-transform duration-200 group-hover:scale-[1.025] sm:h-11 sm:max-w-[250px]" />
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#59677c] md:flex">
            <a className="transition-colors hover:text-[#1665d8]" href="#solutions">解決方案</a>
            <a className="transition-colors hover:text-[#1665d8]" href="#workflow">工作流程</a>
            <a className="transition-colors hover:text-[#1665d8]" href="#privacy">資料保障</a>
          </nav>
          <div className="flex items-center gap-2">
            {!authLoading && (isAuthenticated ? <>
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label={`開啟 ${mobileAccountIdentity.displayName} 的帳戶選單`} className="relative h-10 w-10 rounded-xl border-[#bfd3ee] bg-white text-[#1665d8] hover:bg-[#eaf2ff]">
                      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ddebff] text-[11px] font-extrabold tracking-[-0.04em] text-[#125db9]">{mobileAccountIdentity.initials}</span>}
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-[#20b485]" aria-hidden="true" />
                      <span className="sr-only">開啟帳戶選單</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 rounded-xl border-[#cbddef] bg-white p-1.5 text-[#314963] shadow-xl">
                    <DropdownMenuLabel className="flex items-center gap-2 px-2 py-2">
                      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ddebff] text-xs font-extrabold tracking-[-0.04em] text-[#125db9]">{mobileAccountIdentity.initials}</span>}
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-[#10213b]">{mobileAccountIdentity.displayName}</span>
                        <span className="mt-0.5 block truncate text-[10px] font-medium text-[#6c7d94]">{user?.email || "安全帳戶登入"}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-[#6c7d94]">{mobileAccountMenuItems[1].detail} · 上次登入 {formatAccountLastSignedIn(user?.lastSignedIn)}</span>
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#e3eaf3]" />
                    <DropdownMenuItem onSelect={() => setLibraryOpen(true)} className="cursor-pointer rounded-lg px-2 py-2 text-xs font-bold text-[#1665d8] focus:bg-[#edf5ff] focus:text-[#1665d8]"><Images size={15} />{mobileAccountMenuItems[0].label}<span className="ml-auto text-[10px] font-medium text-[#72839a]">{mobileAccountMenuItems[0].detail}</span></DropdownMenuItem>
                    <DropdownMenuItem onSelect={openPlans} className="cursor-pointer rounded-lg px-2 py-2 text-xs font-bold text-[#405c7d] focus:bg-[#f3f7fc] focus:text-[#405c7d]"><CreditCard size={15} />{mobileAccountMenuItems[1].label}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setAccountProfileOpen(true)} className="cursor-pointer rounded-lg px-2 py-2 text-xs font-bold text-[#405c7d] focus:bg-[#f3f7fc] focus:text-[#405c7d]"><UserRound size={15} />{mobileAccountMenuItems[2].label}</DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#e3eaf3]" />
                    <DropdownMenuItem onSelect={() => void logout()} variant="destructive" className="cursor-pointer rounded-lg px-2 py-2 text-xs font-bold"><LogOut size={15} />{mobileAccountMenuItems[3].label}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button variant="outline" onClick={() => setLibraryOpen(true)} className="hidden h-10 rounded-xl border-[#bfd3ee] bg-white px-3 text-xs font-bold text-[#1665d8] hover:bg-[#eaf2ff] sm:inline-flex"><Images size={15} />我的相片</Button>
              <Button variant="outline" onClick={openPlans} className="hidden h-10 rounded-xl border-[#d9e3ef] bg-white px-3 text-xs font-bold text-[#405c7d] hover:bg-[#f3f7fc] lg:inline-flex"><CreditCard size={15} />{ACCOUNT_PLANS[accountPlan].name} · {totalRemaining}</Button>
              <Button variant="outline" size="icon" onClick={() => setAccountProfileOpen(true)} aria-label="管理帳戶資料" className="hidden h-10 w-10 rounded-xl border-[#bfd3ee] bg-white text-[#1665d8] hover:bg-[#eaf2ff] sm:inline-flex">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ddebff] text-[11px] font-extrabold tracking-[-0.04em] text-[#125db9]">{mobileAccountIdentity.initials}</span>}</Button>
              <Button variant="ghost" onClick={() => void logout()} className="hidden h-10 rounded-xl px-3 text-xs font-bold text-[#64758c] hover:bg-white sm:inline">登出</Button>
            </> : <Button variant="outline" onClick={startLogin} className="h-10 rounded-xl border-[#bfd3ee] bg-white px-3 text-xs font-bold text-[#1665d8] hover:bg-[#eaf2ff]"><UserRound size={15} /><span className="hidden sm:inline">登入安全儲存</span></Button>)}
            <Button className="h-10 rounded-xl bg-[#1665d8] px-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d56bd] sm:px-4" onClick={() => document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" })}><Sparkles size={16} /><span className="hidden sm:inline">開始工作</span></Button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-[#dfe5ef] bg-[radial-gradient(circle_at_83%_16%,#dbeaff_0,transparent_29%),radial-gradient(circle_at_16%_80%,#dff7f1_0,transparent_25%)] py-9 sm:py-12">
          <div className="container grid items-center gap-7 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c9d8ef] bg-white/80 px-3 py-1.5 text-xs font-bold text-[#2362ad] shadow-sm"><span className="h-2 w-2 rounded-full bg-[#20b485]" />一張相，成就更多生意。</div>
              <h1 className="mt-4 max-w-xl text-[clamp(2.35rem,4.5vw,4.1rem)] font-semibold leading-[1.03] tracking-[-0.065em] text-[#10213b]">將每張商業相片，<span className="text-[#1665d8]">變成即時可用的品牌素材。</span></h1>
              <p className="mt-4 max-w-lg text-[15px] leading-6 text-[#59677c]">去背、清除雜物、直接交付：為中小企整理產品、門市、活動與物業相片。</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button className="h-12 rounded-xl bg-[#1665d8] px-5 text-[15px] font-bold text-white shadow-[0_12px_26px_rgba(22,101,216,0.24)] hover:bg-[#0d56bd]" onClick={() => document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" })}><ImagePlus size={18} />上載並開始處理 <ArrowRight size={17} /></Button>
                <Button variant="outline" className="h-12 rounded-xl border-[#bdd4ef] bg-white px-5 text-sm font-bold text-[#1766c8] hover:bg-[#edf5ff]" onClick={() => setMarketplaceOpen(true)}><Sparkles size={17} />建立電商商品套組</Button>
                <a className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#cfd8e6] bg-white px-5 text-sm font-bold text-[#33445c] transition hover:border-[#95afe0]" href="#workflow">查看工作流程 <ChevronRight size={16} /></a>
              </div>
              <div className="mt-5 grid max-w-lg grid-cols-3 gap-3 text-xs">
                {[['10 張', '每批處理上限'], ['透明／白底', '一鍵輸出選項'], ['手機即用', '直接分享給客戶']].map(([value, label]) => <div key={label} className="rounded-xl border border-[#dce5f0] bg-white/70 p-3"><strong className="block text-base text-[#10213b]">{value}</strong><span className="mt-1 block leading-4 text-[#6b7890]">{label}</span></div>)}
              </div>
            </div>

            <div className="hero-workspace mx-auto w-full max-w-[620px] rounded-[24px] border border-[#cad9ee] bg-white p-3 shadow-[0_28px_70px_rgba(43,75,124,0.16)] sm:p-4">
              <div className="flex items-center justify-between rounded-xl border border-[#e6edf7] bg-[#f9fbff] px-3 py-2.5"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e7f0ff] text-[#1665d8]"><LayoutGrid size={15} /></span><div><strong className="block text-xs">品牌素材工作區</strong><span className="block text-[10px] text-[#718099]">本週素材處理總覽</span></div></div><span className="rounded-full bg-[#e5f8f0] px-2 py-1 text-[10px] font-bold text-[#168464]">工作中</span></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1.1fr_.9fr]">
                <div className="relative min-h-[240px] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#153b75_0%,#1e65c5_55%,#9fdcff_100%)] p-5">
                  <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-[#c9edff]/40 blur-2xl" /><div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-[#7de2c1]/35 blur-2xl" />
                  <span className="relative rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-bold text-white">原始相片</span>
                  <div className="relative mx-auto mt-7 w-[74%] rounded-[18px] bg-white p-3 shadow-[0_18px_30px_rgba(4,24,61,.25)]"><div className="h-36 rounded-xl bg-[linear-gradient(135deg,#f3f7fb_0%,#ffffff_46%,#d7e8ff_100%)] p-4"><div className="mx-auto h-24 w-20 rounded-[14px] border border-[#c4d7ed] bg-[#eef6ff] p-2 shadow-sm"><div className="h-8 rounded-md bg-[#1665d8]" /><div className="mt-2 h-1.5 w-10 rounded-full bg-[#a9bedb]" /><div className="mt-1 h-1.5 w-7 rounded-full bg-[#d2dfef]" /></div></div><div className="mt-3 flex items-center justify-between"><span className="text-[10px] font-bold text-[#273a55]">產品主圖.jpg</span><span className="text-[10px] text-[#6d7d93]">2.4 MB</span></div></div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-xl border border-white/20 bg-[#0d2b5c]/70 p-2.5 text-white backdrop-blur"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2ac091]"><WandSparkles size={15} /></span><span className="text-xs font-bold">AI 正在建立乾淨白底</span><span className="ml-auto text-[10px] font-bold text-[#b6f4dc]">完成</span></div>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-[#dce6f3] bg-[#fbfdff] p-4"><p className="text-[11px] font-bold tracking-[.08em] text-[#6a7b94]">今日處理</p><strong className="mt-2 block text-3xl tracking-[-.06em] text-[#10213b]">24</strong><span className="mt-1 block text-xs text-[#168464]">↑ 8 張已交付</span><div className="mt-4 flex h-1.5 gap-1"><span className="w-[58%] rounded-full bg-[#1665d8]" /><span className="w-[25%] rounded-full bg-[#34c19a]" /><span className="flex-1 rounded-full bg-[#dce6f3]" /></div></div>
                  <div className="rounded-2xl bg-[#10213b] p-4 text-white"><p className="text-[11px] font-bold tracking-[.08em] text-white/60">常用工作</p><div className="mt-3 space-y-2">{['產品圖去背','移除雜物與字樣','批量交付 WhatsApp'].map((item, index) => <div key={item} className="flex items-center gap-2 text-xs"><span className="grid h-5 w-5 place-items-center rounded-md bg-white/10 text-[#86d6ff]">{index + 1}</span>{item}</div>)}</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="editor" className="scroll-mt-20 bg-[#eef3f8] py-8 sm:py-10">
          <div className="container">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><span className="text-[11px] font-bold tracking-[.15em] text-[#1665d8]">AI IMAGE WORKSPACE</span><h2 className="mt-1 text-2xl font-semibold tracking-[-.045em] text-[#10213b] sm:text-3xl">開始處理商業相片。</h2></div><div className="max-w-sm"><p className="text-sm leading-6 text-[#627188]">完成後可下載或直接分享圖片檔。</p>{isAuthenticated ? <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1"><button type="button" onClick={() => setLibraryOpen(true)} className="flex items-center gap-1.5 text-xs font-bold text-[#168464] hover:text-[#0d7052]"><ShieldCheck size={14} />已登入 · 自動儲存</button><button type="button" onClick={openPlans} className="flex items-center gap-1.5 text-xs font-bold text-[#1665d8] hover:text-[#0d56bd]"><CreditCard size={14} />尚餘 {totalRemaining} 張</button></div> : !authLoading && <button type="button" onClick={startLogin} className="mt-1 flex max-w-sm items-center gap-1.5 text-left text-xs font-bold text-[#1665d8] hover:text-[#0d56bd]"><ShieldCheck size={14} />登入後可自動儲存相片。</button>}</div></div>

            <div className="editor-shell overflow-hidden rounded-[24px] border border-[#d7e1ed] bg-white shadow-[0_18px_50px_rgba(42,65,93,.11)]">
              <div className="flex items-center gap-2 border-b border-[#e4ebf3] bg-[#f9fbfe] px-4 py-3 sm:px-5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e7f0ff] text-[#1665d8]"><LayoutGrid size={15} /></span><span className="text-xs font-bold text-[#36475e]">圖片工作區</span><span className="hidden text-xs text-[#74839a] sm:inline">· 處理與交付集中管理</span><div className="ml-auto flex items-center gap-2">{hasImage && <span className="hidden items-center gap-1.5 text-xs font-bold text-[#168464] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#22b789]" />已載入 {images.length} 張</span>}<button type="button" onClick={() => setMarketplaceOpen(true)} className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#c9dfd3] bg-white px-2.5 text-xs font-bold text-[#197250] shadow-sm transition hover:bg-[#f1fbf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#197250] focus-visible:ring-offset-1 sm:inline-flex"><Sparkles size={14} />商品套組</button><button type="button" onClick={() => setDesktopSettingsPanel((state) => toggleDesktopSettingsPanel(state))} className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#c8d9ed] bg-white px-2.5 text-xs font-bold text-[#1665d8] shadow-sm transition hover:bg-[#eaf2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1665d8] focus-visible:ring-offset-1 lg:inline-flex" aria-label={desktopSettingsCopy.description} title={desktopSettingsCopy.description}>{desktopSettingsPanel === "expanded" ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />} {desktopSettingsCopy.label}</button></div></div>
              {isAuthenticated && usageAlert.level !== "none" && <div className={`border-b px-4 py-2.5 text-xs sm:px-5 ${usageAlert.level === "limit" ? "border-[#ecc9bb] bg-[#fff7f3] text-[#914630]" : "border-[#f2d6a7] bg-[#fffaf0] text-[#8a5a14]"}`}><strong>{usageAlert.title}</strong><span className="ml-1">{usageAlert.description}</span>{usageAlert.shouldSuggestUpgrade && <button type="button" onClick={openPlans} className="ml-2 font-bold underline underline-offset-2">查看方案</button>}</div>}

              <div className={`grid ${desktopSettingsPanel === "collapsed" ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_340px]"}`}>
                <div className={`min-h-[450px] bg-[linear-gradient(45deg,#f1f5fa_25%,transparent_25%),linear-gradient(-45deg,#f1f5fa_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5fa_75%),linear-gradient(-45deg,transparent_75%,#f1f5fa_75%)] bg-[size:22px_22px] bg-[position:0_0,0_11px,11px_-11px,-11px_0px] p-4 sm:p-7 ${desktopSettingsPanel === "collapsed" ? "lg:min-h-[640px] lg:p-8" : ""}`}>
                  {!hasImage ? (
                    <button type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void handleFiles(event.dataTransfer.files); }} className={`flex min-h-[380px] w-full flex-col items-center justify-center rounded-[20px] border-2 border-dashed px-6 text-center transition ${isDragging ? "border-[#1665d8] bg-[#edf5ff]" : "border-[#b8c8db] bg-white/70 hover:border-[#6d9fea] hover:bg-white"}`}><span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#e7f0ff] text-[#1665d8]"><Upload size={28} /></span><strong className="mt-5 text-lg text-[#10213b]">拖放商業相片到這裡</strong><span className="mt-2 text-sm text-[#708096]">或由手機／電腦一次選擇多張檔案</span><span className="mt-5 rounded-full border border-[#d9e3ef] bg-[#f9fbff] px-3 py-1.5 text-xs font-semibold text-[#64758c]">JPG、PNG、WEBP、HEIC · 最多 10 張 · 每張 12MB</span></button>
                  ) : (
                    <div className="space-y-3">
                      <div className={`relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-[20px] bg-[#dfe8f2] p-3 sm:p-5 ${desktopSettingsPanel === "collapsed" ? "lg:min-h-[560px]" : ""}`}>
                        <div className="absolute left-4 top-4 z-[2] flex max-w-[calc(100%-7rem)] overflow-x-auto rounded-full border border-[#dfe6ee] bg-white/95 p-1 text-xs font-bold shadow-sm" role="group" aria-label="相片版本及比較模式">
                          <button type="button" onClick={() => { setWorkspaceViewMode("single"); setPreviewMode("original"); }} className={`shrink-0 rounded-full px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1665d8] focus-visible:ring-offset-1 ${workspaceViewMode === "single" && previewMode === "original" ? "bg-[#1665d8] text-white shadow-sm" : "text-[#67758a] hover:bg-[#edf3f9]"}`} aria-pressed={workspaceViewMode === "single" && previewMode === "original"}>原始</button>
                          <button type="button" onClick={() => activeImage?.resultUrl && (() => { setWorkspaceViewMode("single"); setPreviewMode("processed"); })()} disabled={!activeImage?.resultUrl} className={`shrink-0 rounded-full px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168464] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55 ${workspaceViewMode === "single" && previewMode === "processed" ? "bg-[#168464] text-white shadow-sm" : "text-[#67758a] hover:bg-[#edf7f3]"}`} aria-pressed={workspaceViewMode === "single" && previewMode === "processed"}>{activeImage?.resultUrl ? "已處理" : "處理後"}</button>
                          <button type="button" onClick={() => activeImage?.resultUrl && setWorkspaceViewMode("compare")} disabled={!activeImage?.resultUrl} className={`shrink-0 rounded-full px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6454af] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55 ${workspaceViewMode === "compare" ? "bg-[#6454af] text-white shadow-sm" : "text-[#67758a] hover:bg-[#f1effa]"}`} aria-pressed={workspaceViewMode === "compare"}>滑動比較</button>
                        </div>
                        {activeImage && shouldShowImageComparison(workspaceViewMode, activeImage.resultUrl) ? <ProcessedImageComparison originalSrc={activeImage.previewUrl} processedSrc={activeImage.resultUrl!} fileName={activeImage.fileName} maxHeight={desktopSettingsPanel === "collapsed" ? 560 : undefined} onReturnToOriginal={returnToOriginal} afterAlignment={activeImage.comparisonAlignment} onAdjustAlignment={adjustActiveComparisonAlignment} onAdjustScale={scaleActiveComparisonAlignment} onSetAlignment={setActiveComparisonAlignment} onResetAlignment={resetActiveComparisonAlignment} onSaveAsDefault={saveActiveComparisonAlignmentAsDefault} onClearSavedDefault={clearSavedComparisonAlignment} hasSavedDefault={Boolean(savedComparisonAlignment)} /> : showingUrl && activeImage && (!activeImage.resultUrl || previewMode === "original") ? <BrushMaskCanvas imageSrc={showingUrl} alt="商業相片原始預覽" enabled={brushEnabled} brushSize={brushSize} resetKey={brushResetKey} onMaskChange={setMaskData} /> : showingUrl && <img src={showingUrl} alt="商業相片已處理預覽" className={`max-w-full rounded-[12px] object-contain shadow-[0_16px_38px_rgba(27,48,77,.22)] ${desktopSettingsPanel === "collapsed" ? "max-h-[430px] lg:max-h-[560px]" : "max-h-[430px]"}`} />}
                        {activeImage && <div className="absolute right-4 top-4 z-[2] flex gap-2"><button type="button" onClick={() => setDetailPreviewOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#315375] shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1665d8] focus-visible:ring-offset-1" aria-label="放大檢查相片細節" title="放大檢查"><Maximize2 size={17} /></button><button type="button" onClick={() => removeImage(activeImage.id)} className="grid h-9 w-9 place-items-center rounded-full bg-[#10213b]/80 text-white transition hover:bg-[#10213b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1665d8] focus-visible:ring-offset-1" aria-label="移除目前相片"><X size={18} /></button></div>}

                        {activeImage?.status === "processing" && <div className="absolute inset-0 grid place-items-center rounded-[20px] bg-[#0c203c]/68 backdrop-blur-[2px]"><div className="flex w-[min(82%,280px)] flex-col items-center text-center text-white"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/14"><Loader2 className="animate-spin" size={26} /></span><strong className="mt-4 text-lg">{activeMode === "background" ? "正在處理背景" : "正在修補畫面"}</strong>{isBatchProcessing && batchProgress && batchProgressSummary ? <><span className="mt-1 text-sm text-white/85">已處理 {batchProgress.completed}/{batchProgress.total} 張 · 預計進度 {batchProgressSummary.percentage}%</span><div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#58d8b0] transition-[width] duration-700 ease-out" style={{ width: `${batchProgressSummary.percentage}%` }} /></div><span className="mt-2 text-xs text-white/75">預計尚餘 {formatEstimatedSeconds(batchProgressSummary.remainingSeconds)}</span></> : singleProgressSummary ? <><span className="mt-1 text-sm text-white/85">預計進度 {singleProgressSummary.percentage}%</span><div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#58d8b0] transition-[width] duration-700 ease-out" style={{ width: `${singleProgressSummary.percentage}%` }} /></div><span className="mt-2 text-xs text-white/75">預計尚餘 {formatEstimatedSeconds(singleProgressSummary.remainingSeconds)} · AI 處理中</span></> : <span className="mt-1 text-sm text-white/80">正在準備處理…</span>}</div></div>}
                      </div>
                      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-[#627188]">相片佇列 · {images.length}/{MAX_BATCH_FILES} 張</p><Button onClick={() => inputRef.current?.click()} variant="ghost" className="h-8 rounded-lg px-2.5 text-xs font-bold text-[#1665d8] hover:bg-[#eaf2ff]"><ImagePlus size={14} />加入相片</Button></div>
                      <div className="flex gap-2 overflow-x-auto pb-1">{images.map((entry, index) => <button key={entry.id} onClick={() => setActiveImageId(entry.id)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${entry.id === activeImageId ? "border-[#1665d8] shadow-md" : "border-white hover:border-[#9ab9ec]"}`} aria-label={`選擇第 ${index + 1} 張相片`}><img src={entry.resultUrl || entry.previewUrl} alt="" className="h-full w-full object-cover" /><span className={`absolute bottom-0 left-0 right-0 grid h-5 place-items-center text-[9px] font-bold text-white ${entry.status === "done" ? "bg-[#168464]" : entry.status === "error" ? "bg-[#c45a3c]" : entry.status === "processing" ? "bg-[#1665d8]" : "bg-[#10213b]/70"}`}>{entry.status === "done" ? "完成" : entry.status === "error" ? "失敗" : entry.status === "processing" ? "處理中" : `${index + 1}`}</span></button>)}</div>
                      {batchProgress && batchProgressSummary && <div className="rounded-2xl border border-[#dce5ef] bg-[#fbfdff] p-3.5 shadow-sm"><div className="flex items-center justify-between gap-3 text-xs font-bold text-[#33445c]"><span>批量處理進度 · {batchProgress.completed}/{batchProgress.total} 張</span><span className="text-[#1665d8]">{batchProgressSummary.percentage}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e4ebf3]"><div className="h-full rounded-full bg-[#1665d8] transition-[width] duration-700 ease-out" style={{ width: `${batchProgressSummary.percentage}%` }} /></div><p className="mt-2 text-xs text-[#6a7a90]">{isBatchProcessing ? `預計尚餘 ${formatEstimatedSeconds(batchProgressSummary.remainingSeconds)}` : batchFailures.length ? "批量完成，但部分相片未能處理。" : "全部相片已完成處理。"}</p>{batchFailures.length > 0 && <div className="mt-3 border-t border-[#e8edf4] pt-3"><div className="flex items-center justify-between gap-3"><strong className="text-xs text-[#a04731]">失敗名單（{batchFailures.length}）</strong><Button onClick={() => void runBatchBackground(true)} disabled={isBatchProcessing || processImage.isPending} variant="outline" className="h-8 rounded-lg border-[#e0bfb3] bg-[#fff7f2] px-2.5 text-xs font-bold text-[#a04731] hover:bg-[#ffede3]"><RotateCcw size={13} />重新嘗試</Button></div><ul className="mt-2 space-y-1.5">{batchFailures.map((entry) => <li key={entry.id} className="truncate rounded-lg bg-[#fff4ee] px-2.5 py-1.5 text-xs text-[#7f513f]" title={entry.fileName}>{entry.fileName}</li>)}</ul></div>}</div>}
                    </div>
                  )}
                  <input ref={inputRef} className="hidden" multiple type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => { void handleFiles(event.target.files); event.target.value = ""; }} />
                </div>

                <aside className={`${desktopSettingsPanel === "collapsed" ? "lg:hidden" : ""} border-t border-[#e3eaf2] bg-[#fbfdff] p-5 lg:border-l lg:border-t-0 sm:p-6`}><div className="flex items-center justify-between"><h3 className="text-lg font-bold tracking-[-.03em] text-[#10213b]">處理設定</h3><CircleHelp size={17} className="text-[#8795a8]" /></div><p className="mt-1 text-xs leading-5 text-[#718096]">選擇處理方式，再按開始。</p>{isAuthenticated && <div className="mt-4 rounded-2xl border border-[#d7e6f5] bg-[#f4f9ff] p-3"><label className="block text-xs font-bold text-[#245a9d]">儲存到專案<select aria-label="選擇處理專案" value={selectedProjectId ? String(selectedProjectId) : ""} onChange={(event) => setSelectedProjectId(event.target.value ? Number(event.target.value) : null)} className="mt-2 h-9 w-full rounded-lg border border-[#c8dbf0] bg-white px-2 text-xs font-semibold text-[#40536d] outline-none focus:border-[#76a6e9] focus:ring-2 focus:ring-[#dceaff]"><option value="">未分類相片</option>{projects.map((project) => <option value={String(project.id)} key={project.id}>{getProjectOptionLabel(project)}</option>)}</select></label><button type="button" onClick={() => setLibraryOpen(true)} className="mt-2 text-[11px] font-bold text-[#1665d8] hover:text-[#0d56bd]">在我的相片新增或管理專案 →</button></div>}
                  <div className="mt-5 space-y-3"><div className="rounded-2xl border border-[#dbe4ef] bg-white p-3.5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e7f0ff] text-[#1665d8]"><WandSparkles size={18} /></span><div><strong className="block text-sm text-[#25364e]">智能去背</strong><span className="mt-0.5 block text-xs leading-5 text-[#6e7c90]">為產品、人物或主體建立乾淨背景。</span></div></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#eef3f8] p-1"><button onClick={() => setBackgroundStyle("transparent")} className={`rounded-lg py-1.5 text-xs font-bold transition ${backgroundStyle === "transparent" ? "bg-white text-[#1665d8] shadow-sm" : "text-[#6d7c91]"}`}>透明底</button><button onClick={() => setBackgroundStyle("white")} className={`rounded-lg py-1.5 text-xs font-bold transition ${backgroundStyle === "white" ? "bg-white text-[#1665d8] shadow-sm" : "text-[#6d7c91]"}`}>純白底</button></div><Button disabled={!hasImage || processImage.isPending || isBatchProcessing} onClick={() => void runProcess("background")} className="mt-3 h-10 w-full rounded-xl bg-[#1665d8] text-sm font-bold text-white hover:bg-[#0d56bd] disabled:bg-[#b7cbe9]">{activeMode === "background" && !isBatchProcessing ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}處理本張相片</Button>{images.length > 1 && <Button disabled={!readyImageCount || processImage.isPending || isBatchProcessing} onClick={() => void runBatchBackground()} variant="outline" className="mt-2 h-10 w-full rounded-xl border-[#bdd1ef] bg-[#f5f9ff] text-sm font-bold text-[#1665d8] hover:bg-[#eaf2ff] disabled:text-[#9fb0c7]">{isBatchProcessing ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}批量處理（{readyImageCount} 張）</Button>}</div>
                    <div className="rounded-2xl border border-[#dbe4ef] bg-white p-3.5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff1e9] text-[#be5d3d]"><Eraser size={18} /></span><div><strong className="block text-sm text-[#25364e]">精確清除與去背微調</strong><span className="mt-0.5 block text-xs leading-5 text-[#6e7c90]">移除雜物、字樣、路人，或手動微調去背範圍。</span></div></div><textarea value={cleanupNote} onChange={(event) => setCleanupNote(event.target.value)} className="mt-3 min-h-[76px] w-full resize-none rounded-xl border border-[#d8e2ed] bg-[#fbfdff] px-3 py-2 text-xs leading-5 text-[#33445c] outline-none transition placeholder:text-[#9aa7b7] focus:border-[#77a5e8] focus:ring-2 focus:ring-[#dceaff]" placeholder="例如：右下角的價格牌與雜物" /><div className="mt-3 rounded-xl border border-[#cfe0f5] bg-[#f6faff] p-3"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-xs font-bold text-[#245a9d]"><Brush size={14} />筆刷微調去背</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${maskData ? "bg-[#dcf6ea] text-[#168464]" : "bg-[#e8eef6] text-[#718096]"}`}>{maskData ? "已選取" : "未選取"}</span></div><p className="mt-1.5 text-xs leading-5 text-[#6a7a90]">在原圖上用紅色筆刷圈出要移除的背景、雜物或元素，AI 只會處理已選取範圍。</p><div className="mt-2 grid grid-cols-2 gap-2"><Button type="button" onClick={toggleBrushSelection} disabled={!hasImage || Boolean(activeImage?.resultUrl) || processImage.isPending || isBatchProcessing} variant="outline" className="h-8 rounded-lg border-[#bfd4f0] bg-white px-2 text-xs font-bold text-[#1665d8] hover:bg-[#eaf2ff]"><Brush size={13} />{brushEnabled ? "完成圈選" : "開啟筆刷"}</Button><Button type="button" onClick={clearBrushSelection} disabled={!maskData || processImage.isPending || isBatchProcessing} variant="ghost" className="h-8 rounded-lg px-2 text-xs font-bold text-[#65758a] hover:bg-white"><RotateCcw size={13} />清除選取</Button></div>{brushEnabled && <label className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#617087]">筆刷大小<input aria-label="筆刷大小" type="range" min="12" max="96" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="h-1 flex-1 accent-[#1665d8]" /><span className="w-6 text-right">{brushSize}</span></label>}</div><Button disabled={!hasImage || processImage.isPending || isBatchProcessing} onClick={() => void runProcess("cleanup")} variant="outline" className="mt-3 h-10 w-full rounded-xl border-[#ebc8b9] bg-white text-sm font-bold text-[#a04c31] hover:bg-[#fff5f0] disabled:text-[#c6b5a9]">{activeMode === "cleanup" ? <Loader2 className="animate-spin" size={16} /> : <Eraser size={16} />}{maskData ? "依筆刷範圍清除" : "開始清除"}</Button></div></div>
                  {activeImage?.status === "error" && <div className="mt-4 rounded-xl border border-[#ecc9bb] bg-[#fff7f3] p-3"><p className="text-xs font-semibold leading-5 text-[#914630]">本張相片未能處理：{activeImage.errorMessage || "請手動重新嘗試。"}</p><Button disabled={processImage.isPending || isBatchProcessing} onClick={() => void runProcess(activeImage.errorMode || "background")} className="mt-2 h-8 w-full rounded-lg bg-[#a04c31] text-xs font-bold text-white hover:bg-[#863b25]"><RotateCcw size={13} />重新嘗試本張</Button></div>}
                  {activeImage?.status === "done" && <div className="mt-4 rounded-2xl border border-[#cfdded] bg-[#f6faff] p-3.5"><div className="flex items-center gap-2 text-[#245a9d]"><SlidersHorizontal size={16} /><strong className="text-xs">重新處理本張</strong></div><p className="mt-1 text-xs leading-5 text-[#667991]">使用原始相片重新執行；完成後會更新目前成品。</p><Select value={reprocessOption} onValueChange={(value) => setReprocessOption(value as ReprocessOption)}><SelectTrigger aria-label="選擇重新處理方式" className="mt-3 h-9 w-full border-[#c9d9ed] bg-white text-xs font-semibold text-[#33445c]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="background-transparent">重新去背 · 透明底</SelectItem><SelectItem value="background-white">重新去背 · 純白底</SelectItem><SelectItem value="cleanup">重新依清除設定處理</SelectItem></SelectContent></Select><Button disabled={processImage.isPending || isBatchProcessing} onClick={runSelectedReprocess} className="mt-2 h-9 w-full rounded-xl bg-[#1665d8] text-xs font-bold text-white hover:bg-[#0d56bd]"><RotateCcw size={14} />{getReprocessOptionLabel(reprocessOption)}</Button></div>}
                  <div className="mt-4 flex gap-2"><Button disabled={!hasImage || processImage.isPending || isBatchProcessing} onClick={resetEditor} variant="ghost" className="h-9 flex-1 rounded-lg text-xs font-bold text-[#65758a] hover:bg-[#edf3f9]"><RotateCcw size={14} />還原本張</Button><Button disabled={images.length >= MAX_BATCH_FILES} onClick={() => inputRef.current?.click()} variant="ghost" className="h-9 flex-1 rounded-lg text-xs font-bold text-[#65758a] hover:bg-[#edf3f9]"><ImagePlus size={14} />加入相片</Button></div>
                  {hasImage && <div className="mt-5 rounded-2xl border border-[#d6eee6] bg-[#f2fbf7] p-3.5"><div className="flex items-center gap-2 text-[#168464]"><ShieldCheck size={17} /><strong className="text-xs">交付與分享</strong></div><p className="mt-1.5 text-xs leading-5 text-[#4c7a6d]">下載成品，或將圖片檔直接分享給客戶或團隊。</p><div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={downloadImage} disabled={processImage.isPending} className="h-10 rounded-xl bg-white text-xs font-bold text-[#168464] shadow-sm hover:bg-[#f8fffb]"><Download size={15} />下載</Button><Button onClick={shareWhatsApp} disabled={processImage.isPending} className="h-10 rounded-xl bg-[#25b96f] text-xs font-bold text-white shadow-sm hover:bg-[#1ba25e]"><MessageCircle size={15} />WhatsApp</Button></div>{completedImages.length > 1 && <Button onClick={() => void shareBatchWhatsApp()} disabled={isBatchSharing || processImage.isPending || isBatchProcessing} className="mt-2 h-10 w-full rounded-xl bg-[#168464] text-xs font-bold text-white shadow-sm hover:bg-[#0d7052]"><MessageCircle size={15} />{isBatchSharing ? "正在準備相片…" : `批量 WhatsApp（${completedImages.length} 張）`}</Button>}</div>}
                  {processingHistory.length > 0 && <div className="mt-5 rounded-2xl border border-[#dbe4ef] bg-white p-3.5"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[#40536d]"><Clock3 size={16} className="text-[#1665d8]" /><strong className="text-xs">本次處理紀錄</strong></span><span className="rounded-full bg-[#eef4fb] px-2 py-0.5 text-[10px] font-bold text-[#58708e]">{processingHistory.length} 項</span></div><ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">{processingHistory.map((record) => <li key={record.id} className={`rounded-xl border p-2.5 ${record.success ? "border-[#d8ebe4] bg-[#f7fcfa]" : "border-[#f0d3c8] bg-[#fff8f5]"}`}><div className="flex items-start gap-2"><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${record.success ? "bg-[#d9f3e7] text-[#168464]" : "bg-[#ffe3d9] text-[#ab5136]"}`}>{record.success ? <Check size={12} /> : <X size={12} />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate text-[11px] text-[#33445c]" title={record.fileName}>{record.fileName}</strong><span className="shrink-0 text-[10px] text-[#77869a]">{new Date(record.completedAt).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}</span></div><p className="mt-0.5 text-[10px] leading-4 text-[#6b7a8e]">{getProcessingMethodLabel(record.mode, record.backgroundStyle)} · {formatProcessingDuration(record.durationMs)}</p>{!record.success && <p className="mt-1 text-[10px] leading-4 text-[#a04c31]">{record.message || "處理未完成"}</p>}</div></div></li>)}</ul></div>}
                </aside>
              </div>
            </div>
          </div>
        </section>

        <CompactMarketingSections
          authenticated={isAuthenticated}
          storage={storage}
          hasActiveStorageAddOn={hasActiveStorageAddOn}
          checkoutPending={storageCheckoutMutation.isPending}
          pendingAddOn={storageCheckoutMutation.variables?.addOn}
          billingEnabled={billingEnabled}
          onStartWork={() => document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" })}
          onStartCase={startCaseWorkflow}
          onOpenPlans={openPlans}
          onSelectStorage={(addOn) => void startStorageCheckout(addOn)}
          onManageStorage={() => void openBillingPortal()}
        />

        <section id="privacy" className="bg-[#10213b] py-14 text-white"><div className="container grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#77c9ff]"><ShieldCheck size={23} /></span><div><h2 className="text-2xl font-semibold tracking-[-.035em]">商業素材，值得更可靠的處理流程。</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/65">檔案只供本次 AI 處理與分享使用。上載前請確認你擁有相片的使用權，並避免上載敏感個人資料。</p></div></div><Button className="h-11 rounded-xl bg-[#58d8b0] px-5 text-sm font-bold text-[#0d2d36] hover:bg-[#78e5c2]" onClick={() => document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" })}>開始處理 <ArrowRight size={16} /></Button></div></section>
      </main>

      <footer className="bg-[#0b1729] py-6 text-xs text-white/45"><div className="container flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span>© 2026 Iwantphoto</span><span>為中小企建立更俐落的圖片工作流程。</span></div></footer>
      <MarketplaceSuiteDialog
        open={marketplaceOpen}
        onOpenChange={setMarketplaceOpen}
        channel={marketplaceChannel}
        productBrief={marketplaceProductBrief}
        referenceImages={marketplaceReferences}
        selectedRoles={marketplaceSelectedRoles}
        detailSpecificationLayout={marketplaceDetailSpecificationLayout}
        lifestyleStyle={marketplaceLifestyleStyle}
        lifestyleRecommendation={marketplaceLifestyleRecommendation}
        selectedLifestyleScene={marketplaceLifestyleScene}
        lifestyleAvoidStyles={marketplaceLifestyleAvoidStyles}
        lifestyleStyleIsMerchantSelected={marketplaceLifestyleStyleIsMerchantSelected}
        brandStyle={marketplaceBrandStyle}
        isAuthenticated={isAuthenticated}
        brandPresets={marketplaceBrandPresets}
        activeBrandPresetId={marketplaceBrandPresetId}
        workflows={marketplaceWorkflows}
        isSavingWorkflow={createMarketplaceWorkflowMutation.isPending}
        projects={projects}
        selectedProjectId={selectedProjectId}
        sku={marketplaceSku}
        savedProducts={savedMarketplaceProducts}
        isSavingProduct={saveMarketplaceProductMutation.isPending}
        isCreatingProject={createProjectMutation.isPending}
        isDrafting={marketplaceBriefDraftMutation.isPending}
        draftProgress={marketplaceDraftProgress}
        draftElapsed={marketplaceDraftElapsed}
        draftFailure={marketplaceDraftFailure}
        draftRevisionInstruction={marketplaceDraftRevisionInstruction}
        draftHistory={marketplaceDraftHistory}
        listingCopy={marketplaceListingCopy}
        isListingCopyDrafting={marketplaceListingCopyMutation.isPending}
        isGenerating={marketplaceSuiteRunning}
        generationProgress={marketplaceGenerationProgress}
        retryingRole={marketplaceRetryingRole}
        result={marketplaceResult}
        onChannelChange={(channel) => { setMarketplaceChannel(channel); setMarketplaceListingCopy(null); setMarketplaceResult(null); }}
        onProductBriefChange={(brief) => { setMarketplaceProductBrief(brief); setMarketplaceListingCopy(null); setMarketplaceResult(null); }}
        onReferencesSelected={(files) => { void selectMarketplaceFiles(files); }}
        onRemoveReference={removeMarketplaceReference}
        onSelectedRolesChange={(roles) => { setMarketplaceSelectedRoles(roles); setMarketplaceResult(null); }}
        onDetailSpecificationLayoutChange={(layout) => { setMarketplaceDetailSpecificationLayout(layout); setMarketplaceResult(null); }}
        onLifestyleStyleChange={(style) => { setMarketplaceLifestyleStyle(style); setMarketplaceLifestyleScene(null); setMarketplaceLifestyleAvoidStyles((current) => current.filter((avoided) => avoided !== style)); setMarketplaceLifestyleStyleIsMerchantSelected(true); setMarketplaceResult(null); }}
        onApplyLifestyleRecommendation={() => {
          if (!marketplaceLifestyleRecommendation) return;
          setMarketplaceLifestyleStyle(marketplaceLifestyleRecommendation.style);
          setMarketplaceLifestyleScene(marketplaceLifestyleRecommendation.candidates[0] ?? null);
          setMarketplaceLifestyleAvoidStyles(marketplaceLifestyleRecommendation.avoidStyles);
          setMarketplaceLifestyleStyleIsMerchantSelected(false);
          setMarketplaceResult(null);
          toast.success("已採用 AI 情境建議", { description: "仍可隨時手動改選其他情境風格。" });
        }}
        onSelectLifestyleScene={(candidate) => {
          setMarketplaceLifestyleStyle(candidate.style);
          setMarketplaceLifestyleScene(candidate);
          setMarketplaceLifestyleAvoidStyles((current) => current.filter((avoided) => avoided !== candidate.style));
          setMarketplaceLifestyleStyleIsMerchantSelected(true);
          setMarketplaceResult(null);
          toast.success("已選擇場景方向", { description: `生成時會以「${candidate.title}」作為非售賣環境的美術方向。` });
        }}
        onToggleLifestyleAvoidStyle={(style) => {
          if (style === marketplaceLifestyleStyle) {
            toast.message("目前選擇的情境不能同時列為避免項目", { description: "請先改選其他情境風格或候選場景。" });
            return;
          }
          setMarketplaceLifestyleAvoidStyles((current) => current.includes(style) ? current.filter((entry) => entry !== style) : [...current, style]);
          setMarketplaceResult(null);
        }}
        onBrandStyleChange={(style) => { setMarketplaceBrandStyle(style); setMarketplaceBrandPresetId(null); setMarketplaceUsesCustomBrandStyle(true); setMarketplaceResult(null); }}
        onBrandPresetChange={(presetId) => {
          const preset = marketplaceBrandPresets.find((item) => item.id === presetId);
          setMarketplaceBrandPresetId(presetId);
          setMarketplaceUsesCustomBrandStyle(false);
          if (preset) setMarketplaceBrandStyle({ accentColor: preset.accentColor, fontStyle: preset.fontStyle });
          setMarketplaceResult(null);
        }}
        onSaveWorkflow={saveMarketplaceWorkflow}
        onApplyWorkflow={applyMarketplaceWorkflow}
        onRemoveWorkflow={(workflow) => { void removeMarketplaceWorkflow(workflow); }}
        onProjectChange={(projectId) => { setSelectedProjectId(projectId); setMarketplaceResult(null); }}
        onCreateProject={createProject}
        onSkuChange={setMarketplaceSku}
        onSaveProduct={() => { void saveMarketplaceProduct(); }}
        onLoadSavedProduct={loadSavedMarketplaceProduct}
        onManageBrandPresets={() => { if (!isAuthenticated) { startLogin(); return; } setMarketplaceOpen(false); setBrandPresetManagerOpen(true); }}
        onDraft={() => { void draftMarketplaceProductBrief(); }}
        onDraftRevisionInstructionChange={setMarketplaceDraftRevisionInstruction}
        onRestoreDraft={(snapshot) => { setMarketplaceProductBrief(cloneMarketplaceProductBrief(snapshot.brief)); setMarketplaceListingCopy(null); setMarketplaceDraftFailure(null); toast.success("已還原草擬版本", { description: "你仍可繼續修改，再確認生成圖片。" }); }}
        onClearDraftHistory={() => { setMarketplaceDraftHistory([]); setMarketplaceDraftFailure(null); }}
        onRenameDraft={(snapshotId, name) => setMarketplaceDraftHistory((history) => renameMarketplaceDraftSnapshot(history, snapshotId, name))}
        onDraftListingCopy={() => { void draftMarketplaceListingCopy(); }}
        onListingCopyChange={setMarketplaceListingCopy}
        onCopyListingText={(kind) => { void copyMarketplaceListingText(kind); }}
        onExportProductData={exportMarketplaceProductData}
        onExportPlatformTemplate={exportMarketplacePlatformTemplate}
        onGenerate={() => { void generateMarketplaceSuite(); }}
        onRetryRole={(role) => { void retryMarketplaceRole(role); }}
        onRedesignRole={(role, instruction) => { void redesignMarketplaceRole(role, instruction); }}
        onDownload={(url, role) => { void downloadMarketplaceImage(url, role); }}
        onShare={(url, role) => { void shareMarketplaceImage(url, role); }}
        onShareAll={() => { void shareMarketplaceSuite(); }}
        sharingRole={marketplaceSharingRole}
        onDownloadAll={() => { void downloadMarketplaceSuite(); }}
        onOpenLibrary={() => { setMarketplaceOpen(false); setLibraryOpen(true); }}
      />
      <BrandPresetManagerDialog
        open={brandPresetManagerOpen}
        onOpenChange={setBrandPresetManagerOpen}
        presets={marketplaceBrandPresets}
        projects={projects}
        activePresetId={marketplaceBrandPresetId}
        isSaving={createMarketplaceBrandPresetMutation.isPending || updateMarketplaceBrandPresetMutation.isPending || setMarketplaceBrandDefaultMutation.isPending || removeMarketplaceBrandPresetMutation.isPending}
        isAssigningProject={assignProjectBrandPresetMutation.isPending}
        onSelectPreset={(presetId) => {
          const preset = marketplaceBrandPresets.find((item) => item.id === presetId);
          setMarketplaceBrandPresetId(presetId);
          setMarketplaceUsesCustomBrandStyle(false);
          if (preset) setMarketplaceBrandStyle({ accentColor: preset.accentColor, fontStyle: preset.fontStyle });
        }}
        onCreatePreset={createMarketplaceBrandPreset}
        onUpdatePreset={updateMarketplaceBrandPreset}
        onSetDefault={setMarketplaceBrandDefault}
        onRemovePreset={removeMarketplaceBrandPreset}
        onAssignProject={assignProjectBrandPreset}
      />
      <AccountProfileDialog
        open={accountProfileOpen}
        onOpenChange={setAccountProfileOpen}
        displayName={user?.displayName}
        accountName={user?.name}
        avatarUrl={user?.avatarUrl}
        email={user?.email}
        lastSignedIn={user?.lastSignedIn}
        loginMethod={user?.loginMethod}
        isSaving={updateAccountProfileMutation.isPending}
        isAvatarUploading={updateAccountAvatarMutation.isPending}
        securityActivities={accountSecurityActivities}
        isSecurityLoading={accountSecurityEventsQuery.isLoading}
        isAdmin={user?.role === "admin"}
        onSave={saveAccountDisplayName}
        onAvatarUpload={uploadAccountAvatar}
        onSwitchAccount={() => { void switchAccount(); }}
        onOpenAdmin={() => { setAccountProfileOpen(false); window.location.assign("/admin"); }}
      />
      <PhotoLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        userName={user?.displayName || user?.name}
        records={savedImages}
        projects={projects}
        isLoading={libraryQuery.isLoading}
        isError={libraryQuery.isError}
        plan={accountPlan}
        used={usage.used}
        allowance={usage.allowance}
        creditBalance={creditBalance}
        processingTimeline={processingTimeline}
        processingTimelineLoading={usageTimelineQuery.isLoading}
        processingTimelineError={usageTimelineQuery.isError}
        storage={storage}
        projectStorage={projectStorage}
        alertPreferencePending={storageEmailAlertsMutation.isPending}
        storageMeteringPending={storageMeteringMutation.isPending}
        restoringId={restoringLibraryImageId}
        assigningId={assignProjectMutation.isPending ? assignProjectMutation.variables?.imageId ?? null : null}
        deletingId={deletingLibraryImageId}
        batchDeletingUnclassified={batchDeletingUnclassified}
        creatingProject={createProjectMutation.isPending}
        onRestore={(record) => void restoreLibraryImage(record)}
        onDownload={downloadSavedImage}
        onCreateProject={createProject}
        onAssignProject={assignSavedImageProject}
        onDelete={deleteSavedImage}
        onDeleteUnclassified={deleteUnclassifiedSavedImages}
        onStorageEmailAlertsChange={(enabled) => void setStorageEmailAlerts(enabled)}
        onRefreshStorageMetering={() => void refreshLegacyStorageMetering()}
        onOpenPlans={openPlans}
        onStartWork={() => {
          setLibraryOpen(false);
          document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className={PLAN_DIALOG_CONTAINER_CLASS}>
          <DialogHeader className="shrink-0 border-b border-[#dbe6f2] bg-[#f8fbff] px-5 pb-3 pt-5 pr-12 text-left sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 text-[#10213b]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e7f0ff] text-[#1665d8]"><CreditCard size={17} /></span>方案與本月處理額度</DialogTitle>
            <DialogDescription className="mt-1 leading-5 text-[#627188]">每月額度只計已完成處理；可向下捲動查看月費與所有一次性加購選項。</DialogDescription>
          </DialogHeader>
          <div className={PLAN_DIALOG_SCROLL_BODY_CLASS}>
	            <div className="rounded-2xl border border-[#d7e6f5] bg-white p-4">
	              <div className="flex items-center justify-between gap-3"><div><span className="text-[11px] font-bold tracking-[.1em] text-[#728198]">目前方案</span><strong className="mt-1 block text-xl text-[#10213b]">{ACCOUNT_PLANS[accountPlan].name}</strong></div><span className="rounded-full bg-[#e7f0ff] px-3 py-1.5 text-xs font-bold text-[#1665d8]">{totalRemaining} 張可用</span></div>
	              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf2f7]"><div className="h-full rounded-full bg-[#1665d8]" style={{ width: usage.percentage + "%" }} /></div>
	              <p className="mt-2 text-xs text-[#64758c]">本月已完成 {usage.used}/{usage.allowance} 張。</p>
	            </div>
	            <PlanComparisonTable currentPlan={accountPlan} />

	            <section className="mt-5" aria-labelledby="monthly-plan-options">
              <div className="flex items-center justify-between gap-3"><h3 id="monthly-plan-options" className="text-sm font-bold text-[#173a58]">月費方案</h3><span className="text-[11px] text-[#718096]">可隨時管理或升級</span></div>
              <div className="mt-2 grid gap-3">
                {(Object.values(ACCOUNT_PLANS) as Array<(typeof ACCOUNT_PLANS)[AccountPlan]>).map((plan) => {
                  const recommended = isRecommendedMonthlyPlan(plan.key);
                  return <div className={recommended ? "relative pt-4" : "relative"} key={plan.key}>
                    {recommended && <span className="absolute left-3 top-0 z-10 inline-flex items-center gap-1 rounded-full bg-[#fbbf24] px-2 py-1 text-[10px] font-extrabold text-[#583b00] shadow-[0_3px_10px_rgba(185,128,0,.22)]"><Sparkles size={11} />推薦方案</span>}
                    <button type="button" onClick={() => showPlanActivationNotice(plan.key)} className={"flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:border-[#8eb8f1] hover:bg-white " + (recommended ? "border-[#e6b428] bg-[#fffaf0] shadow-[0_6px_16px_rgba(185,128,0,.10)] " : "") + (plan.key === accountPlan ? "border-[#bfd3ee] bg-[#f1f7ff]" : "border-[#dfe7ef] bg-white/70")}><span><strong className="block text-sm text-[#263c59]">{plan.name} · {plan.allowance.toLocaleString()} 張/月</strong><span className="mt-0.5 block text-xs text-[#728198]">{plan.monthlyPrice === 0 ? "免費" : "HK$" + plan.monthlyPrice + "/月"}</span></span><ArrowRight size={16} className={recommended ? "text-[#b77800]" : "text-[#1665d8]"} /></button>
                  </div>;
                })}
              </div>
            </section>

            <section className="mt-5 border-t border-[#dfe8f1] pt-4" aria-labelledby="credit-pack-options"><div className="flex items-center justify-between gap-3"><div><h3 id="credit-pack-options" className="text-sm font-bold text-[#173a58]">一次性加購額度</h3><span className="mt-0.5 block text-xs text-[#718096]">額度不設到期日，月費額度優先使用。</span></div><span className="shrink-0 rounded-full bg-[#e7f8f1] px-2.5 py-1 text-xs font-bold text-[#168464]">現有 {creditBalance} 張</span></div><div className="mt-3 grid gap-2">{Object.values(CREDIT_PACKS).map((pack) => { const pending = creditCheckoutMutation.isPending && creditCheckoutMutation.variables?.pack === pack.key; const unavailable = isAuthenticated && !billingEnabled; return <button type="button" key={pack.key} disabled={creditCheckoutMutation.isPending || unavailable} onClick={() => void startCreditCheckout(pack.key)} className="flex items-center justify-between rounded-xl border border-[#d5e7df] bg-[#fbfffd] px-3 py-3 text-left transition hover:border-[#83c8ad] disabled:cursor-not-allowed disabled:opacity-60"><span><strong className="block text-sm text-[#224f40]">{pack.name} · {pack.credits} 張 · HK$ {pack.priceHkd}</strong><span className="mt-0.5 block text-xs text-[#6b8479]">適用地區：{pack.coverage} · 不設到期日</span></span>{pending ? <Loader2 className="animate-spin text-[#168464]" size={16} /> : <ArrowRight size={16} className="text-[#168464]" />}</button>})}</div></section>
            <p className="mt-5 rounded-xl bg-[#eef5fc] px-3 py-2.5 text-xs leading-5 text-[#59708c]">向下捲動可查看全部選項；選擇後會在安全 Stripe 結帳頁完成付款。</p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={detailPreviewOpen} onOpenChange={setDetailPreviewOpen}>
        <DialogContent className="max-h-[94svh] max-w-[calc(100%-1rem)] overflow-y-auto border-[#c9d7e8] bg-[#f8fbff] p-3 sm:max-w-6xl sm:p-5">
          <DialogHeader className="pr-10 text-left">
            <DialogTitle className="text-[#10213b]">放大檢查相片細節</DialogTitle>
            <DialogDescription className="leading-5 text-[#627188]">{workspaceViewMode === "compare" ? "左右滑動可精確比較處理前後效果。" : previewMode === "processed" ? "正在檢查已處理成品；可關閉後切換至原始相片比較。" : "正在檢查原始相片；可關閉後切換至已處理相片比較。"}</DialogDescription>
          </DialogHeader>
          <div className="mt-1 flex min-h-[55svh] items-center justify-center rounded-[18px] bg-[#dae4f0] p-2 sm:p-4">
            {activeImage && shouldShowImageComparison(workspaceViewMode, activeImage.resultUrl) ? <ProcessedImageComparison originalSrc={activeImage.previewUrl} processedSrc={activeImage.resultUrl!} fileName={activeImage.fileName} maxHeight={650} onReturnToOriginal={returnToOriginal} afterAlignment={activeImage.comparisonAlignment} onAdjustAlignment={adjustActiveComparisonAlignment} onAdjustScale={scaleActiveComparisonAlignment} onSetAlignment={setActiveComparisonAlignment} onResetAlignment={resetActiveComparisonAlignment} onSaveAsDefault={saveActiveComparisonAlignmentAsDefault} onClearSavedDefault={clearSavedComparisonAlignment} hasSavedDefault={Boolean(savedComparisonAlignment)} /> : showingUrl && <img src={showingUrl} alt={previewMode === "processed" ? "商業相片已處理放大預覽" : "商業相片原始放大預覽"} className="max-h-[72svh] max-w-full rounded-xl object-contain shadow-[0_16px_38px_rgba(27,48,77,.22)]" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
