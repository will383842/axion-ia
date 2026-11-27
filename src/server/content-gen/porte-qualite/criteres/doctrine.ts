/** B01 (doctrine, appelle `interdits-publication.ts`) et B03 (prix hors source unique). */

import { detecterInterditsSurface, raisonInterdit } from "@/lib/contenu/interdits-publication";
import { findNonSsotPrices } from "../../quality/price-gate";
import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";

const OK: ResultatBrut = { statut: "ok", raison: null, preuves: [] };

/** Tous les champs du contenu qui peuvent atteindre le public. */
export function surfaceDuContenu(c: ContenuPorte): Record<string, string | undefined> {
  return {
    titre: c.titre,
    metaDescription: c.metaDescription ?? undefined,
    corps: c.corpsHtml,
    ...c.champsSupplementaires,
  };
}

/** B01 : la liste des interdits reste dans `interdits-publication.ts`, la porte l'appelle. */
export function evaluerB01(c: ContenuPorte, x: ContextePorte): ResultatBrut {
  const fautes = detecterInterditsSurface(surfaceDuContenu(c), {
    actualite: c.contentType === "blog_from_rss",
    financementPublicAutorise: x.financementPublicAutorise,
  });
  if (fautes.length === 0) return OK;
  return {
    statut: "echec",
    raison: `Faute de doctrine : ${raisonInterdit(fautes[0]!.code)}`,
    preuves: fautes.map((f) => `${f.champ} : ${f.code} (« ${f.extrait} »)`),
  };
}

/**
 * B03 : prix lus dans `pricing.ts` (via `price-gate`). Les durées et le programme
 * de la Journée IA (`journee-ia-commun.ts`) arrivent avec la suite du lot.
 */
export function evaluerB03(c: ContenuPorte): ResultatBrut {
  const texte = Object.values(surfaceDuContenu(c)).filter(Boolean).join("\n");
  const ecarts = findNonSsotPrices(texte);
  if (ecarts.length === 0) return OK;
  return {
    statut: "echec",
    raison: "Un prix écrit ne correspond à aucun tarif de la source unique.",
    preuves: ecarts.map((e) => e.amount),
  };
}
