import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readFileAsBase64 } from "@/lib/files";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Check, ChevronRight, CircleCheck, Eye, FileSpreadsheet, FileText, ListChecks, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Recipient = { name: string; warning: string | null };

export default function NewCampaign() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading: templatesLoading } = trpc.courrier.templates.useQuery();
  const uploadTemplate = trpc.courrier.uploadTemplate.useMutation({ onSuccess: async (result) => { await utils.courrier.templates.invalidate(); setTemplateId(result.id); setNotice(`Le modèle « ${result.name} » est validé et stocké de manière sécurisée.`); } });
  const importExcel = trpc.courrier.importExcel.useMutation({ onSuccess: (result) => { setExcelFileKey(result.fileKey); setExcelFileUrl(result.fileUrl); setRecipients(result.recipients); setNotice(`${result.recipients.length} destinataire(s) détecté(s) dans la colonne « ${result.columnName} ».`); } });
  const preview = trpc.courrier.preview.useMutation({ onSuccess: result => { setPreviewUrl(result.pdfUrl); setPreviewWarning(result.warning); } });
  const createCampaign = trpc.courrier.createCampaign.useMutation({ onSuccess: async result => { await utils.courrier.campaigns.invalidate(); setLocation(`/campagnes/${result.campaignId}`); } });
  const [campaignName, setCampaignName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [excelFileKey, setExcelFileKey] = useState("");
  const [excelFileUrl, setExcelFileUrl] = useState("");
  const [previewRecipient, setPreviewRecipient] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const selectedTemplate = templates.find(template => template.id === templateId);
  const hasLongName = useMemo(() => recipients.some(recipient => recipient.warning), [recipients]);
  const canGenerate = Boolean(campaignName.trim() && templateId && excelFileKey && recipients.length);
  const requirements = [
    { label: "Nom de campagne", ready: Boolean(campaignName.trim()) },
    { label: "Modèle Word", ready: Boolean(templateId) },
    { label: "Liste Excel", ready: Boolean(recipients.length) },
  ];

  async function handleTemplate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice("");
    setPreviewUrl("");
    try { uploadTemplate.mutate({ fileName: file.name, contentBase64: await readFileAsBase64(file) }); }
    catch { setNotice("La lecture du fichier Word a échoué."); }
  }

  async function handleExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice("");
    setPreviewUrl("");
    try { importExcel.mutate({ fileName: file.name, contentBase64: await readFileAsBase64(file) }); }
    catch { setNotice("La lecture du fichier Excel a échoué."); }
  }

  function requestPreview() {
    const recipientName = previewRecipient.trim() || recipients[0]?.name;
    if (!templateId || !recipientName) return;
    preview.mutate({ templateId, recipientName });
  }

  function generateCampaign() {
    if (!canGenerate) return;
    createCampaign.mutate({ name: campaignName.trim(), templateId, excelFileKey, excelFileUrl, recipients });
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#9a7a40]">Nouvelle campagne</p><h1 className="mt-2 font-serif text-4xl tracking-tight text-[#1d3028]">Préparez vos courriers <em className="font-normal text-[#315e51]">en toute confiance.</em></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#768078]">Le modèle est validé avant toute génération : seul le champ {"{{DESTINATAIRE}}"} peut être remplacé.</p></div><div className="flex items-center gap-2 rounded-xl border border-[#e7dfcd] bg-[#fffdf7] px-3 py-2 text-xs font-medium text-[#876b35]"><Sparkles className="h-4 w-4" /> Mise en page protégée</div></div>
        <div className="mt-8 grid gap-7 xl:grid-cols-[1fr_0.78fr]">
          <div className="space-y-5">
            <StepCard number="1" title="Nommer la campagne" description="Un intitulé simple pour retrouver facilement vos fichiers."><Input value={campaignName} onChange={event => setCampaignName(event.target.value)} placeholder="Ex. Prospection entreprises — juillet 2026" className="h-11 rounded-xl border-[#ddd9d0] bg-[#fcfbf8]" /></StepCard>
            <StepCard number="2" title="Choisir un modèle Word" description="Le modèle doit comporter exactement une occurrence de {{DESTINATAIRE}}.">
              {templatesLoading ? <p className="text-sm text-[#89918b]">Chargement des modèles…</p> : <select value={templateId} onChange={event => { setTemplateId(event.target.value); setPreviewUrl(""); }} className="h-11 w-full rounded-xl border border-[#ddd9d0] bg-[#fcfbf8] px-3 text-sm text-[#34453b] focus:outline-none focus:ring-2 focus:ring-[#c89c52]" aria-label="Choisir un modèle"><option value="">Sélectionner un modèle déjà importé</option>{templates.map(template => <option value={template.id} key={template.id}>{template.name}</option>)}</select>}
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-dashed border-[#cfc7b8] bg-[#fbfaf7] px-4 py-3 transition hover:border-[#9a7a40] hover:bg-[#fffdf8]"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf1ee] text-[#315e51]"><FileText className="h-4 w-4" /></span><span><span className="block text-sm font-medium text-[#34453b]">Importer un nouveau modèle</span><span className="block text-xs text-[#89918b]">Document Word .docx uniquement</span></span></span>{uploadTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin text-[#9a7a40]" /> : <UploadCloud className="h-4 w-4 text-[#9a7a40]" />}<input className="sr-only" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" type="file" onChange={handleTemplate} /></label>
              {selectedTemplate && <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[#317257]"><Check className="h-4 w-4" /> Modèle sélectionné : {selectedTemplate.name}</div>}
              {uploadTemplate.error && <ErrorMessage text={uploadTemplate.error.message} />}
            </StepCard>
            <StepCard number="3" title="Importer les destinataires" description="La colonne « Destinataire » est détectée automatiquement dans votre fichier Excel.">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-dashed border-[#cfc7b8] bg-[#fbfaf7] px-4 py-4 transition hover:border-[#9a7a40] hover:bg-[#fffdf8]"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f4eddd] text-[#9a7a40]"><FileSpreadsheet className="h-5 w-5" /></span><span><span className="block text-sm font-medium text-[#34453b]">Importer la liste Excel</span><span className="block text-xs text-[#89918b]">Fichier .xlsx avec une colonne Destinataire</span></span></span>{importExcel.isPending ? <Loader2 className="h-4 w-4 animate-spin text-[#9a7a40]" /> : <UploadCloud className="h-4 w-4 text-[#9a7a40]" />}<input className="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" type="file" onChange={handleExcel} /></label>
              {importExcel.error && <ErrorMessage text={importExcel.error.message} />}
              {recipients.length > 0 && <div className="mt-4 rounded-xl border border-[#dce8df] bg-[#f5f7f4] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-[#315e51]">{recipients.length} destinataire{recipients.length > 1 ? "s" : ""} prêt{recipients.length > 1 ? "s" : ""}</p><p className="mt-1 text-xs text-[#75837a]">La liste est importée. Cette étape ne bloque pas la génération.</p></div>{hasLongName && <Badge className="w-fit border-0 bg-[#fff0e4] text-[#a5552d]"><AlertTriangle className="mr-1 h-3 w-3" /> {recipients.filter(recipient => recipient.warning).length} nom{recipients.filter(recipient => recipient.warning).length > 1 ? "s" : ""} à vérifier</Badge>}</div><div className="mt-3 flex flex-wrap gap-2">{recipients.slice(0, 6).map(recipient => <span key={recipient.name} className="rounded-md bg-white px-2.5 py-1 text-xs text-[#5c6861] shadow-sm">{recipient.name}</span>)}{recipients.length > 6 && <span className="rounded-md bg-white px-2.5 py-1 text-xs text-[#5c6861] shadow-sm">+{recipients.length - 6} autres</span>}</div><button type="button" onClick={() => setShowRecipients(value => !value)} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#315e51] hover:text-[#123d35]"><ListChecks className="h-4 w-4" />{showRecipients ? "Masquer la liste complète" : `Vérifier les ${recipients.length} destinataires`}</button>{showRecipients && <div className="mt-3 grid gap-2 rounded-lg border border-[#dde4dd] bg-white p-3 sm:grid-cols-2">{recipients.map((recipient, index) => <div key={`${recipient.name}-${index}`} className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs ${recipient.warning ? "bg-[#fff5ed] text-[#9a572f]" : "text-[#58665e]"}`}><span className="mt-0.5 font-semibold text-[#9a7a40]">{index + 1}.</span><span>{recipient.name}{recipient.warning && <><br /><span className="text-[10px] leading-4"><AlertTriangle className="mr-1 inline h-3 w-3" />Vérifier le retour à la ligne</span></>}</span></div>)}</div>}</div>}
            </StepCard>
          </div>
          <aside className="self-start rounded-[1.6rem] border border-[#e3ded3] bg-white p-6 shadow-[0_14px_34px_rgba(36,44,38,0.05)] xl:sticky xl:top-8"><p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#9a7a40]">Contrôle avant génération</p><h2 className="mt-2 font-serif text-2xl text-[#1d3028]">Prévisualisez une lettre</h2><p className="mt-2 text-sm leading-6 text-[#778079]">Choisissez un destinataire : le PDF créé sera généré avec le même moteur que votre campagne.</p><Input value={previewRecipient} onChange={event => setPreviewRecipient(event.target.value)} placeholder={recipients[0]?.name || "Nom du destinataire"} disabled={!recipients.length} className="mt-5 h-11 rounded-xl border-[#ddd9d0] bg-[#fcfbf8]" /><Button variant="outline" onClick={requestPreview} disabled={!templateId || !recipients.length || preview.isPending} className="mt-3 h-10 w-full rounded-xl border-[#cfdbd3] text-[#315e51] hover:bg-[#edf2ee]">{preview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}Générer l’aperçu</Button>{preview.error && <ErrorMessage text={preview.error.message} />}{previewUrl && <div className="mt-4 rounded-xl border border-[#dce6df] bg-[#f5faf6] p-4"><div className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#317257]" /><div><p className="text-sm font-medium text-[#2f6c50]">Aperçu disponible</p><p className="mt-1 text-xs leading-5 text-[#618072]">Ouvrez le PDF pour contrôler la fidélité du résultat.</p></div></div>{previewWarning && <p className="mt-3 rounded-lg bg-[#fff3e8] px-3 py-2 text-xs leading-5 text-[#9a572f]"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{previewWarning}</p>}<a href={previewUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-[#315e51] hover:text-[#123d35]">Ouvrir le PDF <ChevronRight className="h-4 w-4" /></a></div>}{notice && <p className="mt-4 rounded-xl bg-[#edf4ef] px-3 py-2.5 text-xs leading-5 text-[#3f725b]">{notice}</p>}<div className="mt-7 border-t border-[#eeeae3] pt-6"><div className="rounded-xl bg-[#f6f4ef] p-3"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8d7544]">Prêt à générer ?</p><div className="mt-2 space-y-1.5">{requirements.map(requirement => <div key={requirement.label} className={`flex items-center gap-2 text-xs ${requirement.ready ? "text-[#347355]" : "text-[#8a918c]"}`}>{requirement.ready ? <CircleCheck className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#b8b9b2]" />}{requirement.label} {requirement.ready ? "prêt" : "à compléter"}</div>)}</div></div><Button onClick={generateCampaign} disabled={!canGenerate || createCampaign.isPending} className="mt-4 h-11 w-full rounded-xl bg-[#123d35] font-semibold hover:bg-[#0b2d27]">{createCampaign.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Génération en cours…</> : <>Générer puis télécharger la campagne <ChevronRight className="ml-2 h-4 w-4" /></>}</Button>{!canGenerate && <p className="mt-3 text-center text-[11px] leading-5 text-[#8d928c]">Complétez les éléments indiqués ci-dessus. La vérification des noms signalés reste facultative, mais recommandée.</p>}{createCampaign.error && <ErrorMessage text={createCampaign.error.message} />}<p className="mt-3 text-center text-[11px] leading-5 text-[#959b96]">Après la génération, vous arriverez sur la page contenant le téléchargement du PDF complet, son impression et le ZIP Word.</p></div></aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StepCard({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-[1.45rem] border border-[#e5e2db] bg-white p-5 shadow-[0_12px_28px_rgba(36,44,38,0.035)] sm:p-6"><div className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#123d35] font-serif text-sm text-[#f0d487]">{number}</span><div className="min-w-0 flex-1"><h2 className="font-serif text-xl text-[#23362c]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#7b847d]">{description}</p><div className="mt-4">{children}</div></div></div></section>;
}

function ErrorMessage({ text }: { text: string }) { return <p className="mt-3 rounded-lg bg-[#fff0ed] px-3 py-2 text-xs leading-5 text-[#ad4d39]">{text}</p>; }
