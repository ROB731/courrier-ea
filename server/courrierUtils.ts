export const DESTINATAIRE_TOKEN = "{{DESTINATAIRE}}";

export type ImportedRecipient = {
  name: string;
  warning: string | null;
};

export function warningForRecipient(name: string): string | null {
  return name.trim().length > 30
    ? "Nom long : vérifiez l’aperçu, un retour à la ligne peut être nécessaire."
    : null;
}

export function cleanRecipientNames(names: string[]): ImportedRecipient[] {
  return names
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => ({ name, warning: warningForRecipient(name) }));
}

export function safeStorageSegment(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
}

export function isDocxFile(name: string): boolean {
  return name.toLowerCase().endsWith(".docx");
}

export function isXlsxFile(name: string): boolean {
  return name.toLowerCase().endsWith(".xlsx");
}
