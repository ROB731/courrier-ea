import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  campaignRecipients,
  campaigns,
  InsertCampaign,
  InsertLetterTemplate,
  InsertUser,
  letterTemplates,
  recipientDirectory,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  try { await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet }); }
  catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createLetterTemplate(template: InsertLetterTemplate): Promise<void> {
  const db = await requireDb();
  await db.insert(letterTemplates).values(template);
}

export async function listLetterTemplatesForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(letterTemplates).where(eq(letterTemplates.userId, userId)).orderBy(desc(letterTemplates.createdAt));
}

export async function getLetterTemplateForUser(templateId: string, userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(letterTemplates).where(and(eq(letterTemplates.id, templateId), eq(letterTemplates.userId, userId))).limit(1);
  return rows[0];
}

export async function createCampaign(campaign: InsertCampaign): Promise<void> {
  const db = await requireDb();
  await db.insert(campaigns).values(campaign);
}

export async function updateCampaign(campaignId: string, userId: number, values: Partial<InsertCampaign>): Promise<void> {
  const db = await requireDb();
  await db.update(campaigns).set(values).where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
}

export async function listCampaignsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignForUser(campaignId: string, userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))).limit(1);
  return rows[0];
}

export async function createRecipients(campaignId: string, recipients: Array<{ name: string; values: Record<string, string>; warning: string | null; position: number }>): Promise<void> {
  if (!recipients.length) return;
  const db = await requireDb();
  await db.insert(campaignRecipients).values(recipients.map(recipient => ({ campaignId, name: recipient.name, valuesJson: JSON.stringify(recipient.values), warning: recipient.warning, position: recipient.position, status: "to_send" as const })));
}

export async function listCampaignRecipients(campaignId: string) {
  const db = await requireDb();
  return db.select().from(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId)).orderBy(asc(campaignRecipients.position));
}

export async function updateRecipientStatus(recipientId: number, campaignId: string, status: "to_send" | "sent"): Promise<void> {
  const db = await requireDb();
  await db.update(campaignRecipients).set({ status }).where(and(eq(campaignRecipients.id, recipientId), eq(campaignRecipients.campaignId, campaignId)));
}

export type DirectoryValues = Record<string, string>;

function normalizeDirectoryName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

export async function listDirectoryRecipients(userId: number, query?: string) {
  const db = await requireDb();
  const rows = await db.select().from(recipientDirectory).where(eq(recipientDirectory.userId, userId)).orderBy(desc(recipientDirectory.updatedAt));
  const keyword = query?.trim().toLocaleLowerCase("fr") ?? "";
  return keyword ? rows.filter(row => `${row.name} ${row.valuesJson}`.toLocaleLowerCase("fr").includes(keyword)) : rows;
}

export async function getDirectoryRecipientForUser(id: string, userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(recipientDirectory).where(and(eq(recipientDirectory.id, id), eq(recipientDirectory.userId, userId))).limit(1);
  return rows[0];
}

export async function createDirectoryRecipient(userId: number, name: string, values: DirectoryValues, source: "import" | "manual") {
  const db = await requireDb();
  const normalizedName = normalizeDirectoryName(name);
  const existing = await db.select({ id: recipientDirectory.id }).from(recipientDirectory).where(and(eq(recipientDirectory.userId, userId), eq(recipientDirectory.normalizedName, normalizedName))).limit(1);
  if (existing[0]) {
    await db.update(recipientDirectory).set({ name, valuesJson: JSON.stringify(values), source }).where(and(eq(recipientDirectory.id, existing[0].id), eq(recipientDirectory.userId, userId)));
    return { id: existing[0].id, created: false };
  }
  const id = nanoid();
  await db.insert(recipientDirectory).values({ id, userId, name, normalizedName, valuesJson: JSON.stringify(values), source });
  return { id, created: true };
}

export async function saveImportedDirectoryRecipients(userId: number, recipients: Array<{ name: string; values: DirectoryValues }>) {
  let created = 0;
  let updated = 0;
  for (const recipient of recipients) {
    const result = await createDirectoryRecipient(userId, recipient.name, recipient.values, "import");
    if (result.created) created += 1; else updated += 1;
  }
  return { created, updated };
}

export async function updateDirectoryRecipient(id: string, userId: number, name: string, values: DirectoryValues) {
  const db = await requireDb();
  const normalizedName = normalizeDirectoryName(name);
  const duplicate = await db.select({ id: recipientDirectory.id }).from(recipientDirectory).where(and(eq(recipientDirectory.userId, userId), eq(recipientDirectory.normalizedName, normalizedName))).limit(1);
  if (duplicate[0] && duplicate[0].id !== id) throw new Error("Un destinataire avec ce nom existe déjà dans votre base.");
  await db.update(recipientDirectory).set({ name, normalizedName, valuesJson: JSON.stringify(values), source: "manual" }).where(and(eq(recipientDirectory.id, id), eq(recipientDirectory.userId, userId)));
}

export async function deleteDirectoryRecipient(id: string, userId: number) {
  const db = await requireDb();
  await db.delete(recipientDirectory).where(and(eq(recipientDirectory.id, id), eq(recipientDirectory.userId, userId)));
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  return db;
}
