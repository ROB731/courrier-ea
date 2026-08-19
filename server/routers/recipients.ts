import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createDirectoryRecipient,
  deleteDirectoryRecipient,
  getDirectoryRecipientForUser,
  listDirectoryRecipients,
  updateDirectoryRecipient,
} from "../db";
import { normalizeFieldName, REQUIRED_FIELD, safeMergeValues } from "../courrierUtils";
import { protectedProcedure, router } from "../_core/trpc";

const valuesSchema = z.record(z.string().min(1).max(80), z.string().max(1000));
const recipientInput = z.object({ name: z.string().trim().min(2).max(350), values: valuesSchema });

function normalizeValues(name: string, rawValues: Record<string, string>) {
  const entries = Object.entries(rawValues).map(([field, value]) => [normalizeFieldName(field), value] as const).filter(([field]) => field);
  const fields = Array.from(new Set([REQUIRED_FIELD, ...entries.map(([field]) => field)]));
  return safeMergeValues({ ...Object.fromEntries(entries), [REQUIRED_FIELD]: name }, fields);
}

function parseValues(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return Object.fromEntries(Object.entries(parsed).map(([field, item]) => [field, String(item ?? "")]));
  } catch { /* Les anciennes lignes restent néanmoins consultables. */ }
  return {};
}

export const recipientsRouter = router({
  list: protectedProcedure.input(z.object({ query: z.string().trim().max(100).optional() }).optional()).query(async ({ ctx, input }) => {
    const rows = await listDirectoryRecipients(ctx.user.id, input?.query);
    return rows.map(row => ({ ...row, values: parseValues(row.valuesJson) }));
  }),

  create: protectedProcedure.input(recipientInput).mutation(async ({ ctx, input }) => {
    const values = normalizeValues(input.name, input.values);
    const result = await createDirectoryRecipient(ctx.user.id, input.name, values, "manual");
    return { ...result, values };
  }),

  update: protectedProcedure.input(recipientInput.extend({ id: z.string().min(8) })).mutation(async ({ ctx, input }) => {
    const current = await getDirectoryRecipientForUser(input.id, ctx.user.id);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Destinataire introuvable." });
    const values = normalizeValues(input.name, input.values);
    try { await updateDirectoryRecipient(input.id, ctx.user.id, input.name, values); }
    catch (error) { throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "Un destinataire équivalent existe déjà." }); }
    return { success: true, values };
  }),

  remove: protectedProcedure.input(z.object({ id: z.string().min(8) })).mutation(async ({ ctx, input }) => {
    const current = await getDirectoryRecipientForUser(input.id, ctx.user.id);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Destinataire introuvable." });
    await deleteDirectoryRecipient(input.id, ctx.user.id);
    return { success: true };
  }),
});
