import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createCampaign: vi.fn(), createLetterTemplate: vi.fn(), createRecipients: vi.fn(), getCampaignForUser: vi.fn(), getLetterTemplateForUser: vi.fn(), listCampaignRecipients: vi.fn(), listCampaignsForUser: vi.fn(), listLetterTemplatesForUser: vi.fn(), listSentRecipientsForUser: vi.fn(), saveImportedDirectoryRecipients: vi.fn(), updateCampaign: vi.fn(), updateRecipientStatus: vi.fn(), storageGetSignedUrl: vi.fn(), storagePut: vi.fn(), mkdtemp: vi.fn(), readFile: vi.fn(), rm: vi.fn(), writeFile: vi.fn(), spawn: vi.fn(), nanoid: vi.fn(),
}));

vi.mock("./db", () => ({ createCampaign: mocks.createCampaign, createLetterTemplate: mocks.createLetterTemplate, createRecipients: mocks.createRecipients, getCampaignForUser: mocks.getCampaignForUser, getLetterTemplateForUser: mocks.getLetterTemplateForUser, listCampaignRecipients: mocks.listCampaignRecipients, listCampaignsForUser: mocks.listCampaignsForUser, listLetterTemplatesForUser: mocks.listLetterTemplatesForUser, listSentRecipientsForUser: mocks.listSentRecipientsForUser, saveImportedDirectoryRecipients: mocks.saveImportedDirectoryRecipients, updateCampaign: mocks.updateCampaign, updateRecipientStatus: mocks.updateRecipientStatus }));
vi.mock("./storage", () => ({ storageGetSignedUrl: mocks.storageGetSignedUrl, storagePut: mocks.storagePut }));
vi.mock("node:fs", () => ({ promises: { mkdtemp: mocks.mkdtemp, readFile: mocks.readFile, rm: mocks.rm, writeFile: mocks.writeFile } }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("nanoid", () => ({ nanoid: mocks.nanoid }));

import { courrierRouter } from "./routers/courrier";

const template = { id: "template-12345", userId: 7, name: "Courrier partenaires", originalFileName: "courrier.docx", fileKey: "models/courrier.docx", fileUrl: "/manus-storage/models/courrier.docx", placeholderCount: 1, fieldsJson: JSON.stringify(["DESTINATAIRE", "CONTACT", "TELEPHONE", "LOCALITE"]), createdAt: new Date() };
const sourceRows = [{ rowNumber: 2, values: { Société: "VIGASSISTANCE", Contact: "Awa Traoré", Téléphone: "+225 01 02 03 04 05", Ville: "Abidjan" } }];
const mappings = { DESTINATAIRE: "Société", CONTACT: "Contact", TELEPHONE: "Téléphone", LOCALITE: "Ville" };
const preparedRecipients = [{ sourceRow: 2, values: { DESTINATAIRE: "VIGASSISTANCE", CONTACT: "Awa Traoré", TELEPHONE: "+225 01 02 03 04 05", LOCALITE: "Abidjan" } }];

function createContext(): TrpcContext {
  return { user: { id: 7, openId: "courrier-user", name: "Utilisateur", email: "user@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function engineRespondsWith(payload: unknown, code = 0) {
  mocks.spawn.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    queueMicrotask(() => { if (code === 0) child.stdout.emit("data", Buffer.from(JSON.stringify(payload))); else child.stderr.emit("data", Buffer.from(JSON.stringify(payload))); child.emit("close", code); });
    return child as any;
  });
}

function validBase64() { return Buffer.from("test-file-content").toString("base64"); }

describe("courrierRouter multi-champs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mkdtemp.mockResolvedValue("/tmp/courrier-ea-tests"); mocks.rm.mockResolvedValue(undefined); mocks.writeFile.mockResolvedValue(undefined); mocks.readFile.mockResolvedValue(Buffer.from("generated-file")); mocks.storageGetSignedUrl.mockResolvedValue("https://storage.example/file"); mocks.storagePut.mockImplementation(async (key: string) => ({ key: `${key}-stored`, url: `/manus-storage/${key}-stored` })); mocks.createCampaign.mockResolvedValue(undefined); mocks.createLetterTemplate.mockResolvedValue(undefined); mocks.createRecipients.mockResolvedValue(undefined); mocks.listSentRecipientsForUser.mockResolvedValue([]); mocks.saveImportedDirectoryRecipients.mockResolvedValue({ created: 1, updated: 0 }); mocks.updateCampaign.mockResolvedValue(undefined); mocks.updateRecipientStatus.mockResolvedValue(undefined); mocks.nanoid.mockReturnValue("generated-id-12345");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(Buffer.from("template-bytes"), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuse un modèle qui n’est pas un document Word", async () => {
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.uploadTemplate({ fileName: "modele.pdf", contentBase64: validBase64() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuse un modèle sans le champ obligatoire DESTINATAIRE", async () => {
    engineRespondsWith({ valid: false, fields: ["CONTACT"], invalidFields: [] });
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.uploadTemplate({ fileName: "modele.docx", contentBase64: validBase64() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("stocke un modèle Word avec plusieurs champs détectés", async () => {
    engineRespondsWith({ valid: true, placeholderCount: 1, fields: ["DESTINATAIRE", "CONTACT", "TELEPHONE"], invalidFields: [] });
    const result = await courrierRouter.createCaller(createContext()).uploadTemplate({ fileName: "modele.docx", contentBase64: validBase64() });
    expect(result.fields).toEqual(["DESTINATAIRE", "CONTACT", "TELEPHONE"]);
    expect(mocks.createLetterTemplate).toHaveBeenCalledWith(expect.objectContaining({ fieldsJson: JSON.stringify(["DESTINATAIRE", "CONTACT", "TELEPHONE"]) }));
  });

  it("importe Excel avec les en-têtes et les lignes complètes", async () => {
    engineRespondsWith({ columnName: "Destinataire", headers: ["Destinataire", "Téléphone", "Localité"], rows: [{ rowNumber: 2, values: { Destinataire: "VIGASSISTANCE", Téléphone: "+225 01 02 03 04 05", Localité: "Abidjan" } }] });
    const result = await courrierRouter.createCaller(createContext()).importExcel({ fileName: "destinataires.xlsx", contentBase64: validBase64() });
    expect(result.headers).toContain("Téléphone");
    expect(result.rows).toHaveLength(1);
  });

  it("importe un tableau collé et le conserve comme source de campagne", async () => {
    engineRespondsWith({ columnName: "Destinataire", headers: ["Destinataire", "Téléphone"], rows: [{ rowNumber: 2, values: { Destinataire: "VIGASSISTANCE", Téléphone: "+225 01 02 03 04 05" } }] });
    const result = await courrierRouter.createCaller(createContext()).importPastedTable({ content: "Destinataire;Téléphone\nVIGASSISTANCE;+225 01 02 03 04 05" });
    expect(result.sourceType).toBe("paste");
    expect(mocks.storagePut).toHaveBeenCalledTimes(1);
  });

  it("prépare les destinataires à partir des correspondances validées", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    const result = await courrierRouter.createCaller(createContext()).prepareRecipients({ templateId: template.id, headers: Object.keys(sourceRows[0]!.values), rows: sourceRows, mappings });
    expect(result.validCount).toBe(1);
    expect(result.recipients[0]).toMatchObject({ name: "VIGASSISTANCE", values: { CONTACT: "Awa Traoré", LOCALITE: "Abidjan" } });
    expect(mocks.saveImportedDirectoryRecipients).toHaveBeenCalledWith(7, [expect.objectContaining({ name: "VIGASSISTANCE", values: expect.objectContaining({ TELEPHONE: "+225 01 02 03 04 05" }) })]);
  });

  it("exclut par défaut un destinataire dont l’envoi précédent est confirmé", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    mocks.listSentRecipientsForUser.mockResolvedValue([{ id: 28, campaignId: "campaign-old", campaignName: "Relance mai", sentAt: new Date("2026-05-18"), name: "VIGASSISTANCE", valuesJson: JSON.stringify({ DESTINATAIRE: "VIGASSISTANCE", TELEPHONE: "+225 01 02 03 04 05" }) }]);
    const result = await courrierRouter.createCaller(createContext()).prepareRecipients({ templateId: template.id, headers: Object.keys(sourceRows[0]!.values), rows: sourceRows, mappings });
    expect(result.recipients[0]).toMatchObject({ dedupeStatus: "sent_confirmed", includeInGeneration: false, matchedCampaignName: "Relance mai" });
  });

  it("contrôle et enregistre dans le répertoire un destinataire ajouté manuellement", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    const result = await courrierRouter.createCaller(createContext()).classifyManualRecipient({ templateId: template.id, sourceRow: 9, values: { DESTINATAIRE: "VISUEL CONCEPT", CONTACT: "Mme Kouassi", TELEPHONE: "+225 07 08 09 10 11", LOCALITE: "Abidjan" } });
    expect(result).toMatchObject({ name: "VISUEL CONCEPT", sourceRow: 9, dedupeStatus: "new", includeInGeneration: true });
    expect(mocks.saveImportedDirectoryRecipients).toHaveBeenCalledWith(7, [expect.objectContaining({ name: "VISUEL CONCEPT" })]);
  });

  it("refuse la préparation sans correspondance pour DESTINATAIRE", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    await expect(courrierRouter.createCaller(createContext()).prepareRecipients({ templateId: template.id, headers: Object.keys(sourceRows[0]!.values), rows: sourceRows, mappings: { CONTACT: "Contact" } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuse un aperçu quand le modèle n’appartient pas à l’utilisateur", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(undefined);
    await expect(courrierRouter.createCaller(createContext()).preview({ templateId: "unknown-template", values: { DESTINATAIRE: "VIGASSISTANCE" } })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("génère un aperçu Word et PDF avec toutes les valeurs de la ligne", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template); engineRespondsWith({ docx: "/tmp/apercu.docx", pdf: "/tmp/apercu.pdf", warnings: [] });
    const result = await courrierRouter.createCaller(createContext()).preview({ templateId: template.id, values: preparedRecipients[0]!.values });
    expect(result.pdfUrl).toContain("apercus");
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringContaining("valeurs.json"), expect.stringContaining("Awa Traoré"), "utf-8");
  });

  it("génère une campagne, enregistre les valeurs et publie les deux exports", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template); engineRespondsWith({ count: 1, zip: "/tmp/courriers.zip", pdf: "/tmp/courriers.pdf" });
    const result = await courrierRouter.createCaller(createContext()).createCampaign({ name: "Prospection août", templateId: template.id, sourceFileKey: "lists/contacts.xlsx", sourceFileUrl: "/manus-storage/lists/contacts.xlsx", sourceType: "excel", mappings, recipients: preparedRecipients });
    expect(result.count).toBe(1);
    expect(mocks.createRecipients).toHaveBeenCalledWith("generated-id-12345", [expect.objectContaining({ name: "VIGASSISTANCE", values: expect.objectContaining({ TELEPHONE: "+225 01 02 03 04 05" }) })]);
    expect(mocks.updateCampaign).toHaveBeenCalledWith("generated-id-12345", 7, expect.objectContaining({ status: "ready" }));
  });

  it("autorise la réintégration explicite d’un destinataire déjà envoyé", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    mocks.listSentRecipientsForUser.mockResolvedValue([{ id: 28, campaignId: "campaign-old", campaignName: "Relance mai", sentAt: new Date("2026-05-18"), name: "VIGASSISTANCE", valuesJson: JSON.stringify({ DESTINATAIRE: "VIGASSISTANCE" }) }]);
    engineRespondsWith({ count: 1, zip: "/tmp/courriers.zip", pdf: "/tmp/courriers.pdf" });
    await expect(courrierRouter.createCaller(createContext()).createCampaign({ name: "Exception autorisée", templateId: template.id, sourceFileKey: "lists/contacts.xlsx", sourceFileUrl: "/manus-storage/lists/contacts.xlsx", sourceType: "excel", mappings, recipients: [{ ...preparedRecipients[0]!, includeInGeneration: true }] })).resolves.toMatchObject({ count: 1 });
    expect(mocks.createRecipients).toHaveBeenCalledWith("generated-id-12345", [expect.objectContaining({ dedupeStatus: "sent_confirmed", includeInGeneration: true })]);
  });

  it("applique l’exclusion par défaut si un destinataire déjà envoyé n’est pas réintégré explicitement", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    mocks.listSentRecipientsForUser.mockResolvedValue([{ id: 28, campaignId: "campaign-old", campaignName: "Relance mai", sentAt: new Date("2026-05-18"), name: "VIGASSISTANCE", valuesJson: JSON.stringify({ DESTINATAIRE: "VIGASSISTANCE" }) }]);
    await expect(courrierRouter.createCaller(createContext()).createCampaign({ name: "Doublon exclu", templateId: template.id, sourceFileKey: "lists/contacts.xlsx", sourceFileUrl: "/manus-storage/lists/contacts.xlsx", sourceType: "excel", mappings, recipients: preparedRecipients })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it("enregistre un échec de génération dans l’historique", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template); engineRespondsWith({ error: "La conversion PDF a échoué." }, 1);
    await expect(courrierRouter.createCaller(createContext()).createCampaign({ name: "Campagne défaillante", templateId: template.id, sourceFileKey: "lists/contacts.xlsx", sourceFileUrl: "/manus-storage/lists/contacts.xlsx", sourceType: "excel", mappings, recipients: preparedRecipients })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.updateCampaign).toHaveBeenCalledWith("generated-id-12345", 7, expect.objectContaining({ status: "error" }));
  });

  it("met à jour le statut uniquement pour une campagne de l’utilisateur", async () => {
    mocks.getCampaignForUser.mockResolvedValue({ id: "campaign-12345", userId: 7 });
    await expect(courrierRouter.createCaller(createContext()).updateRecipientStatus({ campaignId: "campaign-12345", recipientId: 12, status: "sent" })).resolves.toEqual({ success: true });
  });

  it("refuse la mise à jour de statut d’une campagne absente ou non autorisée", async () => {
    mocks.getCampaignForUser.mockResolvedValue(undefined);
    await expect(courrierRouter.createCaller(createContext()).updateRecipientStatus({ campaignId: "campaign-inaccessible", recipientId: 12, status: "sent" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
