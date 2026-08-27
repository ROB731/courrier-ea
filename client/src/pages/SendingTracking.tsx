import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildRecipientPrintHtml, downloadRecipientExcel, printRecipientList } from "@/lib/recipientListExport";
import { trpc } from "@/lib/trpc";
import { Download, Loader2, Printer, Search, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type TrackingRow = {
  id: number;
  campaignId: string;
  campaignName: string;
  name: string;
  values: Record<string, string>;
  status: "to_send" | "sent";
  dedupeStatus: "new" | "sent_confirmed" | "review";
  includeInGeneration: boolean;
  updatedAt: Date | string;
};

function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }

export default function SendingTracking() {
  const { data = [], isLoading, error } = trpc.courrier.tracking.useQuery();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "to_send" | "sent">("all");
  const [campaign, setCampaign] = useState("all");
  const rows = data as TrackingRow[];
  const campaigns = useMemo(() => Array.from(new Set(rows.map(row => row.campaignName))).sort((a, b) => a.localeCompare(b, "fr")), [rows]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return rows.filter(row => {
      const values = Object.values(row.values).join(" ").toLocaleLowerCase("fr");
      return (!normalized || `${row.name} ${row.campaignName} ${values}`.toLocaleLowerCase("fr").includes(normalized)) &&
        (status === "all" || row.status === status) && (campaign === "all" || row.campaignName === campaign);
    });
  }, [campaign, query, rows, status]);
  const sentCount = filtered.filter(row => row.status === "sent").length;
  const toSendCount = filtered.filter(row => row.status === "to_send").length;

  function exportCsv() {
    const headers = ["Campagne", "Destinataire", "Statut", "Dédoublonnage", "Dernière mise à jour"];
    const csv = [headers, ...filtered.map(row => [row.campaignName, row.name, row.status === "sent" ? "Envoyé" : "À envoyer", row.dedupeStatus === "sent_confirmed" ? "Déjà envoyé" : row.dedupeStatus === "review" ? "À vérifier" : "Nouveau", new Date(row.updatedAt).toLocaleString("fr-FR")])].map(line => line.map(csvCell).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "suivi-des-envois.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    const items = filtered.map(row => ({ sourceRow: row.id, name: row.name, values: { DESTINATAIRE: row.name, ...row.values, CAMPAGNE: row.campaignName, STATUT: row.status === "sent" ? "Envoyé" : "À envoyer" } }));
    await downloadRecipientExcel(items, ["DESTINATAIRE", "CAMPAGNE", "STATUT"], "suivi-des-envois.xlsx");
  }

  function printFiltered() {
    const items = filtered.map(row => ({ sourceRow: row.id, name: row.name, values: { DESTINATAIRE: row.name, ...row.values, CAMPAGNE: row.campaignName, STATUT: row.status === "sent" ? "Envoyé" : "À envoyer" } }));
    printRecipientList(buildRecipientPrintHtml(items, ["DESTINATAIRE", "CAMPAGNE", "STATUT"], "Suivi des envois"));
  }

  return <DashboardLayout><div className="mx-auto max-w-6xl"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#9a7a40]">Pilotage</p><h1 className="mt-2 font-serif text-4xl tracking-tight text-[#1d3028]">Suivi des envois</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#768078]">Retrouvez les destinataires de toutes vos campagnes et confirmez les courriers réellement envoyés.</p></div><div className="flex gap-2"><Button variant="outline" onClick={exportExcel} disabled={!filtered.length} className="rounded-xl border-[#cfdbd3] text-[#315e51]"><Download className="mr-2 h-4 w-4" />Exporter Excel</Button><Button variant="outline" onClick={exportCsv} disabled={!filtered.length} className="rounded-xl border-[#cfdbd3] text-[#315e51]"><Download className="mr-2 h-4 w-4" />Exporter CSV</Button><Button variant="outline" onClick={printFiltered} disabled={!filtered.length} className="rounded-xl border-[#cfdbd3] text-[#315e51]"><Printer className="mr-2 h-4 w-4" />Imprimer</Button></div></div>
    <div className="mt-7 grid gap-3 sm:grid-cols-3"><Stat label="Résultats" value={filtered.length} /><Stat label="À envoyer" value={toSendCount} /><Stat label="Envoyés" value={sentCount} /></div>
    <section className="mt-7 rounded-[1.5rem] border border-[#e5e2db] bg-white p-5 shadow-[0_12px_32px_rgba(36,44,38,0.04)]"><div className="grid gap-3 lg:grid-cols-[1fr_190px_170px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a7a40]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un destinataire, e-mail ou campagne…" className="h-11 w-full rounded-xl border border-[#ddd9d0] bg-[#fcfbf8] pl-10 pr-10 text-sm text-[#34453b] outline-none focus:ring-2 focus:ring-[#c89c52]" aria-label="Rechercher dans le suivi" />{query && <button onClick={() => setQuery("")} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#778079]"><X className="h-4 w-4" /></button>}</div><select value={campaign} onChange={event => setCampaign(event.target.value)} className="h-11 rounded-xl border border-[#ddd9d0] bg-[#fcfbf8] px-3 text-sm text-[#34453b]" aria-label="Filtrer par campagne"><option value="all">Toutes les campagnes</option>{campaigns.map(name => <option value={name} key={name}>{name}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-11 rounded-xl border border-[#ddd9d0] bg-[#fcfbf8] px-3 text-sm text-[#34453b]" aria-label="Filtrer par statut"><option value="all">Tous les statuts</option><option value="to_send">À envoyer</option><option value="sent">Envoyé</option></select></div></section>
    <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#e5e2db] bg-white shadow-[0_12px_32px_rgba(36,44,38,0.04)]"><div className="grid grid-cols-[1.2fr_1fr_150px_150px] gap-4 border-b border-[#eeeae3] bg-[#fbfaf7] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b918b]"><span>Destinataire</span><span>Campagne</span><span>Statut</span><span>Dernière activité</span></div>{isLoading ? <div className="p-10 text-center text-sm text-[#7f8780]"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Chargement du suivi…</div> : error ? <div className="p-10 text-center text-sm text-[#a15e40]">Impossible de charger le suivi des envois.</div> : filtered.length ? <div className="divide-y divide-[#eeeae3]">{filtered.map(row => <div key={`${row.campaignId}-${row.id}`} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.2fr_1fr_150px_150px] sm:items-center sm:gap-4"><div className="min-w-0"><p className="truncate font-medium text-[#2c3e34]">{row.name}</p><p className="mt-1 truncate text-xs text-[#7a857d]">{Object.entries(row.values).filter(([key]) => key !== "DESTINATAIRE").slice(0, 2).map(([key, value]) => `${key.replaceAll("_", " ")} : ${value}`).join(" · ")}</p></div><Link href={`/campagnes/${row.campaignId}`} className="truncate text-sm font-medium text-[#315e51] hover:underline">{row.campaignName}</Link><div><Badge className={row.status === "sent" ? "border-0 bg-[#e3f0e8] text-[#2c7250]" : "border-0 bg-[#f5f3ee] text-[#68726b]"}>{row.status === "sent" ? "Envoyé" : "À envoyer"}</Badge>{row.dedupeStatus === "review" && <p className="mt-1 text-[11px] text-[#9a7027]">À vérifier</p>}</div><p className="text-xs text-[#7f8981]">{new Date(row.updatedAt).toLocaleString("fr-FR")}</p></div>)}</div> : <div className="p-10 text-center text-sm text-[#7f8780]">Aucun destinataire ne correspond à ces filtres.</div>}</section></div></DashboardLayout>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-[#e5e2db] bg-white px-5 py-4"><p className="text-xs text-[#808a82]">{label}</p><p className="mt-2 font-serif text-3xl text-[#263a2f]">{value}</p></div>; }
