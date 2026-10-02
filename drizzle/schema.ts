import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  /** Account-controlled name shown in the Iwantphoto workspace; OAuth updates never overwrite it. */
  displayName: varchar("displayName", { length: 80 }),
  /** Small, account-owned avatar stored in managed object storage; excluded from customer photo archive metering. */
  avatarUrl: text("avatarUrl"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Subscription tier controls monthly saved-image processing allowance. */
  plan: mysqlEnum("plan", ["starter", "pro", "business"]).default("starter").notNull(),
  /** Administrator-only local entitlement override for self-service testing; never changes Stripe subscription data. */
  adminTestPlan: mysqlEnum("adminTestPlan", ["starter", "pro", "business"]),
  /** Stripe identifiers are written only by verified server-side webhook events. */
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).unique(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).unique(),
  subscriptionStatus: varchar("subscriptionStatus", { length: 48 }),
  subscriptionCurrentPeriodEnd: timestamp("subscriptionCurrentPeriodEnd"),
  /** Recurring archive capacity is synchronized only by verified Stripe events. */
  storageAddonGb: int("storageAddonGb").default(0).notNull(),
  stripeStorageSubscriptionId: varchar("stripeStorageSubscriptionId", { length: 255 }).unique(),
  storageSubscriptionStatus: varchar("storageSubscriptionStatus", { length: 48 }),
  /** Customer-controlled capacity alert delivery and the deduplication cycle. */
  storageEmailAlertsEnabled: int("storageEmailAlertsEnabled").default(1).notNull(),
  storageAlertCycle: int("storageAlertCycle").default(0).notNull(),
  /** Prepaid processing credits never expire and are spent after monthly allowance. */
  creditBalance: int("creditBalance").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Account-visible authentication and profile events, retained for security review. */
export const accountSecurityEvents = mysqlTable("account_security_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  event: varchar("event", { length: 40 }).notNull(),
  detail: varchar("detail", { length: 240 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("account_security_events_user_created_idx").on(table.userId, table.createdAt),
]);

export type AccountSecurityEvent = typeof accountSecurityEvents.$inferSelect;

/** Immutable audit record for every verified purchase and credit debit/refund. */
export const creditTransactions = mysqlTable("credit_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  delta: int("delta").notNull(),
  balanceAfter: int("balanceAfter").notNull(),
  reason: varchar("reason", { length: 32 }).notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("credit_transactions_user_created_idx").on(table.userId, table.createdAt),
]);

export type CreditTransaction = typeof creditTransactions.$inferSelect;

/**
 * Immutable record of successful image-processing outputs. Monthly plan usage is
 * derived from this ledger rather than the current photo-library records, so
 * deleting an archive record never refunds a consumed processing allowance.
 */
export const processingUsageEvents = mysqlTable("processing_usage_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  units: int("units").default(1).notNull(),
  source: varchar("source", { length: 40 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("processing_usage_events_user_created_idx").on(table.userId, table.createdAt),
]);

export type ProcessingUsageEvent = typeof processingUsageEvents.$inferSelect;

/** Account-owned folders used to group client jobs, campaigns, or delivery batches. */
export const photoProjects = mysqlTable("photo_projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  /** Optional client label used to distinguish similar campaigns and delivery folders. */
  clientName: varchar("clientName", { length: 60 }),
  /** Optional concise internal note; never included in AI product prompts. */
  description: varchar("description", { length: 160 }),
  /** Optional account-owned brand preset applied to marketplace suites saved in this project. */
  brandPresetId: int("brandPresetId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("photo_projects_user_created_idx").on(table.userId, table.createdAt),
  uniqueIndex("photo_projects_user_name_unique").on(table.userId, table.name),
]);

export type PhotoProject = typeof photoProjects.$inferSelect;
export type InsertPhotoProject = typeof photoProjects.$inferInsert;

/** Named, account-owned visual presets for marketplace supplementary assets. */
export const marketplaceBrandPreferences = mysqlTable("marketplace_brand_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  accentColor: varchar("accentColor", { length: 7 }).notNull(),
  fontStyle: mysqlEnum("fontStyle", ["clean", "editorial", "friendly"]).notNull(),
  logoUrl: text("logoUrl"),
  logoMimeType: varchar("logoMimeType", { length: 80 }),
  isDefault: int("isDefault").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("marketplace_brand_preferences_user_name_unique").on(table.userId, table.name),
  index("marketplace_brand_preferences_user_default_idx").on(table.userId, table.isDefault),
]);

export type MarketplaceBrandPreference = typeof marketplaceBrandPreferences.$inferSelect;

/** Merchant-confirmed product records that can be reused within an account project. */
export const marketplaceSavedProducts = mysqlTable("marketplace_saved_products", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  sku: varchar("sku", { length: 80 }).notNull(),
  productName: varchar("productName", { length: 100 }).notNull(),
  summary: text("summary").notNull(),
  /** Merchant-confirmed product weight, not delivery/package weight. */
  weight: varchar("weight", { length: 80 }).default("").notNull(),
  /** Merchant-confirmed product dimensions, formatted as merchant-entered copy. */
  dimensions: varchar("dimensions", { length: 80 }).default("").notNull(),
  confirmedFacts: text("confirmedFacts").notNull(),
  visualHighlights: text("visualHighlights").notNull(),
  usageIdeas: text("usageIdeas").notNull(),
  reviewQuestions: text("reviewQuestions").notNull(),
  listingCopy: text("listingCopy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("marketplace_saved_products_user_project_sku_unique").on(table.userId, table.projectId, table.sku),
  index("marketplace_saved_products_user_project_updated_idx").on(table.userId, table.projectId, table.updatedAt),
]);

export type MarketplaceSavedProduct = typeof marketplaceSavedProducts.$inferSelect;

/** Reusable, account-owned Marketplace Suite settings. Product facts and source images are deliberately excluded. */
export const marketplaceWorkflows = mysqlTable("marketplace_workflows", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  channel: varchar("channel", { length: 24 }).notNull(),
  selectedRoles: text("selectedRoles").notNull(),
  lifestyleStyle: varchar("lifestyleStyle", { length: 24 }).notNull(),
  projectId: int("projectId"),
  brandPresetId: int("brandPresetId"),
  useCustomBrandStyle: int("useCustomBrandStyle").default(0).notNull(),
  accentColor: varchar("accentColor", { length: 7 }).notNull(),
  fontStyle: mysqlEnum("fontStyle", ["clean", "editorial", "friendly"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("marketplace_workflows_user_name_unique").on(table.userId, table.name),
  index("marketplace_workflows_user_updated_idx").on(table.userId, table.updatedAt),
]);

export type MarketplaceWorkflow = typeof marketplaceWorkflows.$inferSelect;

/**
 * A completed image transformation that belongs to one authenticated account.
 * Image bytes remain in managed object storage; only their stable storage URLs
 * and lightweight processing metadata are persisted here.
 */
export const userImages = mysqlTable("user_images", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  fileName: varchar("fileName", { length: 160 }).notNull(),
  mimeType: varchar("mimeType", { length: 80 }).notNull(),
  originalUrl: text("originalUrl").notNull(),
  processedUrl: text("processedUrl").notNull(),
  /** Exact file-byte footprint of the stored original and generated output. */
  originalBytes: int("originalBytes").default(0).notNull(),
  processedBytes: int("processedBytes").default(0).notNull(),
  mode: mysqlEnum("mode", ["background", "cleanup", "marketplace"]).notNull(),
  backgroundStyle: mysqlEnum("backgroundStyle", ["transparent", "white"]).notNull(),
  cleanupNote: text("cleanupNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("user_images_user_created_idx").on(table.userId, table.createdAt),
  index("user_images_user_project_idx").on(table.userId, table.projectId),
]);

export type UserImage = typeof userImages.$inferSelect;
export type InsertUserImage = typeof userImages.$inferInsert;

/** One record per account, capacity threshold, and re-armed usage cycle. */
export const storageUsageAlerts = mysqlTable("storage_usage_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  threshold: int("threshold").notNull(),
  cycle: int("cycle").notNull(),
  status: varchar("status", { length: 16 }).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("storage_usage_alerts_user_threshold_cycle_unique").on(table.userId, table.threshold, table.cycle),
  index("storage_usage_alerts_user_created_idx").on(table.userId, table.createdAt),
]);

export type StorageUsageAlert = typeof storageUsageAlerts.$inferSelect;
