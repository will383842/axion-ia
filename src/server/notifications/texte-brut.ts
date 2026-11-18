// Briques communes des messages en TEXTE BRUT (jamais MarkdownV2) : le salon « Clients »
// (`format-clients.ts`) et les salons dédiés à détail complet (`format-detail.ts`).
//
// Texte brut parce que le message porte du texte libre : un seul `_` ou `[` mal fermé
// ferait refuser l'envoi par Telegram. Envoyé sans `parse_mode`, rien ne peut le casser.

import { LIBELLE_CANAL, type CanalRendezVous } from "@/server/calendly/canal";

/** « Libellé : valeur », ou rien quand la valeur manque. */
export function ligne(libelle: string, valeur: string | number | null | undefined): string | null {
  if (valeur === null || valeur === undefined) return null;
  const texte = String(valeur).trim();
  // Les marqueurs « (non communiqué) » des émetteurs n'apprennent rien.
  if (texte === "" || texte === "—" || /^\(.*\)$/.test(texte)) return null;
  return `${libelle} : ${texte}`;
}

/** Un bloc de texte libre, en entier, sous son titre. */
export function bloc(titre: string, texte: string | undefined): string[] {
  const t = texte?.trim();
  return t ? ["", `${titre} :`, t] : [];
}

export function utm(p: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}): string | undefined {
  const parties = [
    p.utmSource ? `source ${p.utmSource}` : null,
    p.utmMedium ? `support ${p.utmMedium}` : null,
    p.utmCampaign ? `campagne ${p.utmCampaign}` : null,
    p.utmContent ? `contenu ${p.utmContent}` : null,
  ].filter((v): v is string => v !== null);
  return parties.length > 0 ? parties.join(" · ") : undefined;
}

/** Le format d'un rendez-vous (visio, téléphone…) en clair. */
export function format(v: string | undefined): string | undefined {
  if (!v || v === "inconnu") return undefined;
  return v in LIBELLE_CANAL ? LIBELLE_CANAL[v as CanalRendezVous] : v;
}

/** Retire les lignes vides en double et en bout de message. */
export function compacter(lignes: string[]): string[] {
  const sortie: string[] = [];
  for (const l of lignes) {
    if (l === "" && (sortie.length === 0 || sortie.at(-1) === "")) continue;
    sortie.push(l);
  }
  while (sortie.at(-1) === "") sortie.pop();
  return sortie;
}
