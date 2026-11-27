/** B01 (doctrine, appelle `interdits-publication.ts`) et B03 (prix hors source unique). */

import { detecterInterditsSurface, raisonInterdit } from "@/lib/contenu/interdits-publication";
import { nettoyer, texteDe } from "../html";
import { findNonSsotPrices } from "../../quality/price-gate";
import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";

const OK: ResultatBrut = { statut: "ok", raison: null, preuves: [] };

/** Tous les champs du contenu qui peuvent atteindre le public. */
export function surfaceDuContenu(c: ContenuPorte): Record<string, string | undefined> {
  return {
    // Les champs supplémentaires d'abord : ils ne peuvent pas écraser les champs propres.
    ...c.champsSupplementaires,
    titre: c.titre,
    metaDescription: c.metaDescription ?? undefined,
    corps: c.corpsHtml,
    // Texte visible : un mot coupé par une balise (« Gre<span></span>noble ») ne s'échappe pas.
    corpsTexte: texteDe(
      nettoyer(c.corpsHtml).replace(/<\/?(?:span|b|i|em|strong|a|u|small|mark)\b[^>]*>/gi, ""),
    ),
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

const CONTEXTE_OFFRE =
  /axion|journ[ée]e ia|diagnostic|audit|tarif|prix|\bHT\b|\bTTC\b|devis|formation|intervention|coaching|abonnement/i;

/**
 * B03 : prix d'une offre d'Axion-IA lus dans `pricing.ts` (via `price-gate`).
 * Seuls comptent les montants écrits près d'un nom d'offre, d'un « HT » ou d'un
 * mot de tarif : « une aide de 5 000 € » ou « 20 000 € d'amende » ne portent pas
 * sur Axion-IA et relèvent de B02 (Q3), sinon la règle ferait des faux positifs
 * massifs (cf. content-gen-worker, contrôle déjà retiré des fautes dures pour
 * cette raison). Les durées et le programme de la Journée IA arrivent ensuite.
 */
export function evaluerB03(c: ContenuPorte): ResultatBrut {
  const texte = texteDe(
    nettoyer(
      Object.entries(surfaceDuContenu(c))
        .filter(([k, v]) => k !== "corpsTexte" && Boolean(v))
        .map(([, v]) => v)
        .join("\n"),
    ),
  );
  const ecarts = findNonSsotPrices(texte).filter((e) => {
    const i = texte.indexOf(e.amount);
    if (i < 0) return true;
    return CONTEXTE_OFFRE.test(texte.slice(Math.max(0, i - 80), i + e.amount.length + 40));
  });
  if (ecarts.length === 0) return OK;
  return {
    statut: "echec",
    raison: "Un prix écrit ne correspond à aucun tarif de la source unique.",
    preuves: ecarts.map((e) => e.amount),
  };
}
