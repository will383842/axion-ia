// Server Component — l'encart « combien » des pages de recrutement d'apporteurs,
// SANS chiffre (R7, ordre de Williams du 08/11/2026 : « apporteurs : sans prix ni
// promesse »). Remplace les cartes « 500 € par journée » / « 30 % de la facture ».
// Aucun JS client. Texte : `src/content/recrutement/commission-publique.ts`.

import { COMMISSION_QUALITATIVE } from "@/content/recrutement/commission-publique";
import { cn } from "@/lib/utils";

export function CommissionQualitative({ className }: { readonly className?: string }) {
  return (
    <article className={cn("bg-paper border-border mt-8 rounded-2xl border p-6 sm:p-7", className)}>
      <h3 className="text-fg font-serif text-xl font-semibold">{COMMISSION_QUALITATIVE.titre}</h3>
      <p className="text-fg-soft mt-3 max-w-2xl leading-relaxed">{COMMISSION_QUALITATIVE.detail}</p>
      <p className="text-fg-muted mt-3 text-sm">{COMMISSION_QUALITATIVE.prudence}</p>
    </article>
  );
}
