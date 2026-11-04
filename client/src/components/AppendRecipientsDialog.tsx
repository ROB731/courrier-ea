import { DirectoryRecipientPicker, type DirectoryRecipient } from "@/components/DirectoryRecipientPicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readFileAsBase64 } from "@/lib/files";
import { trpc } from "@/lib/trpc";
import { FileSpreadsheet, Loader2, Plus, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Source = { fileKey: string; fileUrl: string; sourceType: "excel" | "paste" | "directory" | "manual"; columnName: string; headers: string[]; rows: Array<{ rowNumber: number; values: Record<string, string> }> };
type Prepared = { sourceRow: number; values: Record<string, string>; includeInGeneration?: boolean };

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function suggested(fields: string[], headers: string[]) { return Object.fromEntries(fields.flatMap(field => { const found = headers.find(header => normalize(header) === normalize(field) || (field === "DESTINATAIRE" && ["destinataire", "entreprise", "societe", "client"].includes(normalize(header))) || (field === "TELEPHONE" && ["tel", "telephone", "mobile"].includes(normalize(header)))); return found ? [[field, found]] : []; })); }

export default function AppendRecipientsDialog({ campaignId, templateId, open, onOpenChange }: { campaignId: string; templateId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const { data: templates = [] } = trpc.courrier.templates.useQuery();
  const fields = useMemo(() => templates.find(template => template.id === templateId)?.fields ?? ["DESTINATAIRE"], [templateId, templates]);
  const [source, setSource] = useState<Source | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [pasteContent, setPasteContent] = useState("");
  const [prepared, setPrepared] = useState<Prepared[]>([]);
  const [notice, setNotice] = useState("");
  const importExcel = trpc.courrier.importExcel.useMutation({ onSuccess: result => applySource(result as Source) });
  const importPaste = trpc.courrier.importPastedTable.useMutation({ onSuccess: result => applySource(result as Source) });
  const prepare = trpc.courrier.prepareRecipients.useMutation({ onSuccess: result => { setPrepared(result.recipients as Prepared[]); setNotice(`${result.validCount} destinataire${result.validCount > 1 ? "s" : ""} prêt${result.validCount > 1 ? "s" : ""} à ajouter${result.sentConfirmedCount ? ` · ${result.sentConfirmedCount} déjà envoyé${result.sentConfirmedCount > 1 ? "s" : ""} exclu${result.sentConfirmedCount > 1 ? "s" : ""}` : ""}.`); } });
  const append = trpc.courrier.appendRecipients.useMutation({ onSuccess: async result => { await utils.courrier.campaignDetail.invalidate({ campaignId }); setNotice(`${result.addedCount} ajouté${result.addedCount > 1 ? "s" : ""} à la campagne${result.skippedDuplicateCount ? ` · ${result.skippedDuplicateCount} doublon${result.skippedDuplicateCount > 1 ? "s" : ""} ignoré${result.skippedDuplicateCount > 1 ? "s" : ""}` : ""}.`); setPrepared([]); setSource(null); } });

  useEffect(() => { if (source) setMappings(suggested(fields, source.headers)); }, [fields, source]);
  useEffect(() => { setManualValues(Object.fromEntries(fields.map(field => [field, ""]))); }, [fields.join("|")]);

  function applySource(next: Source) { setSource(next); setPrepared([]); setNotice(`${next.rows.length} ligne${next.rows.length > 1 ? "s" : ""} importée${next.rows.length > 1 ? "s" : ""}. Vérifiez la correspondance puis préparez l’ajout.`); }
  async function handleExcel(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; importExcel.mutate({ fileName: file.name, contentBase64: await readFileAsBase64(file) }); }
  function handleDirectory(rows: DirectoryRecipient[]) { applySource({ fileKey: "directory://append", fileUrl: "directory://append", sourceType: "directory", columnName: "DESTINATAIRE", headers: Array.from(new Set(["DESTINATAIRE", ...rows.flatMap(row => Object.keys(row.values))])), rows: rows.map((row, index) => ({ rowNumber: index + 1, values: { ...row.values, DESTINATAIRE: row.name } })) }); }
  function prepareSource() { if (!source || !mappings.DESTINATAIRE) return; prepare.mutate({ templateId, headers: source.headers, rows: source.rows, mappings }); }
  function prepareManual() { const name = manualValues.DESTINATAIRE?.trim(); if (!name) return; const manualMappings = Object.fromEntries(fields.map(field => [field, field])); setMappings(manualMappings); setSource({ fileKey: "manual://append", fileUrl: "manual://append", sourceType: "manual", columnName: "DESTINATAIRE", headers: fields, rows: [{ rowNumber: 1, values: manualValues }] }); prepare.mutate({ templateId, headers: fields, rows: [{ rowNumber: 1, values: manualValues }], mappings: manualMappings }); }
  function appendPrepared() { if (!prepared.length || !source) return; append.mutate({ campaignId, sourceType: source.sourceType, sourceFileKey: source.fileKey, sourceFileUrl: source.fileUrl, mappings, recipients: prepared.map((recipient, index) => ({ sourceRow: recipient.sourceRow || index + 1, values: recipient.values, includeInGeneration: recipient.includeInGeneration, origin: source.sourceType === "directory" ? "directory" : source.sourceType === "manual" ? "manual" : "import" })) }); }
  const isBusy = importExcel.isPending || importPaste.isPending || prepare.isPending || append.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-6xl max-h-[92vh] overflow-y-auto border-[#ddd9d0] bg-[#fffdf7] p-5 sm:p-7 lg:p-8">
        <DialogHeader className="border-b border-[#ebe6dc] pb-5 pr-6">
          <DialogTitle className="font-serif text-2xl text-[#1d3028] sm:text-3xl">Ajouter des destinataires à la campagne</DialogTitle>
          <DialogDescription className="max-w-4xl text-sm leading-6">Ajoutez un nouveau lot sans modifier les courriers déjà présents. Les doublons de cette campagne sont ignorés et les destinataires déjà envoyés restent soumis au contrôle habituel.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
            <div className="rounded-xl border border-[#e5e0d6] bg-white p-5">
              <p className="text-sm font-semibold text-[#31463a]">1. Importer un nouveau lot</p>
              <p className="mt-1 text-xs leading-5 text-[#718076]">Utilisez un fichier Excel ou sélectionnez des destinataires déjà enregistrés.</p>
              <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#cfc7b8] bg-[#fbfaf7] px-3 py-5 text-sm text-[#315e51] transition hover:border-[#9a7a40] hover:bg-[#f8f5ec]">
                <UploadCloud className="h-5 w-5" />
                <span className="font-medium">Importer un fichier Excel</span>
                <span className="text-xs text-[#89918b]">.xlsx uniquement</span>
                <input type="file" accept=".xlsx" className="sr-only" onChange={handleExcel} />
              </label>
            </div>
            <div className="min-w-0 rounded-xl border border-[#e5e0d6] bg-white p-1">
              <DirectoryRecipientPicker onUse={handleDirectory} />
            </div>
          </section>

          <section className="rounded-xl border border-[#e5e0d6] bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#31463a]"><FileSpreadsheet className="h-4 w-4 text-[#9a7a40]" />2. Coller un tableau</div>
            <Textarea value={pasteContent} onChange={event => setPasteContent(event.target.value)} placeholder="Destinataire;Téléphone;E-mail" className="mt-3 min-h-24 resize-y" />
            <Button onClick={() => pasteContent.trim() && importPaste.mutate({ content: pasteContent })} disabled={!pasteContent.trim() || isBusy} variant="outline" className="mt-3 rounded-xl border-[#cfdbd3] text-[#315e51]">Importer le collage</Button>
          </section>

          {source && <section className="rounded-xl border border-[#cddfd2] bg-[#f7fbf8] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-[#31463a]">3. Correspondance du lot</p><p className="mt-1 text-xs text-[#718076]">{source.rows.length} ligne{source.rows.length > 1 ? "s" : ""} · associez les colonnes du lot aux champs du modèle.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#567165]">{source.sourceType}</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map(field => <label key={field} className="min-w-0 text-xs font-medium text-[#64746b]">{field}<select value={mappings[field] ?? ""} onChange={event => setMappings(current => ({ ...current, [field]: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-[#dad7cf] bg-white px-2 text-sm text-[#43554b]"><option value="">{field === "DESTINATAIRE" ? "Choisir une colonne" : "Ne pas utiliser"}</option>{source.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>
            <Button onClick={prepareSource} disabled={!mappings.DESTINATAIRE || isBusy} className="mt-4 rounded-xl bg-[#315e51] hover:bg-[#234b3f]">{prepare.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Contrôler le lot</Button>
          </section>}

          <section className="rounded-xl border border-[#e5e0d6] bg-white p-5">
            <p className="text-sm font-semibold text-[#31463a]">4. Ajouter une fiche manuellement</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map(field => <Input key={field} value={manualValues[field] ?? ""} onChange={event => setManualValues(current => ({ ...current, [field]: event.target.value }))} placeholder={field === "DESTINATAIRE" ? "Destinataire *" : field} />)}</div>
            <Button onClick={prepareManual} disabled={!manualValues.DESTINATAIRE?.trim() || isBusy} variant="outline" className="mt-4 rounded-xl border-[#cfdbd3] text-[#315e51]">Contrôler cette fiche</Button>
          </section>

          {notice && <p className="rounded-xl bg-[#edf4ef] px-4 py-3 text-sm text-[#3f725b]">{notice}</p>}
          {prepared.length > 0 && <DialogFooter className="border-t border-[#ebe6dc] pt-5"><Button onClick={appendPrepared} disabled={isBusy} className="w-full rounded-xl bg-[#123d35] sm:w-auto">{append.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Ajouter {prepared.length} destinataire{prepared.length > 1 ? "s" : ""} à la campagne</Button></DialogFooter>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
