import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
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
  updateCampaign,
  updateRecipientStatus,
} from "../db";
import { isDocxFile, isXlsxFile, safeStorageSegment, warningForRecipient } from "../courrierUtils";
import { storageGetSignedUrl, storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const MAX_BASE64_LENGTH = 20_000_000;
const documentInput = z.object({
  fileName: z.string().min(1).max(180),
  contentBase64: z.string().min(16).max(MAX_BASE64_LENGTH),
});

type EngineResult = Record<string, unknown>;

function decodeUpload(contentBase64: string): Buffer {
  const normalized = contentBase64.includes(",") ? contentBase64.split(",").at(-1)! : contentBase64;
  const bytes = Buffer.from(normalized, "base64");
  if (!bytes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Le fichier importé est vide." });
  return bytes;
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
      if (code !== 0) {
        reject(new Error(stderr || "Le moteur documentaire a rencontré une erreur."));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()) as EngineResult);
      } catch {
        reject(new Error("Le moteur documentaire a renvoyé une réponse invalide."));
      }
    });
  });
}

function ensureModelValidation(result: EngineResult) {
  if (result.valid !== true) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Le modèle doit contenir une seule occurrence du champ {{DESTINATAIRE}}. Occurrences détectées : ${String(result.placeholderCount ?? 0)}.`,
    });
  }
}

export const courrierRouter = router({
  templates: protectedProcedure.query(({ ctx }) => listLetterTemplatesForUser(ctx.user.id)),

  campaigns: protectedProcedure.query(({ ctx }) => listCampaignsForUser(ctx.user.id)),

  campaignDetail: protectedProcedure.input(z.object({ campaignId: z.string().min(8) })).query(async ({ ctx, input }) => {
    const campaign = await getCampaignForUser(input.campaignId, ctx.user.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campagne introuvable." });
    const recipients = await listCampaignRecipients(campaign.id);
    return { campaign, recipients };
  }),

  uploadTemplate: protectedProcedure.input(documentInput).mutation(async ({ ctx, input }) => {
    if (!isDocxFile(input.fileName)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Importez un modèle Word au format .docx." });
    }
    const workDir = await makeWorkingDirectory();
    try {
      const modelPath = path.join(workDir, "modele.docx");
      const content = decodeUpload(input.contentBase64);
      await fs.writeFile(modelPath, content);
      const inspection = await runEngine("inspect-model", ["--template", modelPath]);
      ensureModelValidation(inspection);
      const storage = await storagePut(
        `courrier-ea/${ctx.user.id}/modeles/${nanoid()}-${safeStorageSegment(input.fileName)}`,
        content,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      const id = nanoid();
      await createLetterTemplate({
        id,
        userId: ctx.user.id,
        name: input.fileName.replace(/\.docx$/i, ""),
        originalFileName: input.fileName,
        fileKey: storage.key,
        fileUrl: storage.url,
        placeholderCount: Number(inspection.placeholderCount),
      });
      return { id, name: input.fileName.replace(/\.docx$/i, ""), fileUrl: storage.url };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  importExcel: protectedProcedure.input(documentInput).mutation(async ({ ctx, input }) => {
    if (!isXlsxFile(input.fileName)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Importez une liste Excel au format .xlsx." });
    }
    const workDir = await makeWorkingDirectory();
    try {
      const excelPath = path.join(workDir, "destinataires.xlsx");
      const content = decodeUpload(input.contentBase64);
      await fs.writeFile(excelPath, content);
      const inspection = await runEngine("inspect-excel", ["--excel", excelPath]);
      const rawRecipients = Array.isArray(inspection.recipients) ? inspection.recipients : [];
      const recipients = rawRecipients.map((item: any) => ({
        name: String(item.name),
        warning: item.warning ? String(item.warning) : warningForRecipient(String(item.name)),
      }));
      const storage = await storagePut(
        `courrier-ea/${ctx.user.id}/listes/${nanoid()}-${safeStorageSegment(input.fileName)}`,
        content,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      return {
        fileKey: storage.key,
        fileUrl: storage.url,
        columnName: String(inspection.columnName),
        recipients,
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  preview: protectedProcedure.input(z.object({ templateId: z.string().min(8), recipientName: z.string().trim().min(1).max(300) })).mutation(async ({ ctx, input }) => {
    const template = await getLetterTemplateForUser(input.templateId, ctx.user.id);
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Modèle introuvable." });
    const workDir = await makeWorkingDirectory();
    try {
      const modelPath = path.join(workDir, "modele.docx");
      const outputDocx = path.join(workDir, "apercu.docx");
      const outputPdf = path.join(workDir, "apercu.pdf");
      await downloadStorageFile(template.fileKey, modelPath);
      await runEngine("preview", ["--template", modelPath, "--recipient", input.recipientName, "--output-docx", outputDocx, "--output-pdf", outputPdf]);
      const [docx, pdf] = await Promise.all([
        fs.readFile(outputDocx),
        fs.readFile(outputPdf),
      ]);
      const previewId = nanoid();
      const [wordFile, pdfFile] = await Promise.all([
        storagePut(`courrier-ea/${ctx.user.id}/apercus/${previewId}.docx`, docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        storagePut(`courrier-ea/${ctx.user.id}/apercus/${previewId}.pdf`, pdf, "application/pdf"),
      ]);
      return { wordUrl: wordFile.url, pdfUrl: pdfFile.url, warning: warningForRecipient(input.recipientName) };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  createCampaign: protectedProcedure.input(z.object({
    name: z.string().trim().min(2).max(120),
    templateId: z.string().min(8),
    excelFileKey: z.string().min(4),
    excelFileUrl: z.string().min(4),
    recipients: z.array(z.object({ name: z.string().trim().min(1).max(300), warning: z.string().nullable().optional() })).min(1).max(100),
  })).mutation(async ({ ctx, input }) => {
    const template = await getLetterTemplateForUser(input.templateId, ctx.user.id);
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Le modèle sélectionné est introuvable." });
    const campaignId = nanoid();
    await createCampaign({
      id: campaignId,
      userId: ctx.user.id,
      templateId: template.id,
      name: input.name,
      excelFileKey: input.excelFileKey,
      excelFileUrl: input.excelFileUrl,
      recipientCount: input.recipients.length,
      status: "generating",
    });
    await createRecipients(campaignId, input.recipients.map((recipient, index) => ({
      name: recipient.name,
      warning: recipient.warning ?? warningForRecipient(recipient.name),
      position: index + 1,
    })));
    const workDir = await makeWorkingDirectory();
    try {
      const modelPath = path.join(workDir, "modele.docx");
      const recipientsPath = path.join(workDir, "destinataires.json");
      const outputDir = path.join(workDir, "lettres");
      const zipPath = path.join(workDir, "courriers.zip");
      const pdfPath = path.join(workDir, "courriers.pdf");
      await downloadStorageFile(template.fileKey, modelPath);
      await fs.writeFile(recipientsPath, JSON.stringify(input.recipients), "utf-8");
      const generation = await runEngine("generate", [
        "--template", modelPath,
        "--recipients-json", recipientsPath,
        "--output-dir", outputDir,
        "--zip-output", zipPath,
        "--pdf-output", pdfPath,
      ]);
      const [zip, pdf] = await Promise.all([fs.readFile(zipPath), fs.readFile(pdfPath)]);
      const dateSegment = new Date().toISOString().slice(0, 10);
      const [zipFile, pdfFile] = await Promise.all([
        storagePut(`courrier-ea/${ctx.user.id}/campagnes/${campaignId}/courriers-${dateSegment}.zip`, zip, "application/zip"),
        storagePut(`courrier-ea/${ctx.user.id}/campagnes/${campaignId}/courriers-${dateSegment}.pdf`, pdf, "application/pdf"),
      ]);
      await updateCampaign(campaignId, ctx.user.id, {
        status: "ready",
        zipFileKey: zipFile.key,
        zipFileUrl: zipFile.url,
        pdfFileKey: pdfFile.key,
        pdfFileUrl: pdfFile.url,
        errorMessage: null,
      });
      return { campaignId, count: Number(generation.count), zipUrl: zipFile.url, pdfUrl: pdfFile.url };
    } catch (error) {
      await updateCampaign(campaignId, ctx.user.id, {
        status: "error",
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Erreur inconnue lors de la génération.",
      });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La campagne a été créée mais la génération a échoué. Consultez l’historique pour le détail." });
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }),

  updateRecipientStatus: protectedProcedure.input(z.object({
    campaignId: z.string().min(8),
    recipientId: z.number().int().positive(),
    status: z.enum(["to_send", "sent"]),
  })).mutation(async ({ ctx, input }) => {
    const campaign = await getCampaignForUser(input.campaignId, ctx.user.id);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campagne introuvable." });
    await updateRecipientStatus(input.recipientId, campaign.id, input.status);
    return { success: true };
  }),
});
