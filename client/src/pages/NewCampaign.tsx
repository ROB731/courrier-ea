import DashboardLayout from "@/components/DashboardLayout";
import { DirectoryRecipientPicker, type DirectoryRecipient } from "@/components/DirectoryRecipientPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readFileAsBase64 } from "@/lib/files";
import { isAutoPreparationReady } from "@/lib/campaignAutoPreparation";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleCheck,
  ClipboardPaste,
  Eye,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Loader2,
  Sparkles,
  TableProperties,
  UploadCloud,
} from "lucide-react";
import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type SourceRow = { rowNumber: number; values: Record<string, string>; name: string; issues: string[] };
type SourceData = { fileKey: string; fileUrl: string; sourceType: "excel" | "paste" | "directory"; columnName: string; headers: string[]; rows: SourceRow[] };
type DedupeStatus = "new" | "sent_confirmed" | "review";
type PreparedRecipient = { sourceRow: number; name: string; values: Record<string, string>; warning: string | null; issues: string[]; includeInGeneration: boolean; dedupeStatus: DedupeStatus; dedupeReason: string | null; matchedCampaignName: string | null };

const REQUIRED_FIELD = "DESTINATAIRE";
const fieldLabels: Record<string, string> = {
  DESTINATAIRE: "Entreprise / destinataire",
  CONTACT: "Contact",
  FONCTION: "Fonction",
  TELEPHONE: "Téléphone",
  LOCALITE: "Localité",
  ADRESSE: "Adresse",
  EMAIL: "E-mail",
};

function labelForField(field: string) {
  return fieldLabels[field] ?? field.replaceAll("_", " ").toLowerCase();
}

function normaliseHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestedMappings(fields: string[], headers: string[]) {
  const aliases: Record<string, string[]> = {
    DESTINATAIRE: ["destinataire", "societe", "entreprise", "client", "raisonSociale"],
    CONTACT: ["contact", "nomcontact", "responsable", "interlocuteur"],
    FONCTION: ["fonction", "poste", "titre"],
    TELEPHONE: ["telephone", "tel", "mobile", "phone"],
    LOCALITE: ["localite", "ville", "commune", "quartier"],
    ADRESSE: ["adresse", "adresseentreprise", "rue"],
    EMAIL: ["email", "mail", "courriel"],
  };
  return Object.fromEntries(fields.flatMap(field => {
    const selected = headers.find(header => (aliases[field] ?? [field]).map(normaliseHeader).includes(normaliseHeader(header)));
    return selected ? [[field, selected]] : [];
  }));
}

export default function NewCampaign() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading: templatesLoading } = trpc.courrier.templates.useQuery();
  const [campaignName, setCampaignName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [uploadedFields, setUploadedFields] = useState<string[]>([]);
  const [source, setSource] = useState<SourceData | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [recipients, setRecipients] = useState<PreparedRecipient[]>([]);
  const [pasteContent, setPasteContent] = useState("");
  const [previewIndex, setPreviewIndex] = useState("0");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const lastAutoPreparationKey = useRef<string | null>(null);
  const selectedTemplate = templates.find(template => template.id === templateId);
  const fields = selectedTemplate?.fields ?? uploadedFields;
  const validRecipients = useMemo(() => recipients.filter(recipient => recipient.issues.length === 0), [recipients]);
  const invalidRecipients = useMemo(() => recipients.filter(recipient => recipient.issues.length > 0), [recipients]);
  const includedRecipients = useMemo(() => validRecipients.filter(recipient => recipient.includeInGeneration), [validRecipients]);
  const excludedRecipients = useMemo(() => validRecipients.filter(recipient => !recipient.includeInGeneration), [validRecipients]);
  const confirmedSentRecipients = useMemo(() => validRecipients.filter(recipient => recipient.dedupeStatus === "sent_confirmed"), [validRecipients]);
  const reviewRecipients = useMemo(() => validRecipients.filter(recipient => recipient.dedupeStatus === "review"), [validRecipients]);
  const mappedRequired = Boolean(mappings[REQUIRED_FIELD]);
  const autoPreparationReady = isAutoPreparationReady({
    templateId,
    fields,
    headers: source?.headers ?? [],
    rowCount: source?.rows.length ?? 0,
    mappings,
  });
  const autoPreparationKey = autoPreparationReady && source
    ? JSON.stringify({ templateId, sourceFileKey: source.fileKey, mappings: Object.entries(mappings).sort(([left], [right]) => left.localeCompare(right)) })
    : null;
  const canGenerate = Boolean(campaignName.trim() && templateId && source && includedRecipients.length && mappedRequired);

  const uploadTemplate = trpc.courrier.uploadTemplate.useMutation({
    onSuccess: async result => {
      await utils.courrier.templates.invalidate();
      setTemplateId(result.id);
      setUploadedFields(result.fields);
      setMappings(current => source ? { ...suggestedMappings(result.fields, source.headers), ...current } : current);
      setNotice(`Le modèle est validé. ${result.fields.length} champ${result.fields.length > 1 ? "s" : ""} de fusion détecté${result.fields.length > 1 ? "s" : ""}.`);
    },
  });
  const importExcel = trpc.courrier.importExcel.useMutation({ onSuccess: result => applySource(result as SourceData) });
  const importPastedTable = trpc.courrier.importPastedTable.useMutation({ onSuccess: result => applySource(result as SourceData) });
  const prepare = trpc.courrier.prepareRecipients.useMutation({
    onSuccess: result => {
      setRecipients(result.recipients as PreparedRecipient[]);
      setReviewModalOpen(true);
      setPreviewIndex("0");
      setPreviewUrl("");
      setPreviewWarnings([]);
      const directoryNote = result.directory.created || result.directory.updated ? ` · ${result.directory.created} ajouté${result.directory.created > 1 ? "s" : ""} et ${result.directory.updated} mis à jour dans le répertoire` : "";
      const duplicateNote = result.sentConfirmedCount ? ` · ${result.sentConfirmedCount} déjà envoyé${result.sentConfirmedCount > 1 ? "s" : ""} exclu${result.sentConfirmedCount > 1 ? "s" : ""} par défaut` : "";
      const reviewNote = result.reviewCount ? ` · ${result.reviewCount} rapprochement${result.reviewCount > 1 ? "s" : ""} à vérifier` : "";
      setNotice(`${result.validCount} ligne${result.validCount > 1 ? "s" : ""} valide${result.validCount > 1 ? "s" : ""}${duplicateNote}${reviewNote}${result.invalidCount ? ` · ${result.invalidCount} ligne${result.invalidCount > 1 ? "s" : ""} à corriger` : ""}${directoryNote}.`);
    },
  });
  const preview = trpc.courrier.preview.useMutation({ onSuccess: result => { setPreviewUrl(result.pdfUrl); setPreviewWarnings(result.warnings); } });
  const classifyManualRecipient = trpc.courrier.classifyManualRecipient.useMutation({
    onSuccess: recipient => {
      setRecipients(current => [...current, recipient as PreparedRecipient]);
      setManualValues(Object.fromEntries(fields.map(field => [field, ""])));
      setPreviewUrl("");
      setPreviewWarnings([]);
      setPreviewIndex("0");
      setNotice(`${recipient.name} a été ajouté à la liste et contrôlé avec les envois précédents.`);
    },
  });
  const createCampaign = trpc.courrier.createCampaign.useMutation({ onSuccess: async result => { await utils.courrier.campaigns.invalidate(); setLocation(`/campagnes/${result.campaignId}`); } });

  useEffect(() => {
    if (source && fields.length) setMappings(suggestedMappings(fields, source.headers));
  }, [templateId, source?.fileKey]);

  useEffect(() => {
    if (!source || !autoPreparationReady || !autoPreparationKey || prepare.isPending || lastAutoPreparationKey.current === autoPreparationKey) return;
    lastAutoPreparationKey.current = autoPreparationKey;
    prepare.mutate({ templateId, headers: source.headers, rows: source.rows.map(row => ({ rowNumber: row.rowNumber, values: row.values })), mappings });
  }, [autoPreparationKey, autoPreparationReady, mappings, prepare, source, templateId]);

  useEffect(() => {
    setManualValues(Object.fromEntries(fields.map(field => [field, ""])));
  }, [fields.join("|")]);

  function applySource(result: SourceData) {
    lastAutoPreparationKey.current = null;
    setSource(result);
    setRecipients([]);
    setReviewModalOpen(true);
    setPreviewUrl("");
    setPreviewWarnings([]);
    setMappings(suggestedMappings(fields, result.headers));
    setNotice(`${result.rows.length} ligne${result.rows.length > 1 ? "s" : ""} détectée${result.rows.length > 1 ? "s" : ""}. Le contrôle et le tri se lanceront automatiquement dès que {{DESTINATAIRE}} sera associé.`);
  }

  async function handleTemplate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice("");
    try { uploadTemplate.mutate({ fileName: file.name, contentBase64: await readFileAsBase64(file) }); }
    catch { setNotice("La lecture du fichier Word a échoué."); }
  }

  async function handleExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice("");
    try { importExcel.mutate({ fileName: file.name, contentBase64: await readFileAsBase64(file) }); }
    catch { setNotice("La lecture du fichier Excel a échoué."); }
  }

  function importPaste() {
    if (!pasteContent.trim()) return;
    importPastedTable.mutate({ content: pasteContent });
  }

  function useDirectoryRecipients(directoryRecipients: DirectoryRecipient[]) {
    const headers = Array.from(new Set([REQUIRED_FIELD, ...directoryRecipients.flatMap(recipient => Object.keys(recipient.values))]));
    const rows = directoryRecipients.map((recipient, index) => ({
      rowNumber: index + 1,
      name: recipient.name,
      issues: [],
      values: { ...recipient.values, [REQUIRED_FIELD]: recipient.name },
    }));
    applySource({ fileKey: "directory://recipients", fileUrl: "directory://recipients", sourceType: "directory", columnName: REQUIRED_FIELD, headers, rows });
    setNotice(`${rows.length} destinataire${rows.length > 1 ? "s" : ""} chargé${rows.length > 1 ? "s" : ""} depuis votre répertoire. Vérifiez les correspondances avant de générer.`);
  }

  function updateMapping(field: string, header: string) {
    setMappings(current => {
      const next = { ...current };
      if (header) next[field] = header;
      else delete next[field];
      return next;
    });
    setRecipients([]);
    setPreviewUrl("");
  }

  function validateRows() {
    if (!templateId || !source || !fields.length) return;
    prepare.mutate({ templateId, headers: source.headers, rows: source.rows.map(row => ({ rowNumber: row.rowNumber, values: row.values })), mappings });
  }

  function requestPreview() {
    const selected = includedRecipients[Number(previewIndex)] ?? includedRecipients[0];
    if (!templateId || !selected) return;
    preview.mutate({ templateId, values: selected.values });
  }

  function generateCampaign() {
    if (!canGenerate || !source) return;
    createCampaign.mutate({
      name: campaignName.trim(),
      templateId,
      sourceFileKey: source.fileKey,
      sourceFileUrl: source.fileUrl,
      sourceType: source.sourceType,
      mappings,
      recipients: validRecipients.map(recipient => ({ sourceRow: recipient.sourceRow, values: recipient.values, includeInGeneration: recipient.includeInGeneration })),
    });
  }

  function toggleRecipientInclusion(sourceRow: number) {
    setRecipients(current => current.map(recipient => recipient.sourceRow === sourceRow && recipient.issues.length === 0 ? { ...recipient, includeInGeneration: !recipient.includeInGeneration } : recipient));
    setPreviewUrl("");
    setPreviewWarnings([]);
    setPreviewIndex("0");
  }

  function removeRecipient(sourceRow: number) {
    setRecipients(current => current.filter(recipient => recipient.sourceRow !== sourceRow));
    setPreviewUrl("");
    setPreviewWarnings([]);
    setPreviewIndex("0");
  }

  function setAllRecipientInclusion(includeInGeneration: boolean) {
    setRecipients(current => current.map(recipient => recipient.issues.length ? recipient : { ...recipient, includeInGeneration }));
    setPreviewUrl("");
    setPreviewWarnings([]);
    setPreviewIndex("0");
  }

  function setCategoryInclusion(status: DedupeStatus, includeInGeneration: boolean) {
    setRecipients(current => current.map(recipient => recipient.issues.length || recipient.dedupeStatus !== status ? recipient : { ...recipient, includeInGeneration }));
    setPreviewUrl("");
    setPreviewWarnings([]);
    setPreviewIndex("0");
  }

  function keepOnlyNewRecipients() {
    setRecipients(current => current.map(recipient => recipient.issues.length ? recipient : { ...recipient, includeInGeneration: recipient.dedupeStatus === "new" }));
    setPreviewUrl("");
    setPreviewWarnings([]);
    setPreviewIndex("0");
  }

  function addManualRecipient() {
    if (!templateId || !manualValues[REQUIRED_FIELD]?.trim()) return;
    const nextSourceRow = Math.max(0, ...recipients.map(recipient => recipient.sourceRow)) + 1;
    classifyManualRecipient.mutate({ templateId, sourceRow: nextSourceRow, values: manualValues });
  }

  const requirements = [
    { label: "Nom de campagne", ready: Boolean(campaignName.trim()) },
    { label: "Modèle Word multi-champs", ready: Boolean(templateId && fields.length) },
    { label: "Source de données", ready: Boolean(source) },
    { label: "Correspondance validée", ready: Boolean(validRecipients.length) },
    { label: "Liste à générer", ready: Boolean(includedRecipients.length) },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#9a7a40]">Nouvelle campagne</p><h1 className="mt-2 font-serif text-4xl tracking-tight text-[#1d3028]">Préparez vos courriers <em className="font-normal text-[#315e51]">en toute confiance.</em></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#768078]">Le modèle conserve sa mise en page : COURRIER EA remplace uniquement les champs explicites au format {"{{NOM_DU_CHAMP}}"}.</p></div>
          <div className="flex items-center gap-2 rounded-xl border border-[#e7dfcd] bg-[#fffdf7] px-3 py-2 text-xs font-medium text-[#876b35]"><Sparkles className="h-4 w-4" /> Mise en page protégée</div>
        </div>

        <div className="mt-8 grid gap-7 xl:grid-cols-[1fr_0.82fr]">
          <div className="space-y-5">
            <StepCard number="1" title="Nommer la campagne" description="Un intitulé simple pour retrouver vos fichiers."><Input value={campaignName} onChange={event => setCampaignName(event.target.value)} placeholder="Ex. Prospection entreprises — juillet 2026" className="h-11 rounded-xl border-[#ddd9d0] bg-[#fcfbf8]" /></StepCard>

            <StepCard number="2" title="Choisir un modèle Word" description="Le modèle doit contenir {{DESTINATAIRE}} et peut contenir {{CONTACT}}, {{TELEPHONE}}, {{LOCALITE}}, {{ADRESSE}} ou vos propres champs.">
              {templatesLoading ? <p className="text-sm text-[#89918b]">Chargement des modèles…</p> : <select value={templateId} onChange={event => { setTemplateId(event.target.value); setUploadedFields([]); setRecipients([]); setPreviewUrl(""); }} className="h-11 w-full rounded-xl border border-[#ddd9d0] bg-[#fcfbf8] px-3 text-sm text-[#34453b] focus:outline-none focus:ring-2 focus:ring-[#c89c52]" aria-label="Choisir un modèle"><option value="">Sélectionner un modèle déjà importé</option>{templates.map(template => <option value={template.id} key={template.id}>{template.name}</option>)}</select>}
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-dashed border-[#cfc7b8] bg-[#fbfaf7] px-4 py-3 transition hover:border-[#9a7a40] hover:bg-[#fffdf8]"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf1ee] text-[#315e51]"><FileText className="h-4 w-4" /></span><span><span className="block text-sm font-medium text-[#34453b]">Importer un nouveau modèle</span><span className="block text-xs text-[#89918b]">Document Word .docx uniquement</span></span></span>{uploadTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin text-[#9a7a40]" /> : <UploadCloud className="h-4 w-4 text-[#9a7a40]" />}<input className="sr-only" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" type="file" onChange={handleTemplate} /></label>
              {fields.length > 0 && <div className="mt-4 rounded-xl bg-[#edf4ef] p-3"><p className="text-xs font-semibold text-[#347355]">Champs détectés dans le modèle</p><div className="mt-2 flex flex-wrap gap-2">{fields.map(field => <span key={field} className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#315e51]">{`{{${field}}}`}</span>)}</div></div>}
              {uploadTemplate.error && <ErrorMessage text={uploadTemplate.error.message} />}
            </StepCard>

            <StepCard number="3" title="Importer ou coller les données" description="Excel est recommandé. Pour une petite liste, vous pouvez aussi coller un tableau avec des tabulations, des points-virgules, des virgules ou le caractère |.">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-dashed border-[#cfc7b8] bg-[#fbfaf7] px-4 py-4 transition hover:border-[#9a7a40] hover:bg-[#fffdf8]"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f4eddd] text-[#9a7a40]"><FileSpreadsheet className="h-5 w-5" /></span><span><span className="block text-sm font-medium text-[#34453b]">Importer la liste Excel</span><span className="block text-xs text-[#89918b]">Fichier .xlsx avec une colonne Destinataire</span></span></span>{importExcel.isPending ? <Loader2 className="h-4 w-4 animate-spin text-[#9a7a40]" /> : <UploadCloud className="h-4 w-4 text-[#9a7a40]" />}<input className="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" type="file" onChange={handleExcel} /></label>
              <div className="mt-4 rounded-xl border border-[#e5e2db] bg-[#fcfbf8] p-3"><div className="flex items-center gap-2 text-sm font-medium text-[#495a50]"><ClipboardPaste className="h-4 w-4 text-[#9a7a40]" /> Coller un tableau</div><Textarea value={pasteContent} onChange={event => setPasteContent(event.target.value)} placeholder={"Destinataire;Téléphone;Localité\nVIGASSISTANCE;+225 01 02 03 04 05;Abidjan"} className="mt-3 min-h-24 resize-y rounded-xl border-[#ddd9d0] bg-white text-xs" /><Button variant="outline" onClick={importPaste} disabled={!pasteContent.trim() || importPastedTable.isPending} className="mt-3 h-9 rounded-lg border-[#d4d8d2] text-[#315e51]">{importPastedTable.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TableProperties className="mr-2 h-4 w-4" />}Lire le tableau collé</Button></div>
              <DirectoryRecipientPicker onUse={useDirectoryRecipients} />
              {(importExcel.error || importPastedTable.error) && <ErrorMessage text={importExcel.error?.message || importPastedTable.error?.message || "Erreur d’import."} />}
              {source && <div className="mt-4 rounded-xl border border-[#dce8df] bg-[#f5f7f4] p-4"><p className="text-sm font-medium text-[#315e51]">{source.rows.length} ligne{source.rows.length > 1 ? "s" : ""} détectée{source.rows.length > 1 ? "s" : ""} · source {source.sourceType === "excel" ? "Excel" : source.sourceType === "directory" ? "répertoire" : "collée"}</p><div className="mt-3 flex flex-wrap gap-2">{source.headers.map(header => <span key={header} className="rounded-md bg-white px-2.5 py-1 text-xs text-[#5c6861] shadow-sm">{header}</span>)}</div></div>}
            </StepCard>

            {source && <StepCard number="4" title="Revue de la liste" description="Le tri s’ouvre automatiquement après l’import. Vous pouvez le rouvrir à tout moment pour corriger et décider qui recevra un courrier.">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce8df] bg-[#f5f7f4] p-4"><div><p className="text-sm font-semibold text-[#315e51]">{recipients.length ? `${includedRecipients.length} destinataire${includedRecipients.length > 1 ? "s" : ""} prêt${includedRecipients.length > 1 ? "s" : ""} à générer` : "Contrôle de la liste à effectuer"}</p><p className="mt-1 text-xs text-[#64746b]">Décisions, doublons, corrections et ajout manuel sont regroupés dans une seule fenêtre.</p></div><Button onClick={() => setReviewModalOpen(true)} className="h-10 rounded-xl bg-[#315e51] hover:bg-[#234b3f]"><ListChecks className="mr-2 h-4 w-4" />{recipients.length ? "Ouvrir le tri" : "Ouvrir le contrôle"}</Button></div>
            </StepCard>}
          </div>

          <aside className="self-start rounded-[1.6rem] border border-[#e3ded3] bg-white p-6 shadow-[0_14px_34px_rgba(36,44,38,0.05)] xl:sticky xl:top-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#9a7a40]">Contrôle avant génération</p><h2 className="mt-2 font-serif text-2xl text-[#1d3028]">Prévisualisez une lettre</h2><p className="mt-2 text-sm leading-6 text-[#778079]">L’aperçu injecte toutes les valeurs de la ligne choisie, avec le même moteur sécurisé que la campagne.</p>
            <select value={previewIndex} onChange={event => setPreviewIndex(event.target.value)} disabled={!includedRecipients.length} className="mt-5 h-11 w-full rounded-xl border border-[#ddd9d0] bg-[#fcfbf8] px-3 text-sm text-[#44564b]"><option value="0">{includedRecipients[0] ? `Ligne ${includedRecipients[0].sourceRow} — ${includedRecipients[0].name}` : "Aucun courrier à générer"}</option>{includedRecipients.slice(1).map((recipient, index) => <option key={recipient.sourceRow} value={String(index + 1)}>Ligne {recipient.sourceRow} — {recipient.name}</option>)}</select>
            <Button variant="outline" onClick={requestPreview} disabled={!templateId || !includedRecipients.length || preview.isPending} className="mt-3 h-10 w-full rounded-xl border-[#cfdbd3] text-[#315e51] hover:bg-[#edf2ee]">{preview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}Générer l’aperçu</Button>
            {preview.error && <ErrorMessage text={preview.error.message} />}
            {previewUrl && <div className="mt-4 rounded-xl border border-[#dce6df] bg-[#f5faf6] p-4"><div className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#317257]" /><div><p className="text-sm font-medium text-[#2f6c50]">Aperçu disponible</p><p className="mt-1 text-xs leading-5 text-[#618072]">Ouvrez le PDF pour contrôler la fidélité de toutes les variables.</p></div></div>{previewWarnings.map(warning => <p key={warning} className="mt-3 rounded-lg bg-[#fff3e8] px-3 py-2 text-xs leading-5 text-[#9a572f]"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{warning}</p>)}<a href={previewUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-[#315e51] hover:text-[#123d35]">Ouvrir le PDF <ChevronRight className="h-4 w-4" /></a></div>}
            {notice && <p className="mt-4 rounded-xl bg-[#edf4ef] px-3 py-2.5 text-xs leading-5 text-[#3f725b]">{notice}</p>}
            <div className="mt-7 border-t border-[#eeeae3] pt-6"><div className="rounded-xl bg-[#f6f4ef] p-3"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8d7544]">Prêt à générer ?</p><div className="mt-2 space-y-1.5">{requirements.map(requirement => <div key={requirement.label} className={`flex items-center gap-2 text-xs ${requirement.ready ? "text-[#347355]" : "text-[#8a918c]"}`}>{requirement.ready ? <CircleCheck className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#b8b9b2]" />}{requirement.label} {requirement.ready ? "prêt" : "à compléter"}</div>)}</div></div><Button onClick={generateCampaign} disabled={!canGenerate || createCampaign.isPending} className="mt-4 h-11 w-full rounded-xl bg-[#123d35] font-semibold hover:bg-[#0b2d27]">{createCampaign.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Génération en cours…</> : <>Générer {includedRecipients.length} courrier{includedRecipients.length > 1 ? "s" : ""} <ChevronRight className="ml-2 h-4 w-4" /></>}</Button>{!canGenerate && <p className="mt-3 text-center text-[11px] leading-5 text-[#8d928c]">Importez les données, associez {"{{DESTINATAIRE}}"} et conservez au moins une ligne dans la liste à générer.</p>}{excludedRecipients.length > 0 && <p className="mt-2 text-center text-[11px] leading-5 text-[#8c6334]">{excludedRecipients.length} destinataire{excludedRecipients.length > 1 ? "s" : ""} ne sera/seront pas généré{excludedRecipients.length > 1 ? "s" : ""}.</p>}{invalidRecipients.length > 0 && <p className="mt-2 text-center text-[11px] leading-5 text-[#a15e40]">{invalidRecipients.length} ligne{invalidRecipients.length > 1 ? "s" : ""} incomplète{invalidRecipients.length > 1 ? "s" : ""} sera/seront exclue{invalidRecipients.length > 1 ? "s" : ""}.</p>}{createCampaign.error && <ErrorMessage text={createCampaign.error.message} />}</div>
          </aside>
        </div>
        <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
          <DialogContent className="max-w-[calc(100%-1rem)] gap-0 overflow-hidden border-[#ddd9d0] bg-[#fffdf7] p-0 text-[#34453b] sm:max-w-6xl">
            <div className="max-h-[calc(100vh-1rem)] overflow-y-auto p-5 sm:p-7">
              <DialogHeader className="pr-8 text-left">
                <DialogTitle className="font-serif text-2xl text-[#1d3028]">Contrôle de la liste importée</DialogTitle>
                <DialogDescription className="leading-6 text-[#6f7c74]">Associez les colonnes si besoin, puis décidez ici quels destinataires seront inclus dans la campagne. Aucune lettre n’est générée avant votre validation.</DialogDescription>
              </DialogHeader>

              {!source ? <p className="mt-5 rounded-xl bg-[#f5f3ee] p-4 text-sm text-[#68736c]">Importez une source de données pour ouvrir le contrôle.</p> : !fields.length ? <p className="mt-5 rounded-xl bg-[#fff3e8] p-4 text-sm leading-6 text-[#97592f]">Choisissez d’abord un modèle Word afin que COURRIER EA puisse reconnaître les champs à associer.</p> : <>
                <div className="mt-6 grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
                  <section className="rounded-2xl border border-[#e5e0d6] bg-white p-4">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#31463a]">Correspondance des colonnes</p><p className="mt-1 text-xs leading-5 text-[#768078]">Seul <strong>{"{{DESTINATAIRE}}"}</strong> est obligatoire.</p></div><Badge className="border-0 bg-[#edf4ef] text-[#347355]">{source.rows.length} lignes</Badge></div>
                    <div className="mt-4 space-y-2.5">{fields.map(field => <div key={field} className="grid gap-2 rounded-xl border border-[#e9e4db] bg-[#fcfbf8] p-3 sm:grid-cols-[0.8fr_1.2fr] sm:items-center"><div><p className="text-sm font-medium text-[#31463a]">{`{{${field}}}`}{field === REQUIRED_FIELD && <span className="ml-2 text-[11px] text-[#a2573b]">Obligatoire</span>}</p><p className="mt-0.5 text-xs text-[#7c867e]">{labelForField(field)}</p></div><select value={mappings[field] ?? ""} onChange={event => updateMapping(field, event.target.value)} className="h-10 rounded-lg border border-[#dad7cf] bg-white px-3 text-sm text-[#43554b]"><option value="">{field === REQUIRED_FIELD ? "Choisir une colonne" : "Ne pas utiliser ce champ"}</option>{source.headers.map(header => <option value={header} key={header}>{header}</option>)}</select></div>)}</div>
                    <Button onClick={validateRows} disabled={!mappedRequired || prepare.isPending} className="mt-4 h-10 w-full rounded-xl bg-[#315e51] hover:bg-[#234b3f]">{prepare.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}Recontrôler les données</Button>
                    {prepare.error && <ErrorMessage text={prepare.error.message} />}
                  </section>

                  <section className="rounded-2xl border border-[#e5e0d6] bg-white p-4">
                    <p className="text-sm font-semibold text-[#31463a]">Ajouter une fiche à la liste</p><p className="mt-1 text-xs leading-5 text-[#768078]">Le destinataire ajouté est contrôlé avec l’historique des courriers envoyés avant son inclusion.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">{fields.map(field => <Input key={field} value={manualValues[field] ?? ""} onChange={event => setManualValues(current => ({ ...current, [field]: event.target.value }))} placeholder={`${labelForField(field)}${field === REQUIRED_FIELD ? " *" : ""}`} className="h-10 rounded-lg border-[#ddd9d0] bg-white text-sm" />)}</div>
                    <Button onClick={addManualRecipient} disabled={!manualValues[REQUIRED_FIELD]?.trim() || classifyManualRecipient.isPending} className="mt-3 h-9 rounded-lg bg-[#315e51] hover:bg-[#234b3f]">{classifyManualRecipient.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Ajouter et contrôler</Button>
                    {classifyManualRecipient.error && <ErrorMessage text={classifyManualRecipient.error.message} />}
                  </section>
                </div>

                <section className="mt-5 rounded-2xl border border-[#e5e0d6] bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2"><Badge className="border-0 bg-[#e3f0e8] text-[#2c7250]">{includedRecipients.length} à générer</Badge>{confirmedSentRecipients.length > 0 && <Badge className="border-0 bg-[#f7eadf] text-[#99633a]">{confirmedSentRecipients.length} déjà envoyé{confirmedSentRecipients.length > 1 ? "s" : ""}</Badge>}{reviewRecipients.length > 0 && <Badge className="border-0 bg-[#fff3df] text-[#9b6d23]">{reviewRecipients.length} à vérifier</Badge>}{invalidRecipients.length > 0 && <Badge className="border-0 bg-[#fff0ed] text-[#a24e38]">{invalidRecipients.length} à corriger</Badge>}</div>
                  <div className="mt-4 flex flex-wrap gap-2 rounded-xl bg-[#fcfbf8] p-3"><Button size="sm" variant="outline" onClick={() => setAllRecipientInclusion(true)} className="h-8 border-[#bfd7c5] bg-white text-[#347355] hover:bg-[#f2faf4]">Tout inclure</Button><Button size="sm" variant="outline" onClick={() => setAllRecipientInclusion(false)} className="h-8 border-[#e2c9b7] bg-white text-[#a35b3f] hover:bg-[#fff6f1]">Tout retirer</Button>{confirmedSentRecipients.length > 0 && <Button size="sm" variant="outline" onClick={() => setCategoryInclusion("sent_confirmed", true)} className="h-8 border-[#d8c8a4] bg-white text-[#8b6931] hover:bg-[#fffaf0]">Réintégrer les déjà envoyés</Button>}{reviewRecipients.length > 0 && <Button size="sm" variant="outline" onClick={() => setCategoryInclusion("review", true)} className="h-8 border-[#e4cf9d] bg-white text-[#9a7027] hover:bg-[#fff9eb]">Inclure les à vérifier</Button>}<Button size="sm" variant="outline" onClick={keepOnlyNewRecipients} className="h-8 border-[#c9d8cc] bg-white text-[#3d7154] hover:bg-[#f2faf4]">Conserver seulement les nouveaux</Button><Button size="sm" variant="outline" onClick={() => { setRecipients([]); setPreviewUrl(""); setPreviewWarnings([]); }} className="h-8 border-[#ead9d1] bg-white text-[#a2503b] hover:bg-[#fff5f2]">Supprimer toute la liste</Button></div>
                  {excludedRecipients.length > 0 && <p className="mt-3 rounded-lg bg-[#fff9f0] px-3 py-2 text-xs leading-5 text-[#8c6334]">{excludedRecipients.length} destinataire{excludedRecipients.length > 1 ? "s" : ""} restera/ resteront dans la trace, mais ne figurera/ figureront pas dans le PDF ni dans le ZIP.</p>}
                  {prepare.isPending ? <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#edf4ef] p-4 text-sm text-[#347355]"><Loader2 className="h-4 w-4 animate-spin" /> Analyse des destinataires en cours…</div> : recipients.length > 0 ? <div className="mt-5 overflow-x-auto rounded-xl border border-[#e5e2db]"><table className="min-w-[760px] text-left text-xs"><thead className="bg-[#f7f5ef] text-[#68766d]"><tr><th className="px-3 py-2 font-semibold">Ligne</th><th className="px-3 py-2 font-semibold">Destinataire</th><th className="px-3 py-2 font-semibold">Résultat du contrôle</th><th className="px-3 py-2 font-semibold">Décision</th><th className="px-3 py-2 font-semibold">Liste</th></tr></thead><tbody className="divide-y divide-[#eeeae3]">{recipients.map(recipient => <tr key={recipient.sourceRow} className={recipient.issues.length ? "bg-[#fff8f4]" : !recipient.includeInGeneration ? "bg-[#fffdf8]" : "bg-white"}><td className="px-3 py-2 text-[#8a7750]">{recipient.sourceRow}</td><td className="px-3 py-2 font-medium text-[#34453b]">{recipient.name || "—"}</td><td className="max-w-72 px-3 py-2 leading-5 text-[#6e7a72]">{recipient.issues.length ? recipient.issues.join(" ") : recipient.dedupeStatus === "sent_confirmed" ? <span><strong className="font-semibold text-[#966039]">Déjà envoyé.</strong> {recipient.dedupeReason} {recipient.matchedCampaignName ? `Campagne : ${recipient.matchedCampaignName}.` : ""}</span> : recipient.dedupeStatus === "review" ? <span><strong className="font-semibold text-[#9a7027]">À vérifier.</strong> {recipient.dedupeReason} {recipient.matchedCampaignName ? `Campagne : ${recipient.matchedCampaignName}.` : ""}</span> : recipient.warning || "Nouveau destinataire"}</td><td className="px-3 py-2">{recipient.issues.length ? <span className="text-[#ad634b]">À corriger</span> : <Button size="sm" variant="outline" onClick={() => toggleRecipientInclusion(recipient.sourceRow)} className={recipient.includeInGeneration ? "h-8 border-[#e2c9b7] bg-white text-[#a35b3f] hover:bg-[#fff6f1]" : "h-8 border-[#bfd7c5] bg-white text-[#347355] hover:bg-[#f2faf4]"}>{recipient.includeInGeneration ? "Exclure" : "Réintégrer"}</Button>}</td><td className="px-3 py-2"><Button size="sm" variant="ghost" onClick={() => removeRecipient(recipient.sourceRow)} className="h-8 text-[#a2503b] hover:bg-[#fff0ed] hover:text-[#903f2e]">Retirer</Button></td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-xl bg-[#f5f3ee] p-4 text-sm leading-6 text-[#68736c]">Associez la colonne obligatoire puis lancez le contrôle pour afficher les destinataires et leurs décisions.</p>}
                </section>
              </>}
              <DialogFooter className="mt-6 border-t border-[#e7e2d9] pt-4"><Button onClick={() => setReviewModalOpen(false)} className="h-10 rounded-xl bg-[#123d35] hover:bg-[#0b2d27]">Continuer avec {includedRecipients.length} destinataire{includedRecipients.length > 1 ? "s" : ""}</Button></DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function StepCard({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-[1.45rem] border border-[#e5e2db] bg-white p-5 shadow-[0_12px_28px_rgba(36,44,38,0.035)] sm:p-6"><div className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#123d35] font-serif text-sm text-[#f0d487]">{number}</span><div className="min-w-0 flex-1"><h2 className="font-serif text-xl text-[#23362c]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#7b847d]">{description}</p><div className="mt-4">{children}</div></div></div></section>;
}

function ErrorMessage({ text }: { text: string }) {
  return <p className="mt-3 rounded-lg bg-[#fff0ed] px-3 py-2 text-xs leading-5 text-[#ad4d39]">{text}</p>;
}
