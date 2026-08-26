import type { MergeValues } from "./courrierUtils";

export type SentRecipientReference = {
  id: number;
  campaignId: string;
  campaignName: string;
  sentAt: Date;
  name: string;
  values: MergeValues;
};

export type DedupeStatus = "new" | "sent_confirmed" | "review";

export type DedupeResult = {
  dedupeStatus: DedupeStatus;
  dedupeReason: string | null;
  matchedRecipientId: number | null;
  matchedCampaignId: string | null;
  matchedCampaignName: string | null;
  matchedSentAt: Date | null;
};

function normalizeText(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePhone(value: string | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function samePhone(left: string, right: string) {
  if (left.length < 8 || right.length < 8) return false;
  return left === right || left.endsWith(right) || right.endsWith(left);
}

function getFirstValue(values: MergeValues, fields: string[]) {
  for (const field of fields) {
    const value = values[field];
    if (value?.trim()) return value;
  }
  return "";
}

function matchResult(status: DedupeStatus, reason: string, reference: SentRecipientReference): DedupeResult {
  return {
    dedupeStatus: status,
    dedupeReason: reason,
    matchedRecipientId: reference.id,
    matchedCampaignId: reference.campaignId,
    matchedCampaignName: reference.campaignName,
    matchedSentAt: reference.sentAt,
  };
}

function potentiallySimilar(left: string, right: string) {
  if (left.length < 6 || right.length < 6) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(left.split(" ").filter(token => token.length > 2));
  const rightTokens = new Set(right.split(" ").filter(token => token.length > 2));
  const common = Array.from(leftTokens).filter(token => rightTokens.has(token)).length;
  return common >= 2 && common / Math.min(leftTokens.size, rightTokens.size) >= 0.7;
}

export function classifyRecipientAgainstSentHistory(name: string, values: MergeValues, history: SentRecipientReference[]): DedupeResult {
  const normalizedName = normalizeText(name);
  const phone = normalizePhone(getFirstValue(values, ["TELEPHONE", "TEL", "MOBILE", "PHONE"]));
  const email = normalizeText(getFirstValue(values, ["EMAIL", "MAIL", "COURRIEL"]));

  for (const reference of history) {
    const referencePhone = normalizePhone(getFirstValue(reference.values, ["TELEPHONE", "TEL", "MOBILE", "PHONE"]));
    const referenceEmail = normalizeText(getFirstValue(reference.values, ["EMAIL", "MAIL", "COURRIEL"]));
    if (samePhone(phone, referencePhone)) return matchResult("sent_confirmed", "Même numéro de téléphone qu’un courrier déjà envoyé.", reference);
    if (email.length >= 5 && email === referenceEmail) return matchResult("sent_confirmed", "Même adresse e-mail qu’un courrier déjà envoyé.", reference);
  }

  for (const reference of history) {
    if (normalizedName && normalizedName === normalizeText(reference.name)) {
      return matchResult("sent_confirmed", "Même nom d’entreprise normalisé qu’un courrier déjà envoyé.", reference);
    }
  }

  for (const reference of history) {
    if (normalizedName && potentiallySimilar(normalizedName, normalizeText(reference.name))) {
      return matchResult("review", "Nom d’entreprise proche d’un destinataire déjà envoyé : vérifiez avant de décider.", reference);
    }
  }

  return { dedupeStatus: "new", dedupeReason: null, matchedRecipientId: null, matchedCampaignId: null, matchedCampaignName: null, matchedSentAt: null };
}

export function classifyRecipientsAgainstSentHistory<T extends { name: string; values: MergeValues }>(recipients: T[], history: SentRecipientReference[]) {
  return recipients.map(recipient => ({ ...recipient, ...classifyRecipientAgainstSentHistory(recipient.name, recipient.values, history) }));
}
