export const REQUIRED_FIELD = "DESTINATAIRE";
export const FIELD_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export type MergeValues = Record<string, string>;

export type ImportedDataRow = {
  rowNumber: number;
  values: Record<string, string>;
  name: string;
  issues: string[];
};

export type PreparedRecipient = {
  sourceRow: number;
  name: string;
  values: MergeValues;
  warning: string | null;
  issues: string[];
};

export function normalizeFieldName(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
}

export function parseTemplateFields(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    if (Array.isArray(parsed)) {
      const fields = parsed.filter((field): field is string => typeof field === "string" && FIELD_NAME_PATTERN.test(field));
      if (fields.length) return Array.from(new Set(fields));
    }
  } catch {
    // Les anciens modèles n’avaient pas de registre de champs ; ils restent compatibles.
  }
  return [REQUIRED_FIELD];
}

export function safeMergeValues(rawValues: Record<string, string>, allowedFields: string[]): MergeValues {
  const allowed = new Set(allowedFields);
  const values: MergeValues = {};
  for (const field of allowedFields) values[field] = "";
  for (const [rawField, rawValue] of Object.entries(rawValues)) {
    const field = normalizeFieldName(rawField);
    if (!allowed.has(field)) continue;
    values[field] = String(rawValue ?? "").trim();
  }
  return values;
}

export function warningsForValues(values: MergeValues): string[] {
  const warnings: string[] = [];
  if ((values.DESTINATAIRE ?? "").length > 30) warnings.push("Nom long du destinataire : vérifiez l’aperçu, un retour à la ligne peut être nécessaire.");
  if ((values.CONTACT ?? "").length > 42) warnings.push("Contact long : vérifiez l’aperçu de la zone destinataire.");
  if ((values.ADRESSE ?? "").length > 65) warnings.push("Adresse longue : vérifiez l’aperçu de la zone d’adresse.");
  if ((values.LOCALITE ?? "").length > 36) warnings.push("Localité longue : vérifiez l’aperçu de la zone d’adresse.");
  const phone = values.TELEPHONE ?? "";
  if (phone && !/^\+?[0-9][0-9 .()/-]{5,}$/.test(phone)) warnings.push("Téléphone à vérifier : conservez les chiffres et le préfixe international si nécessaire.");
  return warnings;
}

export function prepareRecipients(fields: string[], rows: Array<{ rowNumber: number; values: Record<string, string> }>, mappings: Record<string, string>): PreparedRecipient[] {
  return rows.map(row => {
    const values = safeMergeValues(
      Object.fromEntries(fields.map(field => [field, row.values[mappings[field] ?? ""] ?? ""])),
      fields,
    );
    const issues = values[REQUIRED_FIELD] ? [] : ["Destinataire manquant."];
    const warnings = warningsForValues(values);
    return {
      sourceRow: row.rowNumber,
      name: values[REQUIRED_FIELD],
      values,
      warning: warnings.length ? warnings.join(" ") : null,
      issues,
    };
  });
}

export function warningForRecipient(name: string): string | null {
  return warningsForValues({ [REQUIRED_FIELD]: name.trim() })[0] ?? null;
}

export function cleanRecipientNames(names: string[]): Array<{ name: string; warning: string | null }> {
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
