import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createDirectoryRecipient: vi.fn(),
  deleteDirectoryRecipient: vi.fn(),
  getDirectoryRecipientForUser: vi.fn(),
  listDirectoryRecipients: vi.fn(),
  updateDirectoryRecipient: vi.fn(),
}));

vi.mock("./db", () => ({
  createDirectoryRecipient: mocks.createDirectoryRecipient,
  deleteDirectoryRecipient: mocks.deleteDirectoryRecipient,
  getDirectoryRecipientForUser: mocks.getDirectoryRecipientForUser,
  listDirectoryRecipients: mocks.listDirectoryRecipients,
  updateDirectoryRecipient: mocks.updateDirectoryRecipient,
}));

import { recipientsRouter } from "./routers/recipients";

function createContext(): TrpcContext {
  return {
    user: { id: 7, openId: "directory-user", name: "Utilisateur", email: "user@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const directoryRow = { id: "recipient-12345", userId: 7, name: "VIGASSISTANCE", normalizedName: "VIGASSISTANCE", valuesJson: JSON.stringify({ DESTINATAIRE: "VIGASSISTANCE", CONTACT: "Awa Traoré", TELEPHONE: "+225 01 02 03 04 05" }), source: "import" as const, createdAt: new Date(), updatedAt: new Date() };

describe("recipientsRouter", () => {
  it("liste uniquement les fiches retournées pour l’utilisateur et expose leurs valeurs", async () => {
    mocks.listDirectoryRecipients.mockResolvedValue([directoryRow]);
    const result = await recipientsRouter.createCaller(createContext()).list({ query: "viga" });
    expect(mocks.listDirectoryRecipients).toHaveBeenCalledWith(7, "viga");
    expect(result[0]).toMatchObject({ name: "VIGASSISTANCE", values: { CONTACT: "Awa Traoré" } });
  });

  it("crée une fiche manuelle et force le destinataire à être le nom de la fiche", async () => {
    mocks.createDirectoryRecipient.mockResolvedValue({ id: "recipient-new", created: true });
    const result = await recipientsRouter.createCaller(createContext()).create({ name: "  CFAO INFRASTRUCTURE ", values: { telephone: "+225 05 06 07 08 09", localite: "Abidjan" } });
    expect(mocks.createDirectoryRecipient).toHaveBeenCalledWith(7, "CFAO INFRASTRUCTURE", expect.objectContaining({ DESTINATAIRE: "CFAO INFRASTRUCTURE", TELEPHONE: "+225 05 06 07 08 09", LOCALITE: "Abidjan" }), "manual");
    expect(result.created).toBe(true);
  });

  it("refuse la modification d’une fiche absente ou non autorisée", async () => {
    mocks.getDirectoryRecipientForUser.mockResolvedValue(undefined);
    await expect(recipientsRouter.createCaller(createContext()).update({ id: "recipient-unknown", name: "Nouveau", values: {} })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.updateDirectoryRecipient).not.toHaveBeenCalled();
  });

  it("retourne un conflit lorsqu’une modification crée un doublon", async () => {
    mocks.getDirectoryRecipientForUser.mockResolvedValue(directoryRow);
    mocks.updateDirectoryRecipient.mockRejectedValue(new Error("Un destinataire avec ce nom existe déjà dans votre base."));
    await expect(recipientsRouter.createCaller(createContext()).update({ id: directoryRow.id, name: "CFAO", values: {} })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("supprime une fiche uniquement après confirmation de son appartenance à l’utilisateur", async () => {
    mocks.getDirectoryRecipientForUser.mockResolvedValue(directoryRow);
    mocks.deleteDirectoryRecipient.mockResolvedValue(undefined);
    await expect(recipientsRouter.createCaller(createContext()).remove({ id: directoryRow.id })).resolves.toEqual({ success: true });
    expect(mocks.deleteDirectoryRecipient).toHaveBeenCalledWith(directoryRow.id, 7);
  });
});
