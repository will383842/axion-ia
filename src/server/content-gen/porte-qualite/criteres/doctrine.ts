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
    directAnswer: c.directAnswer ?? undefined,
    keyTakeaway: c.keyTakeaway ?? undefined,
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

/** Une phrase qui parle d'une offre d'Axion-IA (nous, notre, nom d'offre, HT/TTC). */
const PHRASE_OFFRE = /axion|journ[ée]e ia|diagnostic ia|\bnotre\b|\bnos\b|\bnous\b|\bHT\b|\bTTC\b/i;

/**
 * B03 : prix d'une offre d'Axion-IA lus dans `pricing.ts` (via `price-gate`).
 * Le contrôle se fait PHRASE PAR PHRASE : seule une phrase qui parle d'Axion-IA
 * (nous, notre, nom d'offre, HT/TTC) est comparée à la source unique. « Une aide de
 * 5 000 € » ou « l'abonnement ChatGPT coûte 25 € » ne portent pas sur Axion-IA et
 * relèvent de B02 (Q3) : sinon faux positifs massifs (cf. content-gen-worker, contrôle
 * déjà retiré des fautes dures pour cette raison). Chaque phrase est jugée à part :
 * un même montant licite dans une phrase ne couvre pas la phrase suivante.
 * Les durées et le programme de la Journée IA arrivent ensuite.
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
  const ecarts = texte
    .split(/(?<=[.!?])\s+/)
    .filter((phrase) => PHRASE_OFFRE.test(phrase))
    .flatMap((phrase) => findNonSsotPrices(phrase));
  if (ecarts.length === 0) return OK;
  return {
    statut: "echec",
    raison: "Un prix écrit ne correspond à aucun tarif de la source unique.",
    preuves: ecarts.map((e) => e.amount),
  };
}
