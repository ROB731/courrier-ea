import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

export type DirectoryRecipient = {
  id: string;
  name: string;
  values: Record<string, string>;
};

export function DirectoryRecipientPicker({ onUse }: { onUse: (recipients: DirectoryRecipient[]) => void }) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const input = useMemo(() => ({ query }), [query]);
  const { data = [], isLoading } = trpc.recipients.list.useQuery(input);
  const selected = data.filter(recipient => selectedIds.includes(recipient.id)) as DirectoryRecipient[];

  function toggle(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  return <div className="mt-4 rounded-xl border border-[#dbe5de] bg-[#f8fbf8] p-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-[#315e51]">Choisir dans le répertoire</p><p className="mt-0.5 text-xs text-[#718076]">Sélectionnez une ou plusieurs entreprises déjà enregistrées.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#567165]">{selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}</span></div>
    <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b958d]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une entreprise, un contact, une localité…" className="h-10 rounded-xl border-[#d9ded8] bg-white pl-9 text-sm" /></div>
    <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-[#e3e8e3] bg-white">
      {isLoading && <div className="flex items-center justify-center gap-2 px-4 py-7 text-sm text-[#77837b]"><Loader2 className="h-4 w-4 animate-spin" />Chargement du répertoire…</div>}
      {!isLoading && data.length === 0 && <div className="px-4 py-7 text-center text-sm text-[#77837b]"><UsersRound className="mx-auto mb-2 h-5 w-5 text-[#a6ada7]" />Aucun destinataire ne correspond à votre recherche.</div>}
      {!isLoading && data.map(recipient => <label key={recipient.id} className="flex cursor-pointer items-center gap-3 border-b border-[#f0f1ef] px-3 py-3 last:border-0 hover:bg-[#fbfcfb]"><input type="checkbox" checked={selectedIds.includes(recipient.id)} onChange={() => toggle(recipient.id)} className="h-4 w-4 rounded border-[#bbc9bf] accent-[#315e51]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#33483c]">{recipient.name}</span><span className="mt-0.5 block truncate text-xs text-[#7b887f]">{[recipient.values.CONTACT, recipient.values.TELEPHONE, recipient.values.LOCALITE].filter(Boolean).join(" · ") || "Informations enregistrées"}</span></span>{selectedIds.includes(recipient.id) && <Check className="h-4 w-4 text-[#347355]" />}</label>)}
    </div>
    <div className="mt-3 flex justify-end"><Button onClick={() => onUse(selected)} disabled={!selected.length} className="h-9 rounded-lg bg-[#315e51] text-xs hover:bg-[#234b3f]">Utiliser la sélection</Button></div>
  </div>;
}
