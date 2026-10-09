// « RETROUVER MON ESPACE » (décision de Will, 2026-10-09).
//
// `/apporteur/dossier/retrouver` : l'apporteur qui a perdu son lien tape son adresse e-mail et
// reçoit le lien de son espace. Segment STATIQUE : il passe avant `[id]` et hérite des en-têtes
// de `/apporteur/dossier/*` (noindex, `Referrer-Policy: same-origin`, CSP), sans détour par le
// préfixe de langue (`src/proxy.ts` exclut `apporteur/dossier/`).

import type { Metadata } from "next";

import { Coquille } from "../[id]/[jeton]/Coquille";

import { FormulaireRetrouver } from "./FormulaireRetrouver";

export const metadata: Metadata = {
  title: { absolute: "Retrouver mon espace d'apporteur — Axion-IA" },
  robots: { index: false, follow: false },
};

export default function RetrouverMonEspacePage() {
  return (
    <Coquille>
      <h1 className="font-serif text-[28px] leading-tight font-medium">Retrouver mon espace</h1>
      <p className="text-fg-soft mt-3 text-[16px] leading-relaxed">
        Vous êtes apporteur d&apos;affaires du réseau Axion-IA et vous ne retrouvez plus le lien de
        votre espace ? Indiquez l&apos;adresse e-mail que vous nous avez donnée : nous vous
        renvoyons votre lien personnel.
      </p>
      <FormulaireRetrouver />
    </Coquille>
  );
}
