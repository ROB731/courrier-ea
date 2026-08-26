import { isAutoPreparationReady } from "./campaignAutoPreparation";
import { describe, expect, it } from "vitest";

describe("isAutoPreparationReady", () => {
  const completeInput = {
    templateId: "template-12345678",
    fields: ["DESTINATAIRE", "TELEPHONE"],
    headers: ["Entreprise", "Téléphone"],
    rowCount: 2,
    mappings: { DESTINATAIRE: "Entreprise" },
  };

  it("déclenche le contrôle dès que la colonne destinataire est reconnue", () => {
    expect(isAutoPreparationReady(completeInput)).toBe(true);
  });

  it("attend un modèle, une ligne et une correspondance obligatoire valide", () => {
    expect(isAutoPreparationReady({ ...completeInput, templateId: "" })).toBe(false);
    expect(isAutoPreparationReady({ ...completeInput, rowCount: 0 })).toBe(false);
    expect(isAutoPreparationReady({ ...completeInput, mappings: {} })).toBe(false);
    expect(isAutoPreparationReady({ ...completeInput, mappings: { DESTINATAIRE: "Colonne absente" } })).toBe(false);
  });
});
