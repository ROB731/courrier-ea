import { describe, expect, it, vi } from "vitest";
import { buildRecipientCsv, buildRecipientPrintHtml, buildRecipientRows, printRecipientList } from "./recipientListExport";

const recipients = [
  { sourceRow: 2, name: "Entreprise A", values: { DESTINATAIRE: "Entreprise A", TELEPHONE: "+225 01 02" } },
  { sourceRow: 3, name: "Entreprise B", values: { DESTINATAIRE: "Entreprise B", TELEPHONE: "+225 03 04" } },
];

describe("recipientListExport", () => {
  it("crée un CSV avec les champs filtrés et les valeurs des destinataires", () => {
    expect(buildRecipientCsv(recipients, ["DESTINATAIRE", "TELEPHONE"])).toContain('"Ligne";"DESTINATAIRE";"TELEPHONE"\n"2";"Entreprise A";"+225 01 02"');
  });

  it("prépare les lignes attendues pour le fichier Excel", () => {
    expect(buildRecipientRows(recipients, ["DESTINATAIRE", "TELEPHONE"])).toEqual([
      { Ligne: 2, DESTINATAIRE: "Entreprise A", TELEPHONE: "+225 01 02" },
      { Ligne: 3, DESTINATAIRE: "Entreprise B", TELEPHONE: "+225 03 04" },
    ]);
  });

  it("prépare une page imprimable avec le nombre et les destinataires sélectionnés", () => {
    const html = buildRecipientPrintHtml(recipients, ["DESTINATAIRE", "TELEPHONE"], "Nouveaux destinataires");
    expect(html).toContain("2 destinataires sélectionnés");
    expect(html).toContain("Entreprise B");
  });

  it("ouvre une fenêtre et lance l’impression de la liste", () => {
    const print = vi.fn();
    const write = vi.fn();
    const close = vi.fn();
    const focus = vi.fn();
    const popup = { opener: {}, document: { write, close }, focus, print } as unknown as Window;
    expect(printRecipientList("<h1>Liste</h1>", popup)).toBe(true);
    expect(write).toHaveBeenCalledWith("<h1>Liste</h1>");
    expect(print).toHaveBeenCalledOnce();
  });
});
