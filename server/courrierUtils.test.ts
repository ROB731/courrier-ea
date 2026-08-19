import { describe, expect, it } from "vitest";
import { cleanRecipientNames, isDocxFile, isXlsxFile, warningForRecipient } from "./courrierUtils";

describe("courrier utilities", () => {
  it("préserve les destinataires valides et ignore les lignes vides", () => {
    expect(cleanRecipientNames(["  VIGASSISTANCE ", "", "  ", "CFAO INFRASTRUCTURE"]))
      .toEqual([
        { name: "VIGASSISTANCE", warning: null },
        { name: "CFAO INFRASTRUCTURE", warning: null },
      ]);
  });

  it("signale les destinataires dont le nom est long", () => {
    expect(warningForRecipient("EF21 ENTREPRISE DE FOURNITURES ET INSTALLATION INDUSTRIELLES"))
      .toContain("Nom long");
  });

  it("vérifie les extensions attendues", () => {
    expect(isDocxFile("modele.DOCX")).toBe(true);
    expect(isDocxFile("modele.pdf")).toBe(false);
    expect(isXlsxFile("liste.xlsx")).toBe(true);
    expect(isXlsxFile("liste.csv")).toBe(false);
  });
});
