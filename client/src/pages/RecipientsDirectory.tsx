import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, ClipboardPlus, Pencil, Search, Trash2, UsersRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";

const fields = [
  { key: "CONTACT", label: "Contact" },
  { key: "FONCTION", label: "Fonction" },
  { key: "TELEPHONE", label: "Téléphone" },
  { key: "LOCALITE", label: "Localité" },
  { key: "ADRESSE", label: "Adresse" },
  { key: "EMAIL", label: "E-mail" },
] as const;

type Draft = { id?: string; name: string; values: Record<string, string> };
const emptyDraft = (): Draft => ({ name: "", values: Object.fromEntries(fields.map(field => [field.key, ""])) });

export default function RecipientsDirectory() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [notice, setNotice] = useState("");
  const input = useMemo(() => ({ query }), [query]);
  const { data = [], isLoading, error } = trpc.recipients.list.useQuery(input);
  const create = trpc.recipients.create.useMutation({ onSuccess: () => { utils.recipients.list.invalidate(); setDraft(emptyDraft()); setNotice("Le destinataire est enregistré dans votre base."); } });
  const update = trpc.recipients.update.useMutation({ onSuccess: () => { utils.recipients.list.invalidate(); setDraft(emptyDraft()); setNotice("Les informations du destinataire sont mises à jour."); } });
  const remove = trpc.recipients.remove.useMutation({ onSuccess: () => { utils.recipients.list.invalidate(); setNotice("Le destinataire est retiré de votre base. Les campagnes existantes restent inchangées."); } });

  function submit(event: FormEvent) {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(draft.values).filter(([, value]) => value.trim()));
    if (draft.id) update.mutate({ id: draft.id, name: draft.name, values });
    else create.mutate({ name: draft.name, values });
  }

  function edit(recipient: typeof data[number]) {
    setDraft({ id: recipient.id, name: recipient.name, values: Object.fromEntries(fields.map(field => [field.key, recipient.values[field.key] ?? ""])) });
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const mutationError = create.error?.message || update.error?.message || remove.error?.message;

  return <DashboardLayout><div className="mx-auto max-w-6xl">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#9a7a40]">Base réutilisable</p><h1 className="mt-2 font-serif text-4xl tracking-tight text-[#1d3028]">Vos <em className="font-normal text-[#315e51]">destinataires</em></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#778079]">Chaque import validé alimente ce répertoire. Vous pouvez aussi ajouter et corriger vos fiches à tout moment, puis les réutiliser directement dans une campagne.</p></div><Button onClick={() => setLocation("/campagnes/nouvelle")} className="h-10 rounded-xl bg-[#123d35] hover:bg-[#0b2d27]"><ClipboardPlus className="mr-2 h-4 w-4" />Nouvelle campagne</Button></div>
    <div className="mt-8 grid gap-7 xl:grid-cols-[0.82fr_1.18fr]">
      <section className="self-start rounded-[1.5rem] border border-[#e5e2db] bg-white p-5 shadow-[0_12px_28px_rgba(36,44,38,0.035)] sm:p-6"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a7a40]">{draft.id ? "Modifier une fiche" : "Ajout manuel"}</p><h2 className="mt-2 font-serif text-2xl text-[#263a2f]">{draft.id ? draft.name : "Ajouter un destinataire"}</h2><form onSubmit={submit} className="mt-5 space-y-3"><Field label="Entreprise / destinataire" required value={draft.name} onChange={value => setDraft(current => ({ ...current, name: value }))} placeholder="Ex. VIGASSISTANCE" />{fields.map(field => <Field key={field.key} label={field.label} value={draft.values[field.key] ?? ""} onChange={value => setDraft(current => ({ ...current, values: { ...current.values, [field.key]: value } }))} placeholder={field.key === "TELEPHONE" ? "+225 01 02 03 04 05" : undefined} />)}<div className="flex flex-wrap gap-2 pt-2"><Button type="submit" disabled={!draft.name.trim() || create.isPending || update.isPending} className="h-10 rounded-xl bg-[#315e51] hover:bg-[#234b3f]">{draft.id ? "Enregistrer les modifications" : "Ajouter au répertoire"}</Button>{draft.id && <Button type="button" variant="outline" onClick={() => setDraft(emptyDraft())} className="h-10 rounded-xl">Annuler</Button>}</div></form>{(notice || mutationError) && <p className={`mt-4 rounded-xl px-3 py-2.5 text-xs leading-5 ${mutationError ? "bg-[#fff0ed] text-[#a34f39]" : "bg-[#edf4ef] text-[#3e725a]"}`}>{mutationError || notice}</p>}</section>
      <section className="overflow-hidden rounded-[1.5rem] border border-[#e5e2db] bg-white shadow-[0_12px_28px_rgba(36,44,38,0.035)]"><div className="border-b border-[#eeeae3] px-5 py-5 sm:px-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a7a40]">Répertoire</p><h2 className="mt-1 font-serif text-2xl text-[#263a2f]">{data.length} fiche{data.length > 1 ? "s" : ""} trouvée{data.length > 1 ? "s" : ""}</h2></div><div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b958d]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher…" className="h-10 rounded-xl border-[#ddd9d0] bg-[#fcfbf8] pl-9 text-sm" /></div></div></div>
        <div className="divide-y divide-[#eeeae3]">{isLoading && <div className="px-7 py-12 text-center text-sm text-[#7e8881]">Chargement du répertoire…</div>}{error && <div className="px-7 py-12 text-center text-sm text-[#a0523b]">{error.message}</div>}{!isLoading && !error && data.length === 0 && <div className="px-7 py-14 text-center text-sm text-[#7b857e]"><UsersRound className="mx-auto mb-3 h-7 w-7 text-[#b1b7b1]" />Aucun destinataire enregistré pour cette recherche.</div>}{data.map(recipient => <div key={recipient.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-7"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium text-[#2c3e34]">{recipient.name}</p><Badge className={`border-0 text-[10px] ${recipient.source === "manual" ? "bg-[#f5ecda] text-[#967239]" : "bg-[#e5f1e9] text-[#337254]"}`}>{recipient.source === "manual" ? "Ajout manuel" : "Importé"}</Badge></div><p className="mt-1 truncate text-xs text-[#728077]">{[recipient.values.CONTACT, recipient.values.TELEPHONE, recipient.values.LOCALITE, recipient.values.EMAIL].filter(Boolean).join(" · ") || "Informations à compléter"}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => edit(recipient)} className="h-8 rounded-lg border-[#d8ddd8] text-[#315e51]"><Pencil className="mr-1.5 h-3.5 w-3.5" />Modifier</Button><Button variant="outline" size="sm" onClick={() => { if (window.confirm(`Retirer ${recipient.name} du répertoire ?`)) remove.mutate({ id: recipient.id }); }} disabled={remove.isPending} className="h-8 rounded-lg border-[#efd9d2] text-[#a4553d] hover:bg-[#fff4f0]"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Retirer</Button></div></div>)}</div>
      </section>
    </div>
  </div></DashboardLayout>;
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-[#59685e]">{label}{required && <span className="text-[#a6523c]">*</span>}</span><Input value={value} required={required} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-10 rounded-xl border-[#ddd9d0] bg-[#fcfbf8] text-sm" /></label>;
}
