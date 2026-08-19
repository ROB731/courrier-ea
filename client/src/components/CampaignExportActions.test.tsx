import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { CampaignExportActions } from "./CampaignExportActions";

describe("CampaignExportActions", () => {
  it("présente les trois actions de sortie d’une campagne prête", () => {
    const html = renderToStaticMarkup(
      <CampaignExportActions
        pdfUrl="/manus-storage/courriers.pdf"
        zipUrl="/manus-storage/courriers.zip"
        onPrint={vi.fn()}
        printNotice={null}
      />,
    );

    expect(html).toContain("Télécharger le PDF complet");
    expect(html).toContain("Imprimer toutes les lettres");
    expect(html).toContain("Télécharger le ZIP Word");
    expect(html).toContain("/manus-storage/courriers.pdf");
    expect(html).toContain("/manus-storage/courriers.zip");
    expect(html.match(/download=""/g)).toHaveLength(2);
  });
});
