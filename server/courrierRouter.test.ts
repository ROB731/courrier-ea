import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createCampaign: vi.fn(),
  createLetterTemplate: vi.fn(),
  createRecipients: vi.fn(),
  getCampaignForUser: vi.fn(),
  getLetterTemplateForUser: vi.fn(),
  listCampaignRecipients: vi.fn(),
  listCampaignsForUser: vi.fn(),
  listLetterTemplatesForUser: vi.fn(),
  updateCampaign: vi.fn(),
  updateRecipientStatus: vi.fn(),
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
  mkdtemp: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
  spawn: vi.fn(),
  nanoid: vi.fn(),
}));

vi.mock("./db", () => ({
  createCampaign: mocks.createCampaign,
  createLetterTemplate: mocks.createLetterTemplate,
  createRecipients: mocks.createRecipients,
  getCampaignForUser: mocks.getCampaignForUser,
  getLetterTemplateForUser: mocks.getLetterTemplateForUser,
  listCampaignRecipients: mocks.listCampaignRecipients,
  listCampaignsForUser: mocks.listCampaignsForUser,
  listLetterTemplatesForUser: mocks.listLetterTemplatesForUser,
  updateCampaign: mocks.updateCampaign,
  updateRecipientStatus: mocks.updateRecipientStatus,
}));

vi.mock("./storage", () => ({
  storageGetSignedUrl: mocks.storageGetSignedUrl,
  storagePut: mocks.storagePut,
}));

vi.mock("node:fs", () => ({
  promises: {
    mkdtemp: mocks.mkdtemp,
    readFile: mocks.readFile,
    rm: mocks.rm,
    writeFile: mocks.writeFile,
  },
}));

vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("nanoid", () => ({ nanoid: mocks.nanoid }));

import { courrierRouter } from "./routers/courrier";

const template = {
  id: "template-12345",
  userId: 7,
  name: "Courrier partenaires",
  originalFileName: "courrier.docx",
  fileKey: "models/courrier.docx",
  fileUrl: "/manus-storage/models/courrier.docx",
  placeholderCount: 1,
  createdAt: new Date(),
};

function createContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "courrier-user",
      name: "Utilisateur",
      email: "user@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function engineRespondsWith(payload: unknown, code = 0) {
  mocks.spawn.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      if (code === 0) child.stdout.emit("data", Buffer.from(JSON.stringify(payload)));
      else child.stderr.emit("data", Buffer.from(JSON.stringify(payload)));
      child.emit("close", code);
    });
    return child as any;
  });
}

function validBase64() {
  return Buffer.from("test-file-content").toString("base64");
}

describe("courrierRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mkdtemp.mockResolvedValue("/tmp/courrier-ea-tests");
    mocks.rm.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.readFile.mockResolvedValue(Buffer.from("generated-file"));
    mocks.storageGetSignedUrl.mockResolvedValue("https://storage.example/file");
    mocks.storagePut.mockImplementation(async (key: string) => ({ key: `${key}-stored`, url: `/manus-storage/${key}-stored` }));
    mocks.createCampaign.mockResolvedValue(undefined);
    mocks.createLetterTemplate.mockResolvedValue(undefined);
    mocks.createRecipients.mockResolvedValue(undefined);
    mocks.updateCampaign.mockResolvedValue(undefined);
    mocks.updateRecipientStatus.mockResolvedValue(undefined);
    mocks.nanoid.mockReturnValue("generated-id-12345");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(Buffer.from("template-bytes"), { status: 200 })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("refuse un modèle qui n’est pas un document Word", async () => {
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.uploadTemplate({ fileName: "modele.pdf", contentBase64: validBase64() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("refuse un modèle avec plusieurs champs de fusion", async () => {
    engineRespondsWith({ valid: false, placeholderCount: 2 });
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.uploadTemplate({ fileName: "modele.docx", contentBase64: validBase64() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createLetterTemplate).not.toHaveBeenCalled();
  });

  it("stocke un modèle Word validé et son contrôle de champ", async () => {
    engineRespondsWith({ valid: true, placeholderCount: 1 });
    const caller = courrierRouter.createCaller(createContext());
    const result = await caller.uploadTemplate({ fileName: "modele.docx", contentBase64: validBase64() });
    expect(result.id).toBe("generated-id-12345");
    expect(mocks.createLetterTemplate).toHaveBeenCalledWith(expect.objectContaining({ placeholderCount: 1, userId: 7 }));
    expect(mocks.storagePut).toHaveBeenCalledTimes(1);
  });

  it("refuse un fichier de destinataires qui n’est pas Excel", async () => {
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.importExcel({ fileName: "contacts.csv", contentBase64: validBase64() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("importe les destinataires identifiés par le moteur Excel", async () => {
    engineRespondsWith({
      columnName: "Destinataire",
      recipients: [{ name: "VIGASSISTANCE", warning: null }, { name: "NEXANS COTE D’IVOIRE / YOPHZ R31", warning: "Nom long : vérifiez l’aperçu, un retour à la ligne peut être nécessaire." }],
    });
    const caller = courrierRouter.createCaller(createContext());
    const result = await caller.importExcel({ fileName: "destinataires.xlsx", contentBase64: validBase64() });
    expect(result.columnName).toBe("Destinataire");
    expect(result.recipients).toHaveLength(2);
    expect(mocks.storagePut).toHaveBeenCalledTimes(1);
  });

  it("retourne une erreur si l’analyse Excel échoue, notamment sans colonne Destinataire", async () => {
    engineRespondsWith({ error: "Aucune colonne « Destinataire » n’a été trouvée." }, 1);
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.importExcel({ fileName: "contacts.xlsx", contentBase64: validBase64() })).rejects.toThrow("Aucune colonne");
  });

  it("refuse un aperçu quand le modèle n’appartient pas à l’utilisateur", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(undefined);
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.preview({ templateId: "unknown-template", recipientName: "VIGASSISTANCE" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("génère un aperçu PDF et Word à partir d’un modèle autorisé", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    engineRespondsWith({ docx: "/tmp/apercu.docx", pdf: "/tmp/apercu.pdf" });
    const caller = courrierRouter.createCaller(createContext());
    const result = await caller.preview({ templateId: template.id, recipientName: "VIGASSISTANCE" });
    expect(result.pdfUrl).toContain("apercus");
    expect(mocks.storagePut).toHaveBeenCalledTimes(2);
  });

  it("génère une campagne, enregistre les destinataires et publie les deux exports", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    engineRespondsWith({ count: 1, zip: "/tmp/courriers.zip", pdf: "/tmp/courriers.pdf" });
    const caller = courrierRouter.createCaller(createContext());
    const result = await caller.createCampaign({
      name: "Prospection août",
      templateId: template.id,
      excelFileKey: "lists/contacts.xlsx",
      excelFileUrl: "/manus-storage/lists/contacts.xlsx",
      recipients: [{ name: "VIGASSISTANCE", warning: null }],
    });
    expect(result.count).toBe(1);
    expect(mocks.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ status: "generating" }));
    expect(mocks.createRecipients).toHaveBeenCalledWith("generated-id-12345", expect.any(Array));
    expect(mocks.updateCampaign).toHaveBeenCalledWith("generated-id-12345", 7, expect.objectContaining({ status: "ready" }));
  });

  it("enregistre un échec de génération dans l’historique", async () => {
    mocks.getLetterTemplateForUser.mockResolvedValue(template);
    engineRespondsWith({ error: "La conversion PDF a échoué." }, 1);
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.createCampaign({
      name: "Campagne défaillante",
      templateId: template.id,
      excelFileKey: "lists/contacts.xlsx",
      excelFileUrl: "/manus-storage/lists/contacts.xlsx",
      recipients: [{ name: "VIGASSISTANCE", warning: null }],
    })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.updateCampaign).toHaveBeenCalledWith("generated-id-12345", 7, expect.objectContaining({ status: "error" }));
  });

  it("met à jour le statut uniquement pour une campagne de l’utilisateur", async () => {
    mocks.getCampaignForUser.mockResolvedValue({ id: "campaign-12345", userId: 7 });
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.updateRecipientStatus({ campaignId: "campaign-12345", recipientId: 12, status: "sent" })).resolves.toEqual({ success: true });
    expect(mocks.updateRecipientStatus).toHaveBeenCalledWith(12, "campaign-12345", "sent");
  });

  it("refuse la mise à jour de statut d’une campagne absente ou non autorisée", async () => {
    mocks.getCampaignForUser.mockResolvedValue(undefined);
    const caller = courrierRouter.createCaller(createContext());
    await expect(caller.updateRecipientStatus({ campaignId: "campaign-inaccessible", recipientId: 12, status: "sent" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.updateRecipientStatus).not.toHaveBeenCalled();
  });
});
