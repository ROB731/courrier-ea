import { Button } from "@/components/ui/button";
import { Download, FileArchive, Printer } from "lucide-react";
import React from "react";

type CampaignExportActionsProps = {
  pdfUrl: string;
  zipUrl: string;
  onPrint: () => void;
  printNotice: string | null;
};

export function CampaignExportActions({ pdfUrl, zipUrl, onPrint, printNotice }: CampaignExportActionsProps) {
  return (
    <section className="mt-7 rounded-[1.35rem] border border-[#d7e5da] bg-[#f5faf6] p-5 shadow-[0_12px_30px_rgba(36,75,51,0.06)] sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#588166]">Campagne terminée</p>
          <h2 className="mt-1 font-serif text-2xl text-[#234333]">Votre dossier complet est prêt.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#587266]">Le PDF regroupe toutes les lettres de la campagne, dans le même ordre que votre fichier Excel. Vous pouvez le télécharger ou l’imprimer en une seule fois.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={pdfUrl} download><Button className="h-11 rounded-xl bg-[#123d35] hover:bg-[#0b2d27]"><Download className="mr-2 h-4 w-4" />Télécharger le PDF complet</Button></a>
          <Button variant="outline" onClick={onPrint} className="h-11 rounded-xl border-[#b9d0bf] bg-white text-[#285a43] hover:bg-[#edf6ef]"><Printer className="mr-2 h-4 w-4" />Imprimer toutes les lettres</Button>
          <a href={zipUrl} download><Button variant="outline" className="h-11 rounded-xl border-[#d4d8d2] bg-white text-[#315e51] hover:bg-[#f6f7f4]"><FileArchive className="mr-2 h-4 w-4" />Télécharger le ZIP Word</Button></a>
        </div>
      </div>
      {printNotice && <p className="mt-4 rounded-xl border border-[#d6e5d8] bg-white px-3 py-2.5 text-xs leading-5 text-[#416c52]">{printNotice}</p>}
    </section>
  );
}
