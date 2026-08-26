import DashboardLayout from "@/components/DashboardLayout";
import { DirectoryRecipientPicker, type DirectoryRecipient } from "@/components/DirectoryRecipientPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readFileAsBase64 } from "@/lib/files";
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
import { ChangeEvent, useEffect, useMemo, useState } from "react";
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
  const [showRecipients, setShowRecipients] = useState(false);
  const selectedTemplate = templates.find(template => template.id === templateId);
  const fields = selectedTemplate?.fields ?? uploadedFields;
  const validRecipients = useMemo(() => recipients.filter(recipient => recipient.issues.length === 0), [recipients]);
  const invalidRecipients = useMemo(() => recipients.filter(recipient => recipient.issues.length > 0), [recipients]);
  const includedRecipients = useMemo(() => validRecipients.filter(recipient => recipient.includeInGeneration), [validRecipients]);
  const excludedRecipients = useMemo(() => validRecipients.filter(recipient => !recipient.includeInGeneration), [validRecipients]);
  const confirmedSentRecipients = useMemo(() => validRecipients.filter(recipient => recipient.dedupeStatus === "sent_confirmed"), [validRecipients]);
  const reviewRecipients = useMemo(() => validRecipients.filter(recipient => recipient.dedupeStatus === "review"), [validRecipients]);
  const mappedRequired = Boolean(mappings[REQUIRED_FIELD]);
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
  const createCampaign = trpc.courrier.createCampaign.useMutation({ onSuccess: async result => { await utils.courrier.campaigns.invalidate(); setLocation(`/campagnes/${result.campaignId}`); } });

  useEffect(() => {
    if (source && fields.length) setMappings(suggestedMappings(fields, source.headers));
  }, [templateId, source?.fileKey]);

  function applySource(result: SourceData) {
    setSource(result);
    setRecipients([]);
    setPreviewUrl("");
    setPreviewWarnings([]);
    setMappings(suggestedMappings(fields, result.headers));
    setNotice(`${result.rows.length} ligne${result.rows.length > 1 ? "s" : ""} détectée${result.rows.length > 1 ? "s" : ""}. Associez maintenant chaque champ du courrier à une colonne.`);
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

            {source && fields.length > 0 && <StepCard number="4" title="Associer les colonnes aux champs" description="Vérifiez la correspondance. Seul {{DESTINATAIRE}} est obligatoire ; les autres champs peuvent rester vides.">
              <div className="space-y-3">{fields.map(field => <div key={field} className="grid gap-2 rounded-xl border border-[#e7e3da] bg-[#fcfbf8] p-3 sm:grid-cols-[0.82fr_1.1fr] sm:items-center"><div><p className="text-sm font-medium text-[#31463a]">{`{{${field}}}`}{field === REQUIRED_FIELD && <span className="ml-2 text-xs text-[#a2573b]">Obligatoire</span>}</p><p className="mt-0.5 text-xs text-[#7c867e]">{labelForField(field)}</p></div><select value={mappings[field] ?? ""} onChange={event => updateMapping(field, event.target.value)} className="h-10 rounded-lg border border-[#dad7cf] bg-white px-3 text-sm text-[#43554b]"><option value="">{field === REQUIRED_FIELD ? "Choisir une colonne" : "Ne pas utiliser ce champ"}</option>{source.headers.map(header => <option value={header} key={header}>{header}</option>)}</select></div>)}</div>
              <Button onClick={validateRows} disabled={!mappedRequired || prepare.isPending} className="mt-4 h-10 rounded-xl bg-[#315e51] hover:bg-[#234b3f]">{prepare.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}Vérifier les données et préparer les courriers</Button>
              {prepare.error && <ErrorMessage text={prepare.error.message} />}
            </StepCard>}

            {recipients.length > 0 && <StepCard number="5" title="Vérifier les envois précédents" description="Les destinataires marqués « Envoyé » dans vos campagnes précédentes sont exclus par défaut. Vous pouvez les réintégrer si vous souhaitez tout de même leur envoyer ce courrier.">
              <div className="flex flex-wrap items-center gap-2"><Badge className="border-0 bg-[#e3f0e8] text-[#2c7250]">{includedRecipients.length} à générer</Badge>{confirmedSentRecipients.length > 0 && <Badge className="border-0 bg-[#f7eadf] text-[#99633a]">{confirmedSentRecipients.length} déjà envoyé{confirmedSentRecipients.length > 1 ? "s" : ""}</Badge>}{reviewRecipients.length > 0 && <Badge className="border-0 bg-[#fff3df] text-[#9b6d23]">{reviewRecipients.length} à vérifier</Badge>}{invalidRecipients.length > 0 && <Badge className="border-0 bg-[#fff0ed] text-[#a24e38]">{invalidRecipients.length} à corriger</Badge>}<button type="button" onClick={() => setShowRecipients(value => !value)} className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-[#315e51] hover:text-[#123d35]"><ListChecks className="h-4 w-4" />{showRecipients ? "Masquer la revue" : "Voir la revue"}</button></div>
              {excludedRecipients.length > 0 && <p className="mt-3 rounded-lg bg-[#fff9f0] px-3 py-2 text-xs leading-5 text-[#8c6334]">{excludedRecipients.length} destinataire{excludedRecipients.length > 1 ? "s" : ""} sera/seront conservé{excludedRecipients.length > 1 ? "s" : ""} dans la trace de campagne, mais ne figurera/figureront pas dans le PDF ni dans le ZIP.</p>}
              {showRecipients && <div className="mt-4 overflow-x-auto rounded-xl border border-[#e5e2db]"><table className="min-w-[680px] text-left text-xs"><thead className="bg-[#f7f5ef] text-[#68766d]"><tr><th className="px-3 py-2 font-semibold">Ligne</th><th className="px-3 py-2 font-semibold">Destinataire</th><th className="px-3 py-2 font-semibold">Résultat du contrôle</th><th className="px-3 py-2 font-semibold">Décision</th></tr></thead><tbody className="divide-y divide-[#eeeae3]">{recipients.map(recipient => <tr key={recipient.sourceRow} className={recipient.issues.length ? "bg-[#fff8f4]" : !recipient.includeInGeneration ? "bg-[#fffdf8]" : "bg-white"}><td className="px-3 py-2 text-[#8a7750]">{recipient.sourceRow}</td><td className="px-3 py-2 font-medium text-[#34453b]">{recipient.name || "—"}</td><td className="max-w-72 px-3 py-2 leading-5 text-[#6e7a72]">{recipient.issues.length ? recipient.issues.join(" ") : recipient.dedupeStatus === "sent_confirmed" ? <span><strong className="font-semibold text-[#966039]">Déjà envoyé.</strong> {recipient.dedupeReason} {recipient.matchedCampaignName ? `Campagne : ${recipient.matchedCampaignName}.` : ""}</span> : recipient.dedupeStatus === "review" ? <span><strong className="font-semibold text-[#9a7027]">À vérifier.</strong> {recipient.dedupeReason} {recipient.matchedCampaignName ? `Campagne : ${recipient.matchedCampaignName}.` : ""}</span> : recipient.warning || "Nouveau destinataire"}</td><td className="px-3 py-2">{recipient.issues.length ? <span className="text-[#ad634b]">À corriger</span> : <Button size="sm" variant="outline" onClick={() => toggleRecipientInclusion(recipient.sourceRow)} className={recipient.includeInGeneration ? "h-8 border-[#e2c9b7] bg-white text-[#a35b3f] hover:bg-[#fff6f1]" : "h-8 border-[#bfd7c5] bg-white text-[#347355] hover:bg-[#f2faf4]"}>{recipient.includeInGeneration ? "Exclure" : "Réintégrer"}</Button>}</td></tr>)}</tbody></table></div>}
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
