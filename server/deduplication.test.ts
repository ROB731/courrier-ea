import { describe, expect, it } from "vitest";
import { classifyRecipientAgainstSentHistory, type SentRecipientReference } from "./deduplication";

const sentReference: SentRecipientReference = {
  id: 42,
  campaignId: "campaign-previous",
  campaignName: "Prospection juin",
  sentAt: new Date("2026-06-18T12:00:00Z"),
  name: "CFAO INFRASTRUCTURE",
  values: { DESTINATAIRE: "CFAO INFRASTRUCTURE", TELEPHONE: "+225 01 02 03 04 05", EMAIL: "contact@cfao.example" },
};

describe("classifyRecipientAgainstSentHistory", () => {
  it("confirme un destinataire déjà envoyé quand le téléphone est identique", () => {
    const result = classifyRecipientAgainstSentHistory("Nouvelle raison sociale", { DESTINATAIRE: "Nouvelle raison sociale", TELEPHONE: "01 02 03 04 05" }, [sentReference]);
    expect(result).toMatchObject({ dedupeStatus: "sent_confirmed", matchedRecipientId: 42 });
    expect(result.dedupeReason).toContain("téléphone");
  });

  it("confirme un destinataire déjà envoyé malgré la ponctuation et les accents du nom", () => {
    const result = classifyRecipientAgainstSentHistory("CFAO-InfraStructure", { DESTINATAIRE: "CFAO-InfraStructure" }, [sentReference]);
    expect(result).toMatchObject({ dedupeStatus: "sent_confirmed", matchedCampaignName: "Prospection juin" });
  });

  it("demande une revue humaine pour un nom proche sans preuve de contact identique", () => {
    const result = classifyRecipientAgainstSentHistory("CFAO INFRASTRUCTURE CI", { DESTINATAIRE: "CFAO INFRASTRUCTURE CI" }, [sentReference]);
    expect(result).toMatchObject({ dedupeStatus: "review", matchedRecipientId: 42 });
  });

  it("garde le destinataire comme nouveau lorsqu’aucune correspondance fiable n’existe", () => {
    const result = classifyRecipientAgainstSentHistory("VISUEL CONCEPT", { DESTINATAIRE: "VISUEL CONCEPT", TELEPHONE: "+225 07 08 09 10 11" }, [sentReference]);
    expect(result).toMatchObject({ dedupeStatus: "new", matchedRecipientId: null });
  });
});
