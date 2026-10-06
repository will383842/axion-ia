/**
 * Réseau d'apporteurs — le dossier de l'apporteur (listes fermées, déclarations, pièces,
 * IBAN, SIREN). Module PUR, volontairement séparé de `regles.ts` : il est lu par des
 * composants client, qui ne doivent pas embarquer le catalogue de prix (`@/content/pricing`)
 * que `regles.ts` importe pour le forfait de conférence. `regles.ts` le ré-exporte.
 */

/** Liste fermée de Partners (`StatutJuridique`, PR #727), avec ses libellés. */
export const STATUTS_JURIDIQUES = [
  { valeur: "micro_entrepreneur", libelle: "Micro-entrepreneur (auto-entrepreneur)" },
  { valeur: "entrepreneur_individuel", libelle: "Entrepreneur individuel (hors micro)" },
  { valeur: "eurl", libelle: "EURL" },
  { valeur: "sarl", libelle: "SARL" },
  { valeur: "sasu", libelle: "SASU" },
  { valeur: "sas", libelle: "SAS" },
  { valeur: "sa", libelle: "SA" },
  { valeur: "snc", libelle: "SNC" },
] as const;
export type StatutJuridique = (typeof STATUTS_JURIDIQUES)[number]["valeur"];

export function estStatutJuridique(v: unknown): v is StatutJuridique {
  return STATUTS_JURIDIQUES.some((s) => s.valeur === v);
}

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
      "J'accepte l'article 4.5 (recalcul et reprise d'une commission en cas d'avoir ou de remboursement).",
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

/** IBAN : forme et clé de contrôle (ISO 13616, modulo 97). */
export function ibanValide(brut: string): boolean {
  const s = brut.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const r = s.slice(4) + s.slice(0, 4);
  let reste = 0;
  for (const c of r) {
    const v = c >= "A" && c <= "Z" ? (c.charCodeAt(0) - 55).toString() : c;
    for (const ch of v) reste = (reste * 10 + Number(ch)) % 97;
  }
  return reste === 1;
}

/** SIREN : 9 chiffres et clé de Luhn. */
export function sirenValide(brut: string): boolean {
  const s = brut.replace(/\s+/g, "");
  if (!/^\d{9}$/.test(s)) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(s[8 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}
