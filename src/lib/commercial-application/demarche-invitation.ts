// CE QUE L'INVITATION À L'ÉCHANGE DIT DE LA DÉMARCHE DE LA PERSONNE — une
// règle, partagée par trois lecteurs qui ne doivent pas diverger :
//   · l'envoi de l'invitation (`features/commercial-application/invitation-apporteur.ts`) ;
//   · l'aperçu reconstitué d'Emails › Envoyés (`features/admin-emails/reconstitution-invitation.ts`) ;
//   · les rappels J+3 / J+7 (`features/commercial-application/relances-invitation-apporteur.ts`).
//
// ⚠️ Module PUR, volontairement : les rappels tournent dans le worker, et un
// import serveur ici (Prisma, Redis, `server-only`) entrerait dans son graphe.

import { ORIGINE_CANDIDATURE_OFFRE, ORIGINE_SAISIE_MANUELLE } from "../contact/accuse-attendu";
import { ORIGINES_ACCORD_REQUIS, ORIGINES_DIRECTES, PROVENANCE_ADRESSE } from "./saisie-manuelle";

/**
 * Numéro d'objet stable pour une fiche : la somme des codes de son identifiant.
 * Stable (un « Renvoyer quand même » garde le même objet) et réparti à peu près
 * également entre les quatre objets du gabarit, sans état à tenir.
 */
export function varianteObjet(id: string): number {
  let somme = 0;
  for (const c of id) somme += c.charCodeAt(0);
  return somme % 4;
}

export type MarqueDemarche =
  | { offreEmploi: string; postePourvu?: true; spontanee?: true }
  | { candidature: true; variante: number }
  | Record<string, never>;

/**
 *   · fiche née d'une candidature à une OFFRE D'EMPLOI (2026-09-28) → `offre` :
 *     la personne a postulé à un poste salarié, PAS au réseau. Lui écrire « ta
 *     candidature apporteur d'affaires est retenue » serait faux. Prioritaire ;
 *   · saisie manuelle → rien (texte d'origine, avec sa provenance) ;
 *   · toute autre fiche (formulaire du site, annonce importée) → `candidature`,
 *     avec un objet parmi quatre, stable par fiche (2026-09-27).
 *
 * Lecture défensive de `details` (JSON de la base) ; ne lève jamais.
 */
export function marqueDemarche(details: unknown, id: string): MarqueDemarche {
  const d =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};
  if (d["origine"] === ORIGINE_CANDIDATURE_OFFRE) {
    const titre = typeof d["offreTitre"] === "string" ? d["offreTitre"].trim() : "";
    // Sans titre (chaîne vide), le gabarit dit « l'une de nos offres
    // d'emploi » plutôt que de retomber sur « candidature apporteur », faux.
    // 2026-09-29 — réseau proposé AUTOMATIQUEMENT avec « poste pourvu »
    // (`server/careers/proposer-reseau-auto.ts`) : la personne vient de lire que
    // le poste est pourvu. Le texte « ta candidature au poste suit son cours »
    // et « ton profil commercial » (écrits pour des commerciaux) la
    // contrediraient — vu au test de bout en bout du 29/09.
    if (d["propositionAuto"] === "poste-pourvu") return { offreEmploi: titre, postePourvu: true };
    // Candidature SPONTANÉE : il n'y a pas d'« offre » — ne pas l'écrire.
    if (d["propositionAuto"] === "spontanee-commerciale")
      return { offreEmploi: titre, spontanee: true };
    return { offreEmploi: titre };
  }
  if (d["origine"] === ORIGINE_SAISIE_MANUELLE) return {};
  return { candidature: true, variante: varianteObjet(id) };
}

/** `{ offre }` si la fiche vient d'une candidature à une offre d'emploi, `{}` sinon (rappels). */
export function offreDeLaFiche(details: unknown): { offreEmploi: string } | Record<string, never> {
  const m = marqueDemarche(details, "");
  return "offreEmploi" in m ? { offreEmploi: m.offreEmploi } : {};
}

/**
 * Provenance de l'adresse d'une fiche SAISIE À LA MAIN (`{ provenance }`), `{}` sinon.
 * Même règle que l'envoi de l'invitation : seule une saisie manuelle en porte une.
 * Les rappels J+3 / J+7 s'en servent pour ne pas dire « candidature retenue » à une
 * personne qui n'a jamais candidaté.
 */
export function provenanceDeLaFiche(
  details: unknown,
  locale: "fr" | "en",
): { provenance: { mode: "directe" | "indirecte"; libelle: string } } | Record<string, never> {
  const d =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};
  if (d["origine"] !== ORIGINE_SAISIE_MANUELLE) return {};
  const origine = typeof d["origineSaisie"] === "string" ? d["origineSaisie"] : "";
  const fragment = PROVENANCE_ADRESSE[origine];
  if (!fragment) return {};
  if (ORIGINES_ACCORD_REQUIS.includes(origine))
    return { provenance: { mode: "indirecte", libelle: fragment[locale] } };
  if (ORIGINES_DIRECTES.includes(origine))
    return { provenance: { mode: "directe", libelle: fragment[locale] } };
  return {};
}
