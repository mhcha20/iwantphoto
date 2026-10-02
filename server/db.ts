import { and, count, desc, eq, gt, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { accountSecurityEvents, creditTransactions, InsertPhotoProject, InsertUser, InsertUserImage, marketplaceBrandPreferences, marketplaceSavedProducts, marketplaceWorkflows, photoProjects, processingUsageEvents, storageUsageAlerts, userImages, users } from "../drizzle/schema";
import { normaliseMarketplaceListingCopy, type MarketplaceListingCopy } from "@shared/marketplaceListingCopy";
import { isMarketplaceChannel, type MarketplaceChannel } from "@shared/marketplaceSuites";
import { normaliseBriefLines, type MarketplaceProductBrief } from "@shared/marketplaceProductBrief";
import type { AccountPlan } from "@shared/plans";
import { normaliseMarketplaceWorkflowSettings, parseMarketplaceWorkflowRoles, type MarketplaceWorkflow, type MarketplaceWorkflowSettings } from "@shared/marketplaceWorkflows";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateUserDisplayName(userId: number, displayName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ displayName }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function updateUserAvatarUrl(userId: number, avatarUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
  return getUserById(userId);
}

/** Persists an administrator's local test entitlement without touching Stripe-owned plan or subscription columns. */
export async function updateAdminTestPlan(userId: number, adminTestPlan: AccountPlan | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ adminTestPlan }).where(and(eq(users.id, userId), eq(users.role, "admin")));
  return getUserById(userId);
}

export async function recordAccountSecurityEvent(userId: number, event: string, detail: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(accountSecurityEvents).values({ userId, event, detail });
}

export async function listAccountSecurityEvents(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(accountSecurityEvents)
    .where(eq(accountSecurityEvents.userId, userId))
    .orderBy(desc(accountSecurityEvents.createdAt), desc(accountSecurityEvents.id))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function getAdminWorkspaceOverview() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const activeSince = new Date();
  activeSince.setDate(activeSince.getDate() - 30);

  const [accountTotals, imageTotals, plans, accountRows, activityRows] = await Promise.all([
    db.select({ totalUsers: count(users.id), activeUsers: sql<number>`COALESCE(SUM(CASE WHEN ${users.lastSignedIn} >= ${activeSince} THEN 1 ELSE 0 END), 0)` }).from(users),
    db.select({ savedImages: count(userImages.id), monthlyImages: sql<number>`COALESCE(SUM(CASE WHEN ${userImages.createdAt} >= ${monthStart} THEN 1 ELSE 0 END), 0)`, storedBytes: sql<number>`COALESCE(SUM(${userImages.originalBytes} + ${userImages.processedBytes}), 0)` }).from(userImages),
    db.select({ plan: users.plan, count: count(users.id) }).from(users).groupBy(users.plan),
    db.select({
      id: users.id,
      displayName: users.displayName,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      plan: users.plan,
      adminTestPlan: users.adminTestPlan,
      creditBalance: users.creditBalance,
      storageAddonGb: users.storageAddonGb,
      lastSignedIn: users.lastSignedIn,
      imageCount: count(userImages.id),
      storedBytes: sql<number>`COALESCE(SUM(${userImages.originalBytes} + ${userImages.processedBytes}), 0)`,
    }).from(users).leftJoin(userImages, eq(users.id, userImages.userId)).groupBy(users.id).orderBy(desc(users.lastSignedIn)).limit(50),
    db.select({ id: accountSecurityEvents.id, event: accountSecurityEvents.event, detail: accountSecurityEvents.detail, createdAt: accountSecurityEvents.createdAt, userId: users.id, displayName: users.displayName, name: users.name, email: users.email }).from(accountSecurityEvents).leftJoin(users, eq(accountSecurityEvents.userId, users.id)).orderBy(desc(accountSecurityEvents.createdAt), desc(accountSecurityEvents.id)).limit(50),
  ]);

  const totals = accountTotals[0] ?? { totalUsers: 0, activeUsers: 0 };
  const images = imageTotals[0] ?? { savedImages: 0, monthlyImages: 0, storedBytes: 0 };
  return {
    totals: {
      users: Number(totals.totalUsers ?? 0),
      activeUsers: Number(totals.activeUsers ?? 0),
      savedImages: Number(images.savedImages ?? 0),
      monthlyImages: Number(images.monthlyImages ?? 0),
      storedBytes: Number(images.storedBytes ?? 0),
    },
    plans: plans.map((row) => ({ plan: row.plan, count: Number(row.count ?? 0) })),
    accounts: accountRows.map((row) => ({ ...row, imageCount: Number(row.imageCount ?? 0), storedBytes: Number(row.storedBytes ?? 0) })),
    activities: activityRows,
  };
}

function mapMarketplaceWorkflow(row: typeof marketplaceWorkflows.$inferSelect): MarketplaceWorkflow {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...normaliseMarketplaceWorkflowSettings({
      channel: row.channel as MarketplaceWorkflowSettings["channel"],
      selectedRoles: parseMarketplaceWorkflowRoles(row.selectedRoles),
      lifestyleStyle: row.lifestyleStyle as MarketplaceWorkflowSettings["lifestyleStyle"],
      projectId: row.projectId,
      brandPresetId: row.brandPresetId,
      useCustomBrandStyle: row.useCustomBrandStyle === 1,
      brandStyle: { accentColor: row.accentColor, fontStyle: row.fontStyle },
    }),
  };
}

export async function listMarketplaceWorkflows(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(marketplaceWorkflows)
    .where(eq(marketplaceWorkflows.userId, userId))
    .orderBy(desc(marketplaceWorkflows.updatedAt), desc(marketplaceWorkflows.id));
  return rows.map(mapMarketplaceWorkflow);
}

export async function createMarketplaceWorkflow(input: { userId: number; name: string } & MarketplaceWorkflowSettings) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const settings = normaliseMarketplaceWorkflowSettings(input);
  await db.insert(marketplaceWorkflows).values({
    userId: input.userId,
    name: input.name,
    channel: settings.channel,
    selectedRoles: JSON.stringify(settings.selectedRoles),
    lifestyleStyle: settings.lifestyleStyle,
    projectId: settings.projectId,
    brandPresetId: settings.brandPresetId,
    useCustomBrandStyle: settings.useCustomBrandStyle ? 1 : 0,
    accentColor: settings.brandStyle.accentColor,
    fontStyle: settings.brandStyle.fontStyle,
  });
  const rows = await db.select().from(marketplaceWorkflows)
    .where(and(eq(marketplaceWorkflows.userId, input.userId), eq(marketplaceWorkflows.name, input.name)))
    .orderBy(desc(marketplaceWorkflows.id)).limit(1);
  return rows[0] ? mapMarketplaceWorkflow(rows[0]) : undefined;
}

export async function removeMarketplaceWorkflow(userId: number, workflowId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.delete(marketplaceWorkflows)
    .where(and(eq(marketplaceWorkflows.userId, userId), eq(marketplaceWorkflows.id, workflowId)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function listMarketplaceBrandPresets(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(marketplaceBrandPreferences)
    .where(eq(marketplaceBrandPreferences.userId, userId))
    .orderBy(desc(marketplaceBrandPreferences.isDefault), desc(marketplaceBrandPreferences.updatedAt), desc(marketplaceBrandPreferences.id));
}

export async function getMarketplaceBrandPresetForUser(userId: number, presetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const records = await db.select().from(marketplaceBrandPreferences)
    .where(and(eq(marketplaceBrandPreferences.userId, userId), eq(marketplaceBrandPreferences.id, presetId)))
    .limit(1);
  return records[0];
}

export async function createMarketplaceBrandPreset(input: {
  userId: number;
  name: string;
  accentColor: string;
  fontStyle: "clean" | "editorial" | "friendly";
  logoUrl?: string | null;
  logoMimeType?: string | null;
  setAsDefault?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const existingDefault = await tx.select({ id: marketplaceBrandPreferences.id }).from(marketplaceBrandPreferences)
      .where(and(eq(marketplaceBrandPreferences.userId, input.userId), eq(marketplaceBrandPreferences.isDefault, 1)))
      .limit(1);
    const isDefault = input.setAsDefault || !existingDefault[0] ? 1 : 0;
    if (isDefault) {
      await tx.update(marketplaceBrandPreferences).set({ isDefault: 0 })
        .where(eq(marketplaceBrandPreferences.userId, input.userId));
    }
    await tx.insert(marketplaceBrandPreferences).values({
      userId: input.userId,
      name: input.name,
      accentColor: input.accentColor,
      fontStyle: input.fontStyle,
      logoUrl: input.logoUrl ?? null,
      logoMimeType: input.logoMimeType ?? null,
      isDefault,
    });
    const records = await tx.select().from(marketplaceBrandPreferences)
      .where(and(eq(marketplaceBrandPreferences.userId, input.userId), eq(marketplaceBrandPreferences.name, input.name)))
      .orderBy(desc(marketplaceBrandPreferences.id)).limit(1);
    return records[0];
  });
}

export async function updateMarketplaceBrandPreset(input: {
  userId: number;
  presetId: number;
  name: string;
  accentColor: string;
  fontStyle: "clean" | "editorial" | "friendly";
  logoUrl?: string | null;
  logoMimeType?: string | null;
  removeLogo?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const update: Partial<typeof marketplaceBrandPreferences.$inferInsert> = {
    name: input.name,
    accentColor: input.accentColor,
    fontStyle: input.fontStyle,
  };
  if (input.removeLogo) {
    update.logoUrl = null;
    update.logoMimeType = null;
  } else if (input.logoUrl) {
    update.logoUrl = input.logoUrl;
    update.logoMimeType = input.logoMimeType ?? null;
  }
  await db.update(marketplaceBrandPreferences).set(update)
    .where(and(eq(marketplaceBrandPreferences.userId, input.userId), eq(marketplaceBrandPreferences.id, input.presetId)));
  return getMarketplaceBrandPresetForUser(input.userId, input.presetId);
}

export async function setMarketplaceBrandPresetDefault(userId: number, presetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const preset = await tx.select({ id: marketplaceBrandPreferences.id }).from(marketplaceBrandPreferences)
      .where(and(eq(marketplaceBrandPreferences.userId, userId), eq(marketplaceBrandPreferences.id, presetId))).limit(1);
    if (!preset[0]) return undefined;
    await tx.update(marketplaceBrandPreferences).set({ isDefault: 0 }).where(eq(marketplaceBrandPreferences.userId, userId));
    await tx.update(marketplaceBrandPreferences).set({ isDefault: 1 }).where(and(eq(marketplaceBrandPreferences.userId, userId), eq(marketplaceBrandPreferences.id, presetId)));
    return preset[0];
  });
}

export async function removeMarketplaceBrandPreset(userId: number, presetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const current = await tx.select({ id: marketplaceBrandPreferences.id, isDefault: marketplaceBrandPreferences.isDefault })
      .from(marketplaceBrandPreferences)
      .where(and(eq(marketplaceBrandPreferences.userId, userId), eq(marketplaceBrandPreferences.id, presetId))).limit(1);
    if (!current[0]) return false;
    await tx.update(photoProjects).set({ brandPresetId: null })
      .where(and(eq(photoProjects.userId, userId), eq(photoProjects.brandPresetId, presetId)));
    await tx.delete(marketplaceBrandPreferences)
      .where(and(eq(marketplaceBrandPreferences.userId, userId), eq(marketplaceBrandPreferences.id, presetId)));
    if (current[0].isDefault === 1) {
      const next = await tx.select({ id: marketplaceBrandPreferences.id }).from(marketplaceBrandPreferences)
        .where(eq(marketplaceBrandPreferences.userId, userId)).orderBy(desc(marketplaceBrandPreferences.updatedAt), desc(marketplaceBrandPreferences.id)).limit(1);
      if (next[0]) await tx.update(marketplaceBrandPreferences).set({ isDefault: 1 })
        .where(and(eq(marketplaceBrandPreferences.userId, userId), eq(marketplaceBrandPreferences.id, next[0].id)));
    }
    return true;
  });
}

export async function setPhotoProjectBrandPreset(userId: number, projectId: number, presetId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (presetId !== null) {
    const preset = await getMarketplaceBrandPresetForUser(userId, presetId);
    if (!preset) return undefined;
  }
  await db.update(photoProjects).set({ brandPresetId: presetId })
    .where(and(eq(photoProjects.userId, userId), eq(photoProjects.id, projectId)));
  const records = await db.select().from(photoProjects)
    .where(and(eq(photoProjects.userId, userId), eq(photoProjects.id, projectId))).limit(1);
  return records[0];
}

type SavedMarketplaceProductPayload = {
  userId: number;
  projectId: number;
  sku: string;
  brief: MarketplaceProductBrief;
  listingCopy?: MarketplaceListingCopy | null;
};

function parseSavedLines(value: string) {
  try {
    const parsed = JSON.parse(value);
    return normaliseBriefLines(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []);
  } catch {
    return [];
  }
}

function parseSavedListingCopy(value: string | null, channel: MarketplaceListingCopy["channel"] = "amazon") {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MarketplaceListingCopy>;
    const storedChannel = typeof parsed.channel === "string" && isMarketplaceChannel(parsed.channel) ? parsed.channel as MarketplaceChannel : channel;
    return normaliseMarketplaceListingCopy(parsed, storedChannel);
  } catch {
    return null;
  }
}

function mapSavedMarketplaceProduct(record: typeof marketplaceSavedProducts.$inferSelect) {
  return {
    ...record,
    brief: {
      productName: record.productName,
      summary: record.summary,
      weight: record.weight,
      dimensions: record.dimensions,
      confirmedFacts: parseSavedLines(record.confirmedFacts),
      visualHighlights: parseSavedLines(record.visualHighlights),
      usageIdeas: parseSavedLines(record.usageIdeas),
      reviewQuestions: parseSavedLines(record.reviewQuestions),
    } satisfies MarketplaceProductBrief,
    listingCopy: parseSavedListingCopy(record.listingCopy),
  };
}

export async function listSavedMarketplaceProducts(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const records = await db.select().from(marketplaceSavedProducts)
    .where(and(eq(marketplaceSavedProducts.userId, userId), eq(marketplaceSavedProducts.projectId, projectId)))
    .orderBy(desc(marketplaceSavedProducts.updatedAt), desc(marketplaceSavedProducts.id));
  return records.map(mapSavedMarketplaceProduct);
}

export async function upsertSavedMarketplaceProduct(input: SavedMarketplaceProductPayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const sku = input.sku.trim().replace(/\s+/g, " ");
  const values = {
    userId: input.userId,
    projectId: input.projectId,
    sku,
    productName: input.brief.productName.trim(),
    summary: input.brief.summary.trim(),
    weight: input.brief.weight.trim().replace(/\s+/g, " ").slice(0, 80),
    dimensions: input.brief.dimensions.trim().replace(/\s+/g, " ").slice(0, 80),
    confirmedFacts: JSON.stringify(normaliseBriefLines(input.brief.confirmedFacts)),
    visualHighlights: JSON.stringify(normaliseBriefLines(input.brief.visualHighlights)),
    usageIdeas: JSON.stringify(normaliseBriefLines(input.brief.usageIdeas)),
    reviewQuestions: JSON.stringify(normaliseBriefLines(input.brief.reviewQuestions)),
    listingCopy: input.listingCopy ? JSON.stringify(normaliseMarketplaceListingCopy(input.listingCopy, input.listingCopy.channel)) : null,
  };
  await db.insert(marketplaceSavedProducts).values(values).onDuplicateKeyUpdate({
    set: {
      productName: values.productName,
      summary: values.summary,
      weight: values.weight,
      dimensions: values.dimensions,
      confirmedFacts: values.confirmedFacts,
      visualHighlights: values.visualHighlights,
      usageIdeas: values.usageIdeas,
      reviewQuestions: values.reviewQuestions,
      listingCopy: values.listingCopy,
    },
  });
  const records = await db.select().from(marketplaceSavedProducts)
    .where(and(eq(marketplaceSavedProducts.userId, input.userId), eq(marketplaceSavedProducts.projectId, input.projectId), eq(marketplaceSavedProducts.sku, sku)))
    .orderBy(desc(marketplaceSavedProducts.updatedAt), desc(marketplaceSavedProducts.id)).limit(1);
  return records[0] ? mapSavedMarketplaceProduct(records[0]) : undefined;
}

export async function getUserByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId)).limit(1);
  return result[0];
}

export async function updateUserBillingState(input: {
  userId: number;
  plan: "starter" | "pro" | "business";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({
    plan: input.plan,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    subscriptionStatus: input.subscriptionStatus,
    subscriptionCurrentPeriodEnd: input.subscriptionCurrentPeriodEnd,
  }).where(eq(users.id, input.userId));
  return getUserById(input.userId);
}

export async function updateUserStorageSubscription(input: {
  userId: number;
  storageAddonGb: number;
  stripeStorageSubscriptionId: string | null;
  storageSubscriptionStatus: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({
    storageAddonGb: input.storageAddonGb,
    stripeStorageSubscriptionId: input.stripeStorageSubscriptionId,
    storageSubscriptionStatus: input.storageSubscriptionStatus,
  }).where(eq(users.id, input.userId));
  return getUserById(input.userId);
}

export async function grantPurchasedCredits(input: { userId: number; checkoutSessionId: string; credits: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const duplicate = await tx.select({ id: creditTransactions.id, balanceAfter: creditTransactions.balanceAfter })
      .from(creditTransactions)
      .where(eq(creditTransactions.stripeCheckoutSessionId, input.checkoutSessionId))
      .limit(1);
    if (duplicate[0]) return { granted: false, balance: duplicate[0].balanceAfter };

    const user = await tx.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user[0]) throw new Error("Account was not found for a credit purchase");
    const balanceAfter = user[0].creditBalance + input.credits;
    await tx.update(users).set({ creditBalance: balanceAfter }).where(eq(users.id, input.userId));
    await tx.insert(creditTransactions).values({
      userId: input.userId,
      delta: input.credits,
      balanceAfter,
      reason: "purchase",
      stripeCheckoutSessionId: input.checkoutSessionId,
    });
    return { granted: true, balance: balanceAfter };
  });
}

export async function spendPrepaidCredit(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const updateResult = await tx.update(users)
      .set({ creditBalance: sql`${users.creditBalance} - 1` })
      .where(and(eq(users.id, userId), gt(users.creditBalance, 0)));
    const affectedRows = Number((updateResult as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
    if (affectedRows !== 1) return { spent: false, balance: 0 };
    const user = await tx.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1);
    const balanceAfter = user[0]?.creditBalance ?? 0;
    await tx.insert(creditTransactions).values({ userId, delta: -1, balanceAfter, reason: "spend" });
    return { spent: true, balance: balanceAfter };
  });
}

export async function refundPrepaidCredit(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async (tx) => {
    const user = await tx.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user[0]) throw new Error("Account was not found for a credit refund");
    const balanceAfter = user[0].creditBalance + 1;
    await tx.update(users).set({ creditBalance: balanceAfter }).where(eq(users.id, userId));
    await tx.insert(creditTransactions).values({ userId, delta: 1, balanceAfter, reason: "refund" });
    return { balance: balanceAfter };
  });
}

export async function createUserImage(image: InsertUserImage) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(userImages).values(image);
  const record = await db.select().from(userImages).where(eq(userImages.userId, image.userId)).orderBy(desc(userImages.id)).limit(1);
  return record[0];
}

/** Returns one saved image only when it belongs to the authenticated account. */
export async function getUserImageForUser(userId: number, imageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const records = await db.select().from(userImages)
    .where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)))
    .limit(1);
  return records[0];
}

export async function createPhotoProject(project: InsertPhotoProject) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(photoProjects).values(project);
  const record = await db.select().from(photoProjects)
    .where(and(eq(photoProjects.userId, project.userId), eq(photoProjects.name, project.name)))
    .orderBy(desc(photoProjects.id))
    .limit(1);
  return record[0];
}

export async function listPhotoProjects(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db.select().from(photoProjects).where(eq(photoProjects.userId, userId)).orderBy(desc(photoProjects.createdAt), desc(photoProjects.id));
}

export async function getPhotoProjectForUser(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const records = await db.select().from(photoProjects)
    .where(and(eq(photoProjects.id, projectId), eq(photoProjects.userId, userId)))
    .limit(1);
  return records[0];
}

export async function assignImageToProject(userId: number, imageId: number, projectId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  if (projectId !== null) {
    const project = await db.select({ id: photoProjects.id }).from(photoProjects).where(and(eq(photoProjects.id, projectId), eq(photoProjects.userId, userId))).limit(1);
    if (!project[0]) return undefined;
  }

  await db.update(userImages).set({ projectId }).where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)));
  const image = await db.select().from(userImages).where(and(eq(userImages.id, imageId), eq(userImages.userId, userId))).limit(1);
  return image[0];
}

export async function listUserImages(userId: number, limit = 60) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db.select().from(userImages).where(eq(userImages.userId, userId)).orderBy(desc(userImages.createdAt), desc(userImages.id)).limit(limit);
}

export async function getUserImageStorageBytes(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [result] = await db.select({
    total: sql<number>`coalesce(sum(${userImages.originalBytes} + ${userImages.processedBytes}), 0)`,
  }).from(userImages).where(eq(userImages.userId, userId));
  return Number(result?.total ?? 0);
}

/** Lists only legacy saved-image records that did not record one or both object sizes. */
export async function listUserImagesMissingStorageBytes(userId: number, limit = 60) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({
    id: userImages.id,
    originalUrl: userImages.originalUrl,
    processedUrl: userImages.processedUrl,
    originalBytes: userImages.originalBytes,
    processedBytes: userImages.processedBytes,
  }).from(userImages)
    .where(and(eq(userImages.userId, userId), or(eq(userImages.originalBytes, 0), eq(userImages.processedBytes, 0))))
    .orderBy(desc(userImages.id))
    .limit(limit);
}

/** Updates the measured footprint for an account-owned saved image only. */
export async function updateUserImageStorageBytes(userId: number, imageId: number, sizes: { originalBytes: number; processedBytes: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(userImages).set({
    originalBytes: sizes.originalBytes,
    processedBytes: sizes.processedBytes,
  }).where(and(eq(userImages.userId, userId), eq(userImages.id, imageId)));
}

export async function getUserProjectStorageSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [projects, usageRows] = await Promise.all([
    listPhotoProjects(userId),
    db.select({
      projectId: userImages.projectId,
      imageCount: count(),
      usedBytes: sql<number>`coalesce(sum(${userImages.originalBytes} + ${userImages.processedBytes}), 0)`,
    }).from(userImages).where(eq(userImages.userId, userId)).groupBy(userImages.projectId),
  ]);
  const usageByProjectId = new Map(usageRows.map((row) => [row.projectId ?? null, { imageCount: Number(row.imageCount), usedBytes: Number(row.usedBytes) }]));
  const projectRows = projects.map((project) => ({
    projectId: project.id,
    name: project.name,
    imageCount: usageByProjectId.get(project.id)?.imageCount ?? 0,
    usedBytes: usageByProjectId.get(project.id)?.usedBytes ?? 0,
  }));
  const inboxUsage = usageByProjectId.get(null);
  return inboxUsage || projectRows.length === 0
    ? [{ projectId: null, name: "未分類", imageCount: inboxUsage?.imageCount ?? 0, usedBytes: inboxUsage?.usedBytes ?? 0 }, ...projectRows]
    : projectRows;
}

export async function setStorageEmailAlertsEnabled(userId: number, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ storageEmailAlertsEnabled: enabled ? 1 : 0 }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function reserveStorageUsageAlert(userId: number, threshold: number, cycle: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  try {
    await db.insert(storageUsageAlerts).values({ userId, threshold, cycle, status: "pending" });
    return true;
  } catch (error) {
    if (error instanceof Error && /duplicate|unique|ER_DUP_ENTRY/i.test(error.message)) return false;
    throw error;
  }
}

export async function markStorageUsageAlertSent(userId: number, threshold: number, cycle: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(storageUsageAlerts).set({ status: "sent", sentAt: new Date() })
    .where(and(eq(storageUsageAlerts.userId, userId), eq(storageUsageAlerts.threshold, threshold), eq(storageUsageAlerts.cycle, cycle)));
}

export async function releaseStorageUsageAlert(userId: number, threshold: number, cycle: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(storageUsageAlerts).where(and(eq(storageUsageAlerts.userId, userId), eq(storageUsageAlerts.threshold, threshold), eq(storageUsageAlerts.cycle, cycle)));
}

export async function rearmStorageUsageAlerts(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const user = await db.select({ storageAlertCycle: users.storageAlertCycle }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return false;
  const alert = await db.select({ id: storageUsageAlerts.id }).from(storageUsageAlerts)
    .where(and(eq(storageUsageAlerts.userId, userId), eq(storageUsageAlerts.cycle, user[0].storageAlertCycle)))
    .limit(1);
  if (!alert[0]) return false;
  await db.update(users).set({ storageAlertCycle: sql`${users.storageAlertCycle} + 1` }).where(eq(users.id, userId));
  return true;
}

export async function removeUserImage(userId: number, imageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.delete(userImages).where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)));
  const affectedRows = Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
  return affectedRows === 1;
}

/**
 * Removes only selected, account-owned records that remain unclassified.
 * Managed storage objects are intentionally retained as unreferenced objects,
 * following the storage provider's no-delete lifecycle policy.
 */
export async function removeUnclassifiedUserImages(userId: number, imageIds: number[]) {
  const uniqueImageIds = Array.from(new Set(imageIds)).filter((id) => Number.isInteger(id) && id > 0);
  if (!uniqueImageIds.length) return 0;
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.delete(userImages).where(and(
    eq(userImages.userId, userId),
    isNull(userImages.projectId),
    inArray(userImages.id, uniqueImageIds),
  ));
  return Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
}

export async function countUserImagesSince(userId: number, since: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [result] = await db
    .select({ total: count() })
    .from(userImages)
    .where(and(eq(userImages.userId, userId), gte(userImages.createdAt, since)));

  return Number(result?.total ?? 0);
}

/**
 * Returns successful processing units from the append-only ledger. This must
 * never be derived from user_images because an account may delete archive
 * records while its monthly processing allowance remains consumed.
 */
export async function countUserProcessingUsageSince(userId: number, since: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [result] = await db
    .select({ total: sql<number>`coalesce(sum(${processingUsageEvents.units}), 0)` })
    .from(processingUsageEvents)
    .where(and(eq(processingUsageEvents.userId, userId), gte(processingUsageEvents.createdAt, since)));

  return Number(result?.total ?? 0);
}

/** Lists only the signed-in account's successful processing events for an account-facing monthly history. */
export async function listUserProcessingUsageSince(userId: number, since: Date, limit = 80) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  return db
    .select({
      id: processingUsageEvents.id,
      units: processingUsageEvents.units,
      source: processingUsageEvents.source,
      createdAt: processingUsageEvents.createdAt,
    })
    .from(processingUsageEvents)
    .where(and(eq(processingUsageEvents.userId, userId), gte(processingUsageEvents.createdAt, since)))
    .orderBy(desc(processingUsageEvents.createdAt), desc(processingUsageEvents.id))
    .limit(Math.min(100, Math.max(1, limit)));
}

/** Records one successfully delivered processing output and is intentionally never deleted with photo-library records. */
export async function recordProcessingUsage(input: { userId: number; source: string; units?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const units = Math.max(1, Math.floor(input.units ?? 1));
  await db.insert(processingUsageEvents).values({
    userId: input.userId,
    units,
    source: input.source.slice(0, 40),
  });
}
