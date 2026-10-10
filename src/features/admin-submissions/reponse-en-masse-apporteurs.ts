/**
 * ÉCRIRE À PLUSIEURS FUTURS APPORTEURS — la part PURE (Candidatures unifiées L6b).
 *
 * Hors du module `"use server"` (qui ne peut exporter que des fonctions
 * asynchrones) : les règles d'exclusion et le nom court s'y éprouvent sans base.
 *
 * ── Pourquoi ce geste est RÉDUIT AUX MODÈLES ──────────────────────────────
 * Le geste groupé emploi (`admin-job-applications/reponse-en-masse.ts`)
 * accepte un texte libre. Ici, non : décision du chantier « candidatures
 * unifiées » (Will, 2026-10-07), l'envoi groupé à des futurs apporteurs ne part
 * que d'un modèle RELU (`content/apporteurs/modeles-reponse.ts`), lu côté
 * serveur et personnalisé pour chacun — jamais une consigne rédigée à la volée
 * et adressée à tout un réseau, qui serait la « communication descendante,
 * uniforme » que l'anti-requalification redoute. Le « Message libre » est donc
 * refusé, et chaque personne reçoit SON message.
 */

import type { MotifEcart } from "@/features/admin-job-applications/reponse-en-masse";

/** Pourquoi une fiche est EXCLUE de l'envoi groupé, ou `null`. */
export function motifExclusionApporteur(d: {
  readonly opposee: boolean;
  /** Classée « Sans suite » à la main (`details.sansSuiteAt`) ou après l'échange. */
  readonly sansSuite: boolean;
}): Extract<MotifEcart, "opposee" | "sans_suite"> | null {
  if (d.opposee) return "opposee";
  if (d.sansSuite) return "sans_suite";
  return null;
}

/** La fiche porte-t-elle la marque « sans suite » (`details.sansSuiteAt`) ? */
export function estClasseeSansSuite(details: unknown): boolean {
  return (
    !!details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    typeof (details as Record<string, unknown>)["sansSuiteAt"] === "string"
  );
}
