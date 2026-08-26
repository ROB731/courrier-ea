export type RecipientListItem = {
  sourceRow: number;
  name: string;
  values: Record<string, string>;
};

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function htmlCell(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function buildRecipientCsv(recipients: RecipientListItem[], fields: string[]) {
  const header = ["Ligne", ...fields];
  const rows = recipients.map(recipient => [String(recipient.sourceRow), ...fields.map(field => recipient.values[field] ?? (field === "DESTINATAIRE" ? recipient.name : ""))]);
  return [header, ...rows].map(row => row.map(csvCell).join(";")).join("\n");
}

export function buildRecipientRows(recipients: RecipientListItem[], fields: string[]) {
  return recipients.map(recipient => Object.fromEntries([
    ["Ligne", recipient.sourceRow],
    ...fields.map(field => [field, recipient.values[field] ?? (field === "DESTINATAIRE" ? recipient.name : "")]),
  ]));
}

export function buildRecipientPrintHtml(recipients: RecipientListItem[], fields: string[], title: string) {
  const headings = ["Ligne", ...fields].map(field => `<th>${htmlCell(field === "Ligne" ? field : field.replaceAll("_", " "))}</th>`).join("");
  const rows = recipients.map(recipient => {
    const cells = [String(recipient.sourceRow), ...fields.map(field => recipient.values[field] ?? (field === "DESTINATAIRE" ? recipient.name : ""))];
    return `<tr>${cells.map(value => `<td>${htmlCell(value)}</td>`).join("")}</tr>`;
  }).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${htmlCell(title)}</title><style>body{font-family:Arial,sans-serif;color:#1f3029;margin:32px}h1{font-size:20px;margin:0 0 6px}p{color:#637168;margin:0 0 20px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#eaf1ec;text-align:left}th,td{border:1px solid #cfd9d2;padding:8px;vertical-align:top}@media print{body{margin:12mm}}</style></head><body><h1>${htmlCell(title)}</h1><p>${recipients.length} destinataire${recipients.length > 1 ? "s" : ""} sélectionné${recipients.length > 1 ? "s" : ""} pour la génération.</p><table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export async function downloadRecipientExcel(recipients: RecipientListItem[], fields: string[], filename: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(buildRecipientRows(recipients, fields));
  worksheet["!cols"] = [{ wch: 9 }, ...fields.map(field => ({ wch: Math.max(field.length + 3, 22) }))];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Destinataires");
  XLSX.writeFile(workbook, filename, { compression: true });
}

type PrintWindow = Pick<Window, "document" | "focus" | "print"> & { opener: Window | null };

export function printRecipientList(html: string, openedWindow?: PrintWindow | null) {
  const printWindow = openedWindow ?? (typeof window === "undefined" ? null : window.open("", "_blank"));
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}
