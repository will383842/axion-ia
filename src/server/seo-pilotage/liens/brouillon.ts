/**
 * S10-1 · Contrôle du texte d'un brouillon de prise de contact (§ 5 et § 6). Module PUR.
 *
 * Les motifs reprennent ceux de `messageValide` du chargé de liens (`charge-de-liens.ts`, qu'on
 * ne modifie pas ici) : vouvoiement, aucun prix, aucune promesse de résultat, aucune proposition
 * d'échange ou d'achat, nom de la ville du siège interdit, une seule URL (la page proposée).
 * Un test garde les deux contrôles d'accord. Rien n'est envoyé : ce module ne fait que juger un texte.
 */
import { detecterTutoiement } from "../../content-gen/quality/vouvoiement";

export const BROUILLON_MAX = 700;

/**
 * Phrase d'information et d'opposition (RGPD, article 14) pour une adresse nominative.
 * TEXTE PROVISOIRE, à valider par Will (S10 § 6, question 3).
 */
export const MENTION_INFORMATION =
  "Vous recevez ce message car votre adresse est publiée par votre organisation pour ce type de demande. Vous pouvez vous opposer à ce traitement à tout moment : répondez simplement « ne plus me contacter » et nous en tiendrons compte.";

const TUTOIEMENT = /(?<![\p{L}])(?:tu|toi|ton|ta|tes)(?![\p{L}])/iu;
/** Ville du siège : jugée sur le texte COMPLET (URL comprise), après retrait des accents, des caractères invisibles et de la pleine chasse. */
const MOTIF_VILLE = /gr\s*e\s*n\s*o\s*b\s*l\s*e/i;
function sansDecor(t: string): string {
  return t.normalize("NFKD").replace(/[\u0300-\u036f\u00ad\u200b-\u200f\u2060\ufeff]/g, "");
}

const MOTIF_ECHANGE = /échange|echange|backlink|achat|acheter|sponsoris/i;
const MOTIF_INTERDIT = /€|\beuros?\b|\beur\b|\bprix\b|\btarifs?\b|garanti|promet|\d+\s?%/i;

export type MotifRefus =
  | "vide"
  | "trop_long"
  | "url_absente"
  | "autre_url"
  | "interdit"
  | "echange"
  | "tutoiement"
  | "mention_absente";

export interface ResultatBrouillon {
  readonly valide: boolean;
  readonly motifs: MotifRefus[];
}

export function avecMentionInformation(texte: string): string {
  return texte.includes(MENTION_INFORMATION) ? texte : `${texte.trim()}\n\n${MENTION_INFORMATION}`;
}

export function controlerBrouillon(
  texte: string,
  urlPage: string,
  options: { readonly nominatif?: boolean } = {},
): ResultatBrouillon {
  const m = texte.trim();
  const motifs: MotifRefus[] = [];
  if (m.length === 0) motifs.push("vide");
  if (m.length > BROUILLON_MAX) motifs.push("trop_long");
  if (m.length > 0 && (urlPage.trim() === "" || !m.includes(urlPage))) motifs.push("url_absente");
  // L'adresse de la page (slug) ne doit pas déclencher les motifs interdits : on la retire avant.
  const sansLien = m.split(urlPage).join(" ");
  if (MOTIF_INTERDIT.test(sansLien) || MOTIF_VILLE.test(sansDecor(m))) motifs.push("interdit");
  if (MOTIF_ECHANGE.test(sansLien)) motifs.push("echange");
  const urls = m.match(/https?:\/\/\S+/gi) ?? [];
  // Adresse sans schéma (« www.autre-site.fr ») : aussi une URL.
  // Toute adresse sans schéma (« voir bit.ly/abc », « www.site.de », « exemple.dev ») compte comme une URL.
  const reste = sansLien.replace(/https?:\/\/\S+/gi, " ");
  const sansSchema =
    // tout autre schéma (ftp://…), ou adresse relative au protocole (//hote/…)
    /[a-z][a-z0-9+.-]*:\/\//i.test(reste) ||
    /(?:^|\s)\/\/\S/.test(reste) ||
    // tout nom de domaine (hôte.suffixe), quel que soit le suffixe, hors adresse e-mail
    /(?<![\w@/.-])(?:[a-z0-9-]+\.)+[a-z]{2,24}(?![\w-])/i.test(reste);
  if (sansSchema || !urls.every((u) => u.replace(/[.,;:)»]+$/, "") === urlPage))
    motifs.push("autre_url");
  if (TUTOIEMENT.test(sansLien) || detecterTutoiement(sansLien).tutoie) motifs.push("tutoiement");
  if (options.nominatif && !m.includes(MENTION_INFORMATION)) motifs.push("mention_absente");
  return { valide: motifs.length === 0, motifs };
}
