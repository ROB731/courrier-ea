import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Type, Palette, AlignLeft } from "lucide-react";

export type LetterStyle = {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  lineSpacing?: number;
  alignment?: "left" | "center" | "right" | "justify";
};

type LetterStyleControlsProps = {
  value: LetterStyle;
  onChange: (value: LetterStyle) => void;
};

const fontOptions = [
  { value: "", label: "Conserver la police du modèle" },
  { value: "Arial", label: "Arial" },
  { value: "Calibri", label: "Calibri" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Verdana", label: "Verdana" },
];

export function LetterStyleControls({ value, onChange }: LetterStyleControlsProps) {
  function update<K extends keyof LetterStyle>(key: K, nextValue: LetterStyle[K]) {
    onChange({ ...value, [key]: nextValue || undefined });
  }

  return (
    <div className="rounded-xl border border-[#e5e2db] bg-[#fcfbf8] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#edf1ee] text-[#315e51]"><Type className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-semibold text-[#34453b]">Style du courrier</p>
          <p className="mt-1 text-xs leading-5 text-[#89918b]">Ces réglages s’appliquent uniquement aux textes remplacés par vos données. Le reste du modèle reste inchangé.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="letter-font" className="text-xs text-[#64746b]">Police</Label>
          <select id="letter-font" value={value.fontFamily ?? ""} onChange={event => update("fontFamily", event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd9d0] bg-white px-3 text-sm text-[#34453b] focus:outline-none focus:ring-2 focus:ring-[#c89c52]">
            {fontOptions.map(option => <option key={option.value || "inherit"} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="letter-size" className="text-xs text-[#64746b]">Taille</Label>
          <select id="letter-size" value={value.fontSize ?? ""} onChange={event => update("fontSize", event.target.value ? Number(event.target.value) : undefined)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd9d0] bg-white px-3 text-sm text-[#34453b] focus:outline-none focus:ring-2 focus:ring-[#c89c52]">
            <option value="">Conserver la taille du modèle</option>
            {[9, 10, 11, 12, 13, 14, 16, 18].map(size => <option key={size} value={size}>{size} pt</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="letter-spacing" className="text-xs text-[#64746b]">Interligne</Label>
          <select id="letter-spacing" value={value.lineSpacing ?? ""} onChange={event => update("lineSpacing", event.target.value ? Number(event.target.value) : undefined)} className="mt-1 h-10 w-full rounded-lg border border-[#ddd9d0] bg-white px-3 text-sm text-[#34453b] focus:outline-none focus:ring-2 focus:ring-[#c89c52]">
            <option value="">Conserver l’interligne du modèle</option>
            <option value="1">Simple</option>
            <option value="1.15">1,15</option>
            <option value="1.5">1,5</option>
            <option value="2">Double</option>
          </select>
        </div>
        <div>
          <Label htmlFor="letter-align" className="flex items-center gap-1 text-xs text-[#64746b]"><AlignLeft className="h-3.5 w-3.5" /> Alignement</Label>
          <select id="letter-align" value={value.alignment ?? ""} onChange={event => update("alignment", (event.target.value || undefined) as LetterStyle["alignment"])} className="mt-1 h-10 w-full rounded-lg border border-[#ddd9d0] bg-white px-3 text-sm text-[#34453b] focus:outline-none focus:ring-2 focus:ring-[#c89c52]">
            <option value="">Conserver l’alignement du modèle</option>
            <option value="left">Gauche</option>
            <option value="center">Centré</option>
            <option value="right">Droite</option>
            <option value="justify">Justifié</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="letter-color" className="flex items-center gap-1 text-xs text-[#64746b]"><Palette className="h-3.5 w-3.5" /> Couleur du texte remplacé</Label>
          <div className="mt-1 flex items-center gap-3">
            <Input id="letter-color" type="color" value={value.color ?? "#000000"} onChange={event => update("color", event.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border-[#ddd9d0] bg-white p-1" aria-label="Choisir la couleur du texte remplacé" />
            <span className="text-xs text-[#89918b]">{value.color ?? "#000000"} · Noir par défaut</span>
          </div>
        </div>
      </div>
    </div>
  );
}
