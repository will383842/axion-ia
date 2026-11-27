/** B01 (doctrine, appelle `interdits-publication.ts`) et B03 (prix hors source unique). */

import { detecterInterditsSurface, raisonInterdit } from "@/lib/contenu/interdits-publication";
import { nettoyer, texteDe } from "../html";
import { findNonSsotPrices } from "../../quality/price-gate";
import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";

const OK: ResultatBrut = { statut: "ok", raison: null, preuves: [] };

/** Tous les champs du contenu qui peuvent atteindre le public. */
export function surfaceDuContenu(c: ContenuPorte): Record<string, string | undefined> {
  return {
    // Les champs supplémentaires sont préfixés : ils ne peuvent ni écraser un champ propre
    // ni être écrasés par lui (un champ « corps » sale ne doit jamais se perdre).
    ...Object.fromEntries(
      Object.entries(c.champsSupplementaires).map(([k, v]) => [`supp:${k}`, v]),
    ),
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
 * Limite assumée : le prix d'une offre écrit sans aucun de ces mots dans sa phrase
 * n'est pas jugé ici (B02, Q3). Les durées et le programme de la Journée IA arrivent ensuite.
 */
export function evaluerB03(c: ContenuPorte): ResultatBrut {
  // Chaque champ est lu à part, et chaque fin de bloc (titre, paragraphe, item…)
  // coupe la phrase : un titre « Nos offres » ne contamine pas le paragraphe suivant.
  const phrases = Object.entries(surfaceDuContenu(c))
    .filter(([k, v]) => k !== "corpsTexte" && Boolean(v))
    .flatMap(([, v]) =>
      texteDe(
        nettoyer(v as string).replace(
          /<\/(?:h[1-6]|p|li|td|th|tr|dd|dt|blockquote|figcaption|div|section)\s*>/gi,
          "$&. ",
        ),
      ).split(/(?<=[.!?])\s+/),
    );
  const ecarts = phrases
    .filter((phrase) => PHRASE_OFFRE.test(phrase))
    .flatMap((phrase) => findNonSsotPrices(phrase));
  if (ecarts.length === 0) return OK;
  return {
    statut: "echec",
    raison: "Un prix écrit ne correspond à aucun tarif de la source unique.",
    preuves: ecarts.map((e) => e.amount),
  };
}
