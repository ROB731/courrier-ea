import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const letterTemplates = mysqlTable("letter_templates", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  originalFileName: varchar("originalFileName", { length: 220 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 600 }).notNull(),
  placeholderCount: int("placeholderCount").notNull(),
  fieldsJson: text("fieldsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("letter_templates_user_created_idx").on(table.userId, table.createdAt)]);

export const campaignStatus = ["generating", "ready", "error"] as const;

export const campaigns = mysqlTable("campaigns", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: int("userId").notNull(),
  templateId: varchar("templateId", { length: 32 }).notNull(),
  name: varchar("name", { length: 140 }).notNull(),
  excelFileKey: varchar("excelFileKey", { length: 500 }).notNull(),
  excelFileUrl: varchar("excelFileUrl", { length: 600 }).notNull(),
  dataSourceType: varchar("dataSourceType", { length: 20 }).default("excel").notNull(),
  mappingsJson: text("mappingsJson"),
  recipientCount: int("recipientCount").notNull(),
  status: mysqlEnum("status", campaignStatus).default("generating").notNull(),
  zipFileKey: varchar("zipFileKey", { length: 500 }),
  zipFileUrl: varchar("zipFileUrl", { length: 600 }),
  pdfFileKey: varchar("pdfFileKey", { length: 500 }),
  pdfFileUrl: varchar("pdfFileUrl", { length: 600 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("campaigns_user_created_idx").on(table.userId, table.createdAt)]);

export const recipientStatus = ["to_send", "sent"] as const;

export const campaignRecipients = mysqlTable("campaign_recipients", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: varchar("campaignId", { length: 32 }).notNull(),
  name: varchar("name", { length: 350 }).notNull(),
  valuesJson: text("valuesJson"),
  warning: text("warning"),
  position: int("position").notNull(),
  status: mysqlEnum("status", recipientStatus).default("to_send").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("campaign_recipients_campaign_position_idx").on(table.campaignId, table.position)]);

export type LetterTemplate = typeof letterTemplates.$inferSelect;
export type InsertLetterTemplate = typeof letterTemplates.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
