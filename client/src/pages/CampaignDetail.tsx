import DashboardLayout from "@/components/DashboardLayout";
import AppendRecipientsDialog from "@/components/AppendRecipientsDialog";
import { LetterStyleControls, type LetterStyle } from "@/components/LetterStyleControls";
import { CampaignExportActions } from "@/components/CampaignExportActions";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { launchPdfPrint } from "@/lib/campaignOutput";
import { formatCampaignDate } from "@/lib/files";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Plus,
  Send,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function CampaignDetail({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [appendOpen, setAppendOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [letterStyle, setLetterStyle] = useState<LetterStyle>({});
  const [lifecycleNotice, setLifecycleNotice] = useState<string | null>(null);
  const { data, isLoading, error } = trpc.courrier.campaignDetail.useQuery(
    { campaignId: id },
    { retry: false },
  );
  const updateStatus = trpc.courrier.updateRecipientStatus.useMutation({
    onSuccess: () => utils.courrier.campaignDetail.invalidate({ campaignId: id }),
  });
  const regenerate = trpc.courrier.regenerateCampaign.useMutation({ onSuccess: async result => { await utils.courrier.campaignDetail.invalidate({ campaignId: id }); setRegenerateOpen(false); setLifecycleNotice(`${result.count} courrier${result.count > 1 ? "s" : ""} régénéré${result.count > 1 ? "s" : ""}. Les anciens fichiers restent disponibles dans l’historique des lots.`); } });
  const updateLifecycle = trpc.courrier.setCampaignLifecycle.useMutation({
    onSuccess: async result => { await utils.courrier.campaignDetail.invalidate({ campaignId: id }); setLifecycleNotice(result.lifecycleStatus === "closed" ? "Campagne clôturée : aucun nouvel ajout ne sera accepté." : "Campagne rouverte : vous pouvez ajouter un nouveau lot."); },
  });

  useEffect(() => { if (data?.campaign.style) setLetterStyle(data.campaign.style as LetterStyle); }, [data?.campaign.style]);

  if (isLoading) {
    return <DashboardLayout><div className="grid min-h-[60vh] place-items-center text-sm text-[#7f8780]"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Chargement de la campagne…</span></div></DashboardLayout>;
  }

  if (error || !data) {
    return <DashboardLayout><div className="mx-auto max-w-3xl rounded-2xl border border-[#efd7cf] bg-[#fff6f3] p-8 text-center"><TriangleAlert className="mx-auto h-6 w-6 text-[#b4563e]" /><h1 className="mt-3 font-serif text-2xl text-[#653628]">Campagne indisponible</h1><p className="mt-2 text-sm text-[#8e6256]">{error?.message || "La campagne demandée est introuvable."}</p><Link href="/campagnes"><Button variant="outline" className="mt-5">Retour à l’historique</Button></Link></div></DashboardLayout>;
  }

  const { campaign, recipients, batches = [] } = data;
  const batchHistory = batches as Array<{ id: string; sourceType: string; recipientCount: number; includedCount: number; createdAt: Date | string }>;

  const generatedRecipients = recipients.filter(recipient => recipient.includeInGeneration);
  const excludedRecipients = recipients.filter(recipient => !recipient.includeInGeneration);
  const sentCount = generatedRecipients.filter(recipient => recipient.status === "sent").length;
  const isReady = campaign.status === "ready";

  function printCampaign() {
    const launched = launchPdfPrint(
      campaign.pdfFileUrl!,
      url => window.open(url, "_blank"),
      callback => window.setTimeout(callback, 1200),
    );
    setPrintNotice(launched ? "Le PDF complet s’ouvre dans un nouvel onglet. Si la boîte d’impression ne s’affiche pas automatiquement, utilisez Ctrl+P (ou Cmd+P sur Mac)." : "Votre navigateur a bloqué la fenêtre PDF. Autorisez les fenêtres surgissantes pour ce site, puis cliquez de nouveau sur « Imprimer toutes les lettres »." );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <Link href="/campagnes" className="inline-flex items-center gap-1 text-sm font-medium text-[#597165] hover:text-[#123d35]"><ArrowLeft className="h-4 w-4" />Historique des campagnes</Link>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-4xl tracking-tight text-[#1d3028]">{campaign.name}</h1>
            <Badge className={isReady ? "border-0 bg-[#e3f0e8] text-[#2c7250]" : campaign.status === "error" ? "border-0 bg-[#fff0ed] text-[#b0523b]" : "border-0 bg-[#f8edd7] text-[#987235]"}>{isReady ? "Prête" : campaign.status === "error" ? "À vérifier" : "En génération"}</Badge>
          </div>
          <p className="mt-3 text-sm text-[#78827a]">Créée le {formatCampaignDate(campaign.createdAt)} · {campaign.recipientCount} destinataire{campaign.recipientCount > 1 ? "s" : ""}</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3"><Button onClick={() => setAppendOpen(true)} disabled={campaign.lifecycleStatus === "closed"} className="rounded-xl bg-[#123d35] hover:bg-[#0b2d27]"><Plus className="mr-2 h-4 w-4" />Ajouter des destinataires</Button><Button onClick={() => setRegenerateOpen(true)} disabled={!isReady || regenerate.isPending} variant="outline" className="rounded-xl border-[#cfdbd3] text-[#315e51]"><Download className="mr-2 h-4 w-4" />Modifier et régénérer</Button><Button variant="outline" onClick={() => updateLifecycle.mutate({ campaignId: campaign.id, lifecycleStatus: campaign.lifecycleStatus === "closed" ? "open" : "closed" })} disabled={updateLifecycle.isPending} className="rounded-xl border-[#cfdbd3] text-[#315e51]">{campaign.lifecycleStatus === "closed" ? "Rouvrir la campagne" : "Clôturer la campagne"}</Button>{campaign.lifecycleStatus === "closed" && <Badge className="border-0 bg-[#f5f3ee] text-[#68726b]">Campagne clôturée</Badge>}</div>{lifecycleNotice && <p className="mt-3 rounded-xl bg-[#edf4ef] px-3 py-2 text-sm text-[#3f725b]">{lifecycleNotice}</p>}
        {isReady && <CampaignExportActions pdfUrl={campaign.pdfFileUrl!} zipUrl={campaign.zipFileUrl!} onPrint={printCampaign} printNotice={printNotice} />}

        {campaign.status === "error" && <div className="mt-7 rounded-xl border border-[#eed9d1] bg-[#fff6f3] p-4 text-sm leading-6 text-[#95533f]"><TriangleAlert className="mr-2 inline h-4 w-4" />{campaign.errorMessage || "La génération a rencontré une erreur."}</div>}

        {batchHistory.length > 0 && <section className="mt-7 rounded-2xl border border-[#e5e2db] bg-white p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a7a40]">Historique des ajouts</p><div className="mt-3 flex flex-wrap gap-2">{batchHistory.map(batch => <span key={batch.id} className="rounded-lg bg-[#eef4ef] px-3 py-2 text-xs text-[#4f6b5d]">{batch.recipientCount} ajouté{batch.recipientCount > 1 ? "s" : ""} · {batch.sourceType} · {new Date(batch.createdAt).toLocaleDateString("fr-FR")}</span>)}</div></section>}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Summary label="À générer" value={generatedRecipients.length} icon={Send} /><Summary label="Envoyés" value={sentCount} icon={Check} /><Summary label="À envoyer" value={generatedRecipients.length - sentCount} icon={Download} /><Summary label="Exclus" value={excludedRecipients.length} icon={TriangleAlert} /></section>

        <section className="mt-8 overflow-hidden rounded-[1.5rem] border border-[#e5e2db] bg-white shadow-[0_12px_32px_rgba(36,44,38,0.04)]">
          <div className="flex flex-col justify-between gap-2 border-b border-[#eeeae3] px-5 py-5 sm:flex-row sm:items-center sm:px-7"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a7a40]">Suivi d’envoi</p><h2 className="mt-1 font-serif text-2xl text-[#24372d]">Destinataires de la campagne</h2></div><p className="text-xs text-[#7f8981]">Modifiez les statuts au fur et à mesure des envois.</p></div>
          <div className="divide-y divide-[#eeeae3]">
            {recipients.map(recipient => (
              <div key={recipient.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[#2c3e34]">{recipient.position}. {recipient.name}</p>
                  {Object.entries(recipient.values).filter(([field, value]) => field !== "DESTINATAIRE" && value).slice(0, 3).length > 0 && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#728077]">{Object.entries(recipient.values).filter(([field, value]) => field !== "DESTINATAIRE" && value).slice(0, 3).map(([field, value]) => <span key={field}>{field.replaceAll("_", " ").toLowerCase()} : {value}</span>)}</div>}
                  {recipient.dedupeReason && <p className={`mt-1 text-xs leading-5 ${recipient.includeInGeneration ? "text-[#9a7027]" : "text-[#966039]"}`}><TriangleAlert className="mr-1 inline h-3 w-3" />{recipient.dedupeReason}</p>}
                  {recipient.warning && <p className="mt-1 text-xs leading-5 text-[#aa623b]"><TriangleAlert className="mr-1 inline h-3 w-3" />{recipient.warning}</p>}
                </div>
                {!recipient.includeInGeneration ? <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#f7eadf] px-3 py-2 text-xs font-semibold text-[#966039]"><TriangleAlert className="h-3.5 w-3.5" />Exclu — déjà envoyé</span> : <button
                  onClick={() => updateStatus.mutate({ campaignId: campaign.id, recipientId: recipient.id, status: recipient.status === "sent" ? "to_send" : "sent" })}
                  disabled={updateStatus.isPending}
                  className={[
                    "inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition",
                    recipient.status === "sent" ? "bg-[#e4f1e8] text-[#2f7150] hover:bg-[#d6ebde]" : "bg-[#f5f3ee] text-[#68726b] hover:bg-[#ece9e1]",
                  ].join(" ")}
                >
                  {recipient.status === "sent" ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  {recipient.status === "sent" ? "Envoyé" : "À envoyer"}
                </button>}
              </div>
            ))}
          </div>
        </section>
      </div>
      <AppendRecipientsDialog campaignId={campaign.id} templateId={campaign.templateId} open={appendOpen} onOpenChange={setAppendOpen} />
      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}><DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto border-[#ddd9d0] bg-[#fffdf7]"><DialogHeader><DialogTitle className="font-serif text-2xl text-[#1d3028]">Modifier et régénérer les courriers</DialogTitle><DialogDescription>Les destinataires restent inchangés. Les nouveaux réglages seront appliqués aux textes remplacés et les anciens fichiers resteront disponibles.</DialogDescription></DialogHeader><LetterStyleControls value={letterStyle} onChange={setLetterStyle} /><DialogFooter><Button variant="outline" onClick={() => setRegenerateOpen(false)} className="rounded-xl">Annuler</Button><Button onClick={() => regenerate.mutate({ campaignId: campaign.id, style: letterStyle })} disabled={regenerate.isPending} className="rounded-xl bg-[#123d35]">{regenerate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Confirmer la régénération</Button></DialogFooter></DialogContent></Dialog>
    </DashboardLayout>
  );
}

function Summary({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Send }) {
  return <div className="rounded-2xl border border-[#e5e2db] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(36,44,38,0.03)]"><div className="flex items-center justify-between"><p className="text-xs font-medium text-[#808a82]">{label}</p><Icon className="h-4 w-4 text-[#9a7a40]" /></div><p className="mt-2 font-serif text-3xl text-[#263a2f]">{value}</p></div>;
}
