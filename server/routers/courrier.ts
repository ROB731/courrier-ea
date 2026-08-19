import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import {
  createCampaign,
  createLetterTemplate,
  createRecipients,
  getCampaignForUser,
  getLetterTemplateForUser,
  listCampaignRecipients,
  listCampaignsForUser,
  listLetterTemplatesForUser,
  saveImportedDirectoryRecipients,
  updateCampaign,
  updateRecipientStatus,
} from "../db";
import {
  FIELD_NAME_PATTERN,
  type MergeValues,
  parseTemplateFields,
  prepareRecipients,
  REQUIRED_FIELD,
  safeMergeValues,
  safeStorageSegment,
  warningsForValues,
  isDocxFile,
  isXlsxFile,
} from "../courrierUtils";
import { storageGetSignedUrl, storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const MAX_BASE64_LENGTH = 20_000_000;
const MAX_PASTED_TABLE_LENGTH = 500_000;
const documentInput = z.object({
  fileName: z.string().min(1).max(180),
  contentBase64: z.string().min(16).max(MAX_BASE64_LENGTH),
});
const valuesSchema = z.record(z.string().max(80), z.string().max(1000));
const sourceRowSchema = z.object({ rowNumber: z.number().int().positive(), values: valuesSchema });
const preparedRecipientSchema = z.object({
  sourceRow: z.number().int().positive(),
  values: valuesSchema,
});

type EngineResult = Record<string, unknown>;

function decodeUpload(contentBase64: string): Buffer {
  const normalized = contentBase64.includes(",") ? contentBase64.split(",").at(-1)! : contentBase64;
  const bytes = Buffer.from(normalized, "base64");
  if (!bytes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Le fichier importé est vide." });
  return bytes;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseStoredValues(value: string | null): MergeValues {
  try {
    const parsed = JSON.parse(value ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item ?? "")]));
    }
  } catch {
    // Les données de l’historique restent lisibles avec leur nom principal.
  }
  return {};
}

async function makeWorkingDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "courrier-ea-"));
}

async function downloadStorageFile(fileKey: string, destination: string): Promise<void> {
  const signedUrl = await storageGetSignedUrl(fileKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Impossible de récupérer le fichier depuis le stockage sécurisé.");
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function runEngine(command: string, args: string[]): Promise<EngineResult> {
  const script = path.resolve(process.cwd(), "scripts/courrier_engine.py");
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [script, command, ...args], { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error(stderr || "Le moteur documentaire a rencontré une erreur."));
      try { resolve(JSON.parse(stdout.trim()) as EngineResult); }
      catch { reject(new Error("Le moteur documentaire a renvoyé une réponse invalide.")); }
    });
  });
}

function ensureModelValidation(result: EngineResult) {
  if (result.valid !== true) {
    const invalidFields = asStringArray(result.invalidFields);
    const detail = invalidFields.length ? ` Champs invalides : ${invalidFields.join(", ")}.` : "";
    throw new TRPCError({ code: "BAD_REQUEST", message: `Le modèle doit contenir le champ obligatoire {{DESTINATAIRE}}.${detail}` });
  }
  const fields = asStringArray(result.fields).filter(field => FIELD_NAME_PATTERN.test(field));
  if (!fields.includes(REQUIRED_FIELD)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Le modèle doit contenir le champ obligatoire {{DESTINATAIRE}}." });
  }
  return fields;
}

function validateMappings(fields: string[], mappings: Record<string, string>, headers: string[]) {
  const availableHeaders = new Set(headers);
  if (!mappings[REQUIRED_FIELD] || !availableHeaders.has(mappings[REQUIRED_FIELD])) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Associez le champ obligatoire {{DESTINATAIRE}} à une colonne de données." });
  }
  for (const [field, header] of Object.entries(mappings)) {
    if (!fields.includes(field) || !availableHeaders.has(header)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Une correspondance de champ est invalide ou ne provient pas de la source importée." });
    }
  }
}

function validateRecipientValues(fields: string[], rawValues: Record<string, string>): MergeValues {
  const unknownFields = Object.keys(rawValues).map(field => field.trim().toUpperCase()).filter(field => !fields.includes(field));
  if (unknownFields.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Champ(s) non autorisé(s) pour ce modèle : ${unknownFields.join(", ")}.` });
  }
  const values = safeMergeValues(rawValues, fields);
  if (!values[REQUIRED_FIELD]) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Chaque courrier doit contenir une valeur pour {{DESTINATAIRE}}." });
  }
  return values;
}

export const courrierRouter = router({
  templates: protectedProcedure.query(async ({ ctx }) => {
    const templates = await listLetterTemplatesForUser(ctx.user.id);
    return templates.map(template => ({ ...template, fields: parseTemplateFields(template.fieldsJson) }));
  }),

  campaigns: protectedProcedure.query(({ ctx }) => listCampaignsForUser(ctx.user.id)),

  campaignDetail: protectedProcedure.input(z.object({ campaignId: z.string().min(8) })).query(async ({ ctx, input }) => {
    const campaign = await getCampaignForUser(input.campaignId, ctx.user.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campagne introuvable." });
    const recipients = await listCampaignRecipients(campaign.id);
    return {
      campaign: { ...campaign, mappings: parseStoredValues(campaign.mappingsJson) },
      recipients: recipients.map(recipient => ({ ...recipient, values: parseStoredValues(recipient.valuesJson) })),
    };
  }),

  uploadTemplate: protectedProcedure.input(documentInput).mutation(async ({ ctx, input }) => {
    if (!isDocxFile(input.fileName)) throw new TRPCError({ code: "BAD_REQUEST", message: "Importez un modèle Word au format .docx." });
    const workDir = await makeWorkingDirectory();
    try {
      const modelPath = path.join(workDir, "modele.docx");
      const content = decodeUpload(input.contentBase64);
      await fs.writeFile(modelPath, content);
      const inspection = await runEngine("inspect-model", ["--template", modelPath]);
      const fields = ensureModelValidation(inspection);
      const storage = await storagePut(`courrier-ea/${ctx.user.id}/modeles/${nanoid()}-${safeStorageSegment(input.fileName)}`, content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const id = nanoid();
      await createLetterTemplate({ id, userId: ctx.user.id, name: input.fileName.replace(/\.docx$/i, ""), originalFileName: input.fileName, fileKey: storage.key, fileUrl: storage.url, placeholderCount: Number(inspection.placeholderCount), fieldsJson: JSON.stringify(fields) });
      return { id, name: input.fileName.replace(/\.docx$/i, ""), fileUrl: storage.url, fields };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  importExcel: protectedProcedure.input(documentInput).mutation(async ({ ctx, input }) => {
    if (!isXlsxFile(input.fileName)) throw new TRPCError({ code: "BAD_REQUEST", message: "Importez une liste Excel au format .xlsx." });
    const workDir = await makeWorkingDirectory();
    try {
      const sourcePath = path.join(workDir, "destinataires.xlsx");
      const content = decodeUpload(input.contentBase64);
      await fs.writeFile(sourcePath, content);
      const inspection = await runEngine("inspect-excel", ["--excel", sourcePath]);
      const storage = await storagePut(`courrier-ea/${ctx.user.id}/listes/${nanoid()}-${safeStorageSegment(input.fileName)}`, content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return { fileKey: storage.key, fileUrl: storage.url, sourceType: "excel" as const, columnName: String(inspection.columnName), headers: asStringArray(inspection.headers), rows: Array.isArray(inspection.rows) ? inspection.rows : [] };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  importPastedTable: protectedProcedure.input(z.object({ content: z.string().min(10).max(MAX_PASTED_TABLE_LENGTH) })).mutation(async ({ ctx, input }) => {
    const workDir = await makeWorkingDirectory();
    try {
      const sourcePath = path.join(workDir, "table-collee.txt");
      await fs.writeFile(sourcePath, input.content, "utf-8");
      const inspection = await runEngine("inspect-table", ["--table", sourcePath]);
      const storage = await storagePut(`courrier-ea/${ctx.user.id}/listes/${nanoid()}-table-collee.txt`, Buffer.from(input.content, "utf-8"), "text/plain; charset=utf-8");
      return { fileKey: storage.key, fileUrl: storage.url, sourceType: "paste" as const, columnName: String(inspection.columnName), headers: asStringArray(inspection.headers), rows: Array.isArray(inspection.rows) ? inspection.rows : [] };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  prepareRecipients: protectedProcedure.input(z.object({
    templateId: z.string().min(8),
    headers: z.array(z.string().min(1).max(160)).min(1).max(80),
    rows: z.array(sourceRowSchema).min(1).max(500),
    mappings: z.record(z.string().regex(FIELD_NAME_PATTERN), z.string().min(1).max(160)),
  })).mutation(async ({ ctx, input }) => {
    const template = await getLetterTemplateForUser(input.templateId, ctx.user.id);
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Modèle introuvable." });
    const fields = parseTemplateFields(template.fieldsJson);
    validateMappings(fields, input.mappings, input.headers);
    const recipients = prepareRecipients(fields, input.rows, input.mappings);
    const validRecipients = recipients.filter(recipient => recipient.issues.length === 0);
    const directory = await saveImportedDirectoryRecipients(ctx.user.id, validRecipients.map(recipient => ({ name: recipient.name, values: recipient.values })));
    return { fields, recipients, validCount: validRecipients.length, invalidCount: recipients.filter(recipient => recipient.issues.length > 0).length, directory };
  }),

  preview: protectedProcedure.input(z.object({ templateId: z.string().min(8), values: valuesSchema })).mutation(async ({ ctx, input }) => {
    const template = await getLetterTemplateForUser(input.templateId, ctx.user.id);
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Modèle introuvable." });
    const fields = parseTemplateFields(template.fieldsJson);
    const values = validateRecipientValues(fields, input.values);
    const workDir = await makeWorkingDirectory();
    try {
      const modelPath = path.join(workDir, "modele.docx");
      const valuesPath = path.join(workDir, "valeurs.json");
      const outputDocx = path.join(workDir, "apercu.docx");
      const outputPdf = path.join(workDir, "apercu.pdf");
      await downloadStorageFile(template.fileKey, modelPath);
      await fs.writeFile(valuesPath, JSON.stringify(values), "utf-8");
      const result = await runEngine("preview", ["--template", modelPath, "--values-json", valuesPath, "--output-docx", outputDocx, "--output-pdf", outputPdf]);
      const [docx, pdf] = await Promise.all([fs.readFile(outputDocx), fs.readFile(outputPdf)]);
      const previewId = nanoid();
      const [wordFile, pdfFile] = await Promise.all([
        storagePut(`courrier-ea/${ctx.user.id}/apercus/${previewId}.docx`, docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        storagePut(`courrier-ea/${ctx.user.id}/apercus/${previewId}.pdf`, pdf, "application/pdf"),
      ]);
      return { wordUrl: wordFile.url, pdfUrl: pdfFile.url, warnings: asStringArray(result.warnings) };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  createCampaign: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(120),
    templateId: z.string().min(8),
    sourceFileKey: z.string().min(4),
    sourceFileUrl: z.string().min(4),
    sourceType: z.enum(["excel", "paste", "directory"]),
    mappings: z.record(z.string().regex(FIELD_NAME_PATTERN), z.string().min(1).max(160)),
    recipients: z.array(preparedRecipientSchema).min(1).max(500),
  })).mutation(async ({ ctx, input }) => {
    const template = await getLetterTemplateForUser(input.templateId, ctx.user.id);
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Le modèle sélectionné est introuvable." });
    const fields = parseTemplateFields(template.fieldsJson);
    const recipients = input.recipients.map(recipient => {
      const values = validateRecipientValues(fields, recipient.values);
      const warnings = warningsForValues(values);
      return { sourceRow: recipient.sourceRow, name: values[REQUIRED_FIELD], values, warning: warnings.length ? warnings.join(" ") : null };
    });
    const campaignId = nanoid();
    await createCampaign({ id: campaignId, userId: ctx.user.id, templateId: template.id, name: input.name, excelFileKey: input.sourceFileKey, excelFileUrl: input.sourceFileUrl, dataSourceType: input.sourceType, mappingsJson: JSON.stringify(input.mappings), recipientCount: recipients.length, status: "generating" });
    await createRecipients(campaignId, recipients.map((recipient, index) => ({ ...recipient, position: index + 1 })));
    const workDir = await makeWorkingDirectory();
    try {
      const modelPath = path.join(workDir, "modele.docx");
      const recipientsPath = path.join(workDir, "destinataires.json");
      const outputDir = path.join(workDir, "lettres");
      const zipPath = path.join(workDir, "courriers.zip");
      const pdfPath = path.join(workDir, "courriers.pdf");
      await downloadStorageFile(template.fileKey, modelPath);
      await fs.writeFile(recipientsPath, JSON.stringify(recipients), "utf-8");
      const generation = await runEngine("generate", ["--template", modelPath, "--recipients-json", recipientsPath, "--output-dir", outputDir, "--zip-output", zipPath, "--pdf-output", pdfPath]);
      const [zip, pdf] = await Promise.all([fs.readFile(zipPath), fs.readFile(pdfPath)]);
      const dateSegment = new Date().toISOString().slice(0, 10);
      const [zipFile, pdfFile] = await Promise.all([
        storagePut(`courrier-ea/${ctx.user.id}/campagnes/${campaignId}/courriers-${dateSegment}.zip`, zip, "application/zip"),
        storagePut(`courrier-ea/${ctx.user.id}/campagnes/${campaignId}/courriers-${dateSegment}.pdf`, pdf, "application/pdf"),
      ]);
      await updateCampaign(campaignId, ctx.user.id, { status: "ready", zipFileKey: zipFile.key, zipFileUrl: zipFile.url, pdfFileKey: pdfFile.key, pdfFileUrl: pdfFile.url, errorMessage: null });
      return { campaignId, count: Number(generation.count), zipUrl: zipFile.url, pdfUrl: pdfFile.url };
    } catch (error) {
      await updateCampaign(campaignId, ctx.user.id, { status: "error", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Erreur inconnue lors de la génération." });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La campagne a été créée mais la génération a échoué. Consultez l’historique pour le détail." });
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  updateRecipientStatus: protectedProcedure.input(z.object({ campaignId: z.string().min(8), recipientId: z.number().int().positive(), status: z.enum(["to_send", "sent"]) })).mutation(async ({ ctx, input }) => {
    const campaign = await getCampaignForUser(input.campaignId, ctx.user.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campagne introuvable." });
    await updateRecipientStatus(input.recipientId, campaign.id, input.status);
    return { success: true };
  }),
});
