import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCampaignDate } from "@/lib/files";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, Clock3, FilePlus2, Files, History, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

function statusLabel(status: "generating" | "ready" | "error") {
  if (status === "ready") return "Prête";
  if (status === "error") return "À vérifier";
  return "En génération";
}

export default function Home() {
  const { data: campaigns = [], isLoading } = trpc.courrier.campaigns.useQuery();
  const { data: templates = [] } = trpc.courrier.templates.useQuery();
  const readyCampaigns = campaigns.filter(campaign => campaign.status === "ready");
  const totalRecipients = campaigns.reduce((total, campaign) => total + campaign.recipientCount, 0);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#123d35] px-7 py-9 text-white shadow-[0_22px_65px_rgba(18,61,53,0.20)] sm:px-10 sm:py-11">
          <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border border-[#d5b36b]/25" />
          <div className="absolute bottom-0 right-20 h-32 w-32 rounded-t-full border border-[#d5b36b]/15" />
          <div className="relative max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e5c985]"><ShieldCheck className="h-4 w-4" /> Publication maîtrisée</div>
            <h1 className="mt-5 font-serif text-4xl tracking-tight sm:text-5xl">Vos courriers, <span className="text-[#f3d78f]">sans compromis</span> sur la mise en page.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#d6e0dc] sm:text-base">COURRIER EA remplace uniquement le champ <strong className="font-semibold text-white">{"{{DESTINATAIRE}}"}</strong> de votre modèle Word, puis conserve votre présentation dans chaque document généré.</p>
            <Link href="/campagnes/nouvelle"><Button className="mt-7 h-11 rounded-xl bg-[#e2bd70] px-5 font-semibold text-[#153d35] hover:bg-[#f1d38f]"><FilePlus2 className="mr-2 h-4 w-4" />Créer une campagne</Button></Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Campagnes créées" value={campaigns.length} icon={Files} accent="text-[#173e36]" />
          <Metric label="Campagnes prêtes" value={readyCampaigns.length} icon={CheckCircle2} accent="text-[#36785f]" />
          <Metric label="Destinataires traités" value={totalRecipients} icon={History} accent="text-[#9a7a40]" />
          <Metric label="Modèles conservés" value={templates.length} icon={ShieldCheck} accent="text-[#705c9f]" />
        </section>

        <section className="mt-9 grid gap-7 xl:grid-cols-[1.55fr_0.85fr]">
          <div className="rounded-[1.6rem] border border-[#e5e2db] bg-white p-6 shadow-[0_14px_34px_rgba(36,44,38,0.04)] sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a7a40]">Activité récente</p><h2 className="mt-1 font-serif text-2xl text-[#1d3028]">Vos dernières campagnes</h2></div><Link href="/campagnes" className="hidden items-center gap-1 text-sm font-medium text-[#315e51] hover:text-[#123d35] sm:flex">Voir tout <ArrowRight className="h-4 w-4" /></Link></div>
            <div className="mt-6">
              {isLoading ? <p className="py-10 text-center text-sm text-[#89918b]">Chargement de vos campagnes…</p> : campaigns.length === 0 ? <EmptyCampaigns /> : <div className="divide-y divide-[#eeeae3]">{campaigns.slice(0, 5).map(campaign => <Link key={campaign.id} href={`/campagnes/${campaign.id}`} className="group flex items-center gap-4 py-4 first:pt-0"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf1ee] text-[#315e51]"><Files className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-medium text-[#26362f] group-hover:text-[#123d35]">{campaign.name}</p><p className="mt-1 text-xs text-[#89918b]">{campaign.recipientCount} destinataire{campaign.recipientCount > 1 ? "s" : ""} · {formatCampaignDate(campaign.createdAt)}</p></div><Badge className={campaign.status === "ready" ? "border-0 bg-[#e3f0e8] text-[#28704e]" : campaign.status === "error" ? "border-0 bg-[#fff0ed] text-[#b75038]" : "border-0 bg-[#f7eedb] text-[#927137]"}>{statusLabel(campaign.status)}</Badge><ArrowRight className="h-4 w-4 text-[#b0b5af] transition group-hover:translate-x-0.5 group-hover:text-[#315e51]" /></Link>)}</div>}
            </div>
          </div>
          <aside className="rounded-[1.6rem] border border-[#e5e2db] bg-[#fcfbf8] p-6 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a7a40]">Méthode fiable</p>
            <h2 className="mt-1 font-serif text-2xl text-[#1d3028]">Un contrôle à chaque étape</h2>
            <div className="mt-7 space-y-6"><Process number="01" title="Modèle validé" text="Une occurrence exacte de {{DESTINATAIRE}} est exigée avant l’import." /><Process number="02" title="Aperçu rassurant" text="Vérifiez la première lettre et les noms plus longs avant de générer." /><Process number="03" title="Archives disponibles" text="Retrouvez le PDF groupé et le ZIP Word dans l’historique." /></div>
          </aside>
        </section>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof Files; accent: string }) {
  return <div className="rounded-2xl border border-[#e5e2db] bg-white p-5 shadow-[0_12px_28px_rgba(36,44,38,0.035)]"><div className="flex items-center justify-between"><p className="text-xs font-medium text-[#7f8881]">{label}</p><Icon className={`h-4 w-4 ${accent}`} /></div><p className="mt-3 font-serif text-3xl text-[#203329]">{value}</p></div>;
}

function Process({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#d9c797] font-serif text-sm text-[#99783c]">{number}</span><div><p className="font-medium text-[#2d4036]">{title}</p><p className="mt-1 text-sm leading-6 text-[#777f79]">{text}</p></div></div>;
}

function EmptyCampaigns() {
  return <div className="rounded-2xl bg-[#f7f5f1] px-6 py-10 text-center"><Clock3 className="mx-auto h-5 w-5 text-[#9a7a40]" /><p className="mt-3 font-medium text-[#34453b]">Votre premier envoi commence ici.</p><p className="mt-1 text-sm text-[#818a83]">Importez un modèle Word et votre liste Excel.</p><Link href="/campagnes/nouvelle"><Button variant="outline" className="mt-5 rounded-xl border-[#d8d4ca] bg-white text-[#315e51] hover:bg-[#f3f1eb]">Préparer une campagne</Button></Link></div>;
}
