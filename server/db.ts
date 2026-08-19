import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  campaignRecipients,
  campaigns,
  InsertCampaign,
  InsertLetterTemplate,
  InsertUser,
  letterTemplates,
  users,
} from "../drizzle/schema";
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

export async function createLetterTemplate(template: InsertLetterTemplate): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  await db.insert(letterTemplates).values(template);
}

export async function listLetterTemplatesForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  return db.select().from(letterTemplates).where(eq(letterTemplates.userId, userId)).orderBy(desc(letterTemplates.createdAt));
}

export async function getLetterTemplateForUser(templateId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const rows = await db.select().from(letterTemplates).where(and(eq(letterTemplates.id, templateId), eq(letterTemplates.userId, userId))).limit(1);
  return rows[0];
}

export async function createCampaign(campaign: InsertCampaign): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  await db.insert(campaigns).values(campaign);
}

export async function updateCampaign(campaignId: string, userId: number, values: Partial<InsertCampaign>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  await db.update(campaigns).set(values).where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
}

export async function listCampaignsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignForUser(campaignId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  const rows = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))).limit(1);
  return rows[0];
}

export async function createRecipients(campaignId: string, recipients: Array<{ name: string; warning: string | null; position: number }>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  if (recipients.length === 0) return;
  await db.insert(campaignRecipients).values(recipients.map(recipient => ({
    campaignId,
    name: recipient.name,
    warning: recipient.warning,
    position: recipient.position,
    status: "to_send" as const,
  })));
}

export async function listCampaignRecipients(campaignId: string) {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  return db.select().from(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId)).orderBy(asc(campaignRecipients.position));
}

export async function updateRecipientStatus(recipientId: number, campaignId: string, status: "to_send" | "sent"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("La base de données est indisponible.");
  await db.update(campaignRecipients).set({ status }).where(and(eq(campaignRecipients.id, recipientId), eq(campaignRecipients.campaignId, campaignId)));
}
