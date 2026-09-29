/**
 * Qui SIGNE pour l'organisme — formules des pièces. Module PUR.
 *
 * ## Le défaut (audit des pièces réelles, 2026-09-30)
 *
 * 🔴 L'attestation de `AXI-SESS-2026-001` portait « Je soussigné AXION IA SAS
 * certifie que… » et « Le représentant légal : AXION IA SAS ». Les gabarits
 * faisaient `data.dirigeant ?? identite.raisonSociale` : faute de nom passé par
 * le producteur — et `attestation-service.ts` n'en passait aucun — la RAISON
 * SOCIALE prenait la place d'une personne. Une personne morale ne soussigne
 * pas : elle agit par son représentant légal, personne physique nommée, avec sa
 * qualité.
 *
 * ## La règle
 *
 *  - un nom est connu  → « Je soussigné(e) Williams Jullin, Président
 *    d'AXION IA SAS, atteste que… » ;
 *  - aucun nom connu   → « Le représentant légal d'AXION IA SAS atteste que… ».
 *    Jamais la raison sociale présentée comme un signataire.
 */

import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

export interface SignataireOrganisme {
  /** Nom de la personne physique, ou `null` s'il n'est pas renseigné. */
  readonly nom: string | null;
  /** Qualité (« Président »), ou `null`. */
  readonly qualite: string | null;
  /** Raison sociale de l'organisme (repli « l'organisme de formation »). */
  readonly organisme: string;
}

function texte(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Le signataire de l'organisme.
 *
 * `nomExplicite` (le `dirigeant` que certains producteurs passent encore) prime
 * sur la configuration lue par `getOrganismeIdentite`.
 */
export function signataireOrganisme(
  identite: Pick<
    OrganismeIdentite,
    "raisonSociale" | "representantLegalNom" | "representantLegalQualite"
  >,
  nomExplicite?: string | null,
): SignataireOrganisme {
  const organisme = texte(identite.raisonSociale) ?? "l'organisme de formation";
  const nom = texte(nomExplicite) ?? texte(identite.representantLegalNom);
  // Une qualité sans nom ne désigne personne : on ne l'imprime qu'avec un nom.
  const qualite = nom === null ? null : texte(identite.representantLegalQualite);
  // ⚠️ Défense : le repli historique passait la raison sociale comme « nom ».
  // Si un appelant le fait encore, on ne la prend pas pour une personne.
  if (nom !== null && nom === texte(identite.raisonSociale)) {
    return { nom: null, qualite: null, organisme };
  }
  return { nom, qualite, organisme };
}

/** « de » élidé devant une voyelle ou un h : « d'AXION IA SAS ». */
export function deOrganisme(organisme: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(organisme) ? `d'${organisme}` : `de ${organisme}`;
}

/**
 * Sujet de la phrase d'attestation, SANS le verbe :
 *   « Je soussigné(e) Williams Jullin, Président d'AXION IA SAS, »
 *   « Le représentant légal d'AXION IA SAS »
 * L'appelant ajoute « atteste que … ». Les deux formes s'accordent avec la
 * troisième personne comme la première (« atteste »).
 */
export function sujetAttestation(s: SignataireOrganisme): string {
  if (s.nom === null) return `Le représentant légal ${deOrganisme(s.organisme)}`;
  const qualite = s.qualite !== null ? `${s.qualite} ${deOrganisme(s.organisme)}` : null;
  return qualite !== null
    ? `Je soussigné(e) ${s.nom}, ${qualite},`
    : `Je soussigné(e) ${s.nom}, représentant légal ${deOrganisme(s.organisme)},`;
}

/**
 * Identification du signataire sous la signature :
 *   « Williams Jullin, Président »
 *   « Nom et qualité du représentant légal : ______ » (à compléter à la main).
 */
export function identificationSignataire(s: SignataireOrganisme): string {
  if (s.nom === null) return "Nom et qualité du représentant légal : ____________________";
  return s.qualite !== null ? `${s.nom}, ${s.qualite}` : s.nom;
}
