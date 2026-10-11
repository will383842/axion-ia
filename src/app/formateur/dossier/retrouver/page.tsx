// « RETROUVER MON LIEN » du formateur indépendant (lot L6, F14).
//
// `/formateur/dossier/retrouver` : segment STATIQUE, il passe avant `[id]` et hérite des
// en-têtes de `/formateur/dossier/*` (noindex, `Referrer-Policy: same-origin`, CSP).
// Interrupteur `dossier_en_ligne` éteint : la 404 neutre, comme le dossier lui-même.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { dossierEnLigneOuvert } from "@/server/qualiopi/formateurs-independants/dossier";

import { Coquille } from "../[id]/[jeton]/Coquille";

import { FormulaireRetrouver } from "./FormulaireRetrouver";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Retrouver mon dossier de formateur — Axion-IA" },
  robots: { index: false, follow: false },
};

export default async function RetrouverMonDossierPage() {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) notFound();
  if (!(await dossierEnLigneOuvert())) notFound();
  return (
    <Coquille>
      <h1 className="font-serif text-[28px] leading-tight font-medium">Retrouver mon dossier</h1>
      <p className="text-fg-soft mt-3 text-[16px] leading-relaxed">
        Indiquez l&apos;adresse e‑mail que vous nous avez donnée : nous vous renvoyons votre lien
        personnel.
      </p>
      <FormulaireRetrouver />
    </Coquille>
  );
}
