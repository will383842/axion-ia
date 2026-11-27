/**
 * Réseau d'apporteurs — le dossier de l'apporteur (listes fermées, déclarations, pièces,
 * IBAN, SIREN). Module PUR, volontairement séparé de `regles.ts` : il est lu par des
 * composants client, qui ne doivent pas embarquer le catalogue de prix (`@/content/pricing`)
 * que `regles.ts` importe pour le forfait de conférence. `regles.ts` le ré-exporte.
 */

// Statuts juridiques : liste fermée neutre (FAC-5), ré-exportée ici pour le réseau.
export { STATUTS_JURIDIQUES, estStatutJuridique } from "@/lib/statut-juridique";
export type { StatutJuridique } from "@/lib/statut-juridique";

/** Les déclarations que l'apporteur coche avant de signer (contrat v2). */
export const DECLARATIONS = [
  {
    cle: "residence_fiscale_france",
    texte: "Ma résidence fiscale est en France.",
  },
  {
    cle: "aucune_clause_contraire",
    texte:
      "Aucune clause de non-concurrence ou d'exclusivité, ni aucune règle professionnelle ne m'interdit cette activité (art. 23).",
  },
  {
    cle: "aucun_lien_societe",
    texte: "Je ne suis ni salarié ni associé d'Axion-IA.",
  },
  {
    cle: "pas_de_travail_dissimule",
    texte: "Je n'ai recours à aucun travail dissimulé (art. 6.6).",
  },
] as const;

/** Les clauses qui exigent une acceptation distincte dans le contrat. */
export const ACCEPTATIONS = [
  { cle: "art_3_7", texte: "J'accepte l'article 3.7 (sincérité des présentations)." },
  {
    cle: "art_4_5",
    texte:
      "J'accepte l'article 4.5 (recalcul et reprise d'une commission en cas d'avoir, de remboursement partiel ou total ou d'annulation d'un encaissement, pendant vingt-quatre mois) et l'article 3.2 (réservation de soixante jours, puis validation au premier rendez-vous tenu ou à la signature d'un devis).",
  },
  {
    cle: "art_5_2",
    texte:
      "Je donne mandat à Axion-IA d'établir mes factures de commission (art. 5.2 et annexe 2).",
  },
  { cle: "art_7", texte: "J'accepte l'article 7 (données personnelles)." },
  { cle: "art_12", texte: "J'accepte l'article 12 (effets de la fin du contrat)." },
  {
    cle: "art_14",
    texte:
      "J'accepte l'article 14 : en cas de litige entre commerçants, les tribunaux du siège d'Axion-IA sont seuls compétents, sous réserve des juridictions spécialisées prévues par la loi.",
  },
] as const;

/**
 * Libellé de la case « art. 4.5 » dans le contrat 2.6 et avant. Les preuves déjà signées gardent
 * CE texte, mot pour mot (certificat et PDF) : ne jamais le modifier.
 */
export const LIBELLE_ART_4_5_AVANT_2_8 =
  "J'accepte l'article 4.5 (recalcul et reprise d'une commission : avoir, remboursement, geste commercial ou prestation non réalisée, pendant vingt-quatre mois).";

/** Le contrat est-il de la version 2.8 ou d'une version postérieure ? (comparaison par composante) */
export function estDepuis2_8(version: string): boolean {
  const [maj = 0, min = 0] = version.split(".").map((x) => Number.parseInt(x, 10) || 0);
  return maj > 2 || (maj === 2 && min >= 8);
}

/** Texte d'une case d'acceptation tel que le signataire de cette version l'a lu. */
export function texteAcceptation(cle: string, version: string): string | undefined {
  if (cle === "art_4_5" && !estDepuis2_8(version)) return LIBELLE_ART_4_5_AVANT_2_8;
  return ACCEPTATIONS.find((a) => a.cle === cle)?.texte;
}

/** Pièces : celles qu'il faut pour signer, et l'assurance, facultative. */
export const PIECES_POUR_SIGNER = ["identite", "rib"] as const;
export const PIECES_FACULTATIVES = ["rc_pro"] as const;
export const PIECES_VIGILANCE = ["vigilance", "immatriculation"] as const;
export type TypePiece = "identite" | "rib" | "rc_pro" | "vigilance" | "immatriculation";

export const LIBELLE_PIECE: Readonly<Record<TypePiece, string>> = {
  identite: "Pièce d'identité",
  rib: "RIB",
  rc_pro: "Attestation d'assurance RC pro",
  vigilance: "Attestation URSSAF de vigilance",
  immatriculation: "Extrait d'immatriculation (Kbis ou extrait RNE)",
};

export const AIDE_PIECE: Readonly<Record<TypePiece, string>> = {
  identite: "Carte d'identité ou passeport. Supprimée dès qu'elle est vérifiée.",
  rib: "À votre nom ou à celui de votre société.",
  rc_pro: "Facultatif : seulement si vous en avez une.",
  vigilance: "Gratuite, à télécharger dans votre espace URSSAF. Moins de 6 mois.",
  immatriculation: "Gratuit sur data.inpi.fr.",
};

export const MOTIFS_A_RETRANSMETTRE = [
  { valeur: "illisible", libelle: "illisible" },
  { valeur: "perimee", libelle: "périmé" },
  { valeur: "mauvais_nom", libelle: "pas au bon nom" },
  { valeur: "incomplete", libelle: "incomplet" },
  { valeur: "autre", libelle: "à remplacer" },
] as const;
export type MotifARetransmettre = (typeof MOTIFS_A_RETRANSMETTRE)[number]["valeur"];

// IBAN : validateur neutre (FAC-5), ré-exporté ici pour les appelants du réseau.
export { PAYS_SEPA, ibanValide } from "@/lib/iban";

// SIREN : validateur neutre (FAC-5), ré-exporté ici pour les appelants du réseau.
export { sirenValide } from "@/lib/siret";

/** Numéro de TVA intracommunautaire normalisé : espaces retirés, majuscules. */
export function normaliserNumeroTva(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

/**
 * Format d'un numéro de TVA intracommunautaire français (« FR » + 2 caractères + 9 chiffres). Le même
 * contrôle au dossier de l'apporteur et au changement de régime de la console. Pas de VIES.
 */
export function numeroTvaValide(v: string | null | undefined): boolean {
  return /^FR[0-9A-Z]{2}\d{9}$/.test(normaliserNumeroTva(v ?? ""));
}
