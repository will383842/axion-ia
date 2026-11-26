/**
 * Challenges d'apporteurs — règles PURES (aucune base, aucune horloge implicite).
 *
 * Un challenge est une INVITATION LIBRE : aucun objectif imposé, aucun classement nominatif,
 * aucun compteur ni relance (risque de salariat). Ce module ne porte que la règle publiée :
 * jamais un chiffre propre à un apporteur.
 *
 * Les dates sont des JOURS CIVILS DE PARIS, chaînes « AAAA-MM-JJ », comparées comme des chaînes
 * (jamais des instants : ni `minuitParisUtc`, ni `finDeJourneeParis`).
 */
import { createHash } from "node:crypto";

import { formulesInterdites } from "./challenge-textes-interdits";

export const PRODUITS_CHALLENGE = ["journee-ia"] as const;
export const CRITERES_CHALLENGE = ["facturees_dans_la_periode"] as const;
export type ProduitChallenge = (typeof PRODUITS_CHALLENGE)[number];
export type CritereChallenge = (typeof CRITERES_CHALLENGE)[number];
export type StatutChallenge = "brouillon" | "publie" | "archive";

export const LIBELLE_PRODUIT: Record<ProduitChallenge, string> = { "journee-ia": "Journée IA" };
const LIBELLE_PRODUIT_PLURIEL: Record<ProduitChallenge, string> = { "journee-ia": "Journées IA" };
export const LIBELLE_CRITERE: Record<CritereChallenge, string> = {
  facturees_dans_la_periode: "Facturées dans la période",
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const PRIME_MAX_CENTS = 100_000_000; // 1 000 000 € : très au-dessous de la borne INT4

/** Vrai pour un vrai jour du calendrier (« 2026-02-30 » est faux). */
export function jourValide(j: string): boolean {
  if (!JOUR.test(j)) return false;
  const d = new Date(`${j}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === j;
}

/** « 2 000 », « 2000,50 », « 2 000.5 » → centimes ; null si illisible ou ≤ 0. */
export function eurosVersCentimes(brut: string): number | null {
  const s = brut
    .replace(/[\s  ]/g, "")
    .replace(",", ".")
    .replace(/€$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents <= PRIME_MAX_CENTS ? cents : null;
}

export interface SaisieChallenge {
  titre: string;
  debutLe: string;
  finLe: string;
  paiementJusquAu: string | null;
  produit: ProduitChallenge;
  critere: CritereChallenge;
  seuil: number;
  primeHtCents: number;
  reglement: string;
}

export type ResultatSaisie =
  { ok: true; valeur: SaisieChallenge } | { ok: false; erreurs: string[] };

/** Contrôle de la saisie de la console (texte brut du formulaire). */
export function validerSaisie(brut: Record<string, string | undefined>): ResultatSaisie {
  const erreurs: string[] = [];
  const t = (k: string) => (brut[k] ?? "").trim();
  const titre = t("titre");
  if (!titre) erreurs.push("Le titre est obligatoire.");
  else if (titre.length > 120) erreurs.push("Le titre fait 120 caractères au plus.");

  const debutLe = t("debutLe");
  const finLe = t("finLe");
  const paiement = t("paiementJusquAu");
  if (!jourValide(debutLe)) erreurs.push("Le premier jour n'est pas une date valide.");
  if (!jourValide(finLe)) erreurs.push("Le dernier jour n'est pas une date valide.");
  if (jourValide(debutLe) && jourValide(finLe) && finLe < debutLe)
    erreurs.push("Le dernier jour ne peut pas précéder le premier.");
  if (paiement !== "") {
    if (!jourValide(paiement)) erreurs.push("La date limite de paiement n'est pas valide.");
    else if (jourValide(finLe) && paiement < finLe)
      erreurs.push("La date limite de paiement ne peut pas précéder le dernier jour.");
  }

  const produit = t("produit");
  if (!(PRODUITS_CHALLENGE as readonly string[]).includes(produit))
    erreurs.push("Choisissez un produit de la liste.");
  const critere = t("critere");
  if (!(CRITERES_CHALLENGE as readonly string[]).includes(critere))
    erreurs.push("Choisissez le critère de la liste.");

  const seuil = Number(t("seuil"));
  if (!Number.isInteger(seuil) || seuil < 1 || seuil > 999)
    erreurs.push("Le seuil est un entier de 1 à 999.");

  const primeHtCents = eurosVersCentimes(t("primeHt"));
  if (primeHtCents === null) erreurs.push("La prime est un montant en euros, supérieur à 0.");

  // Le règlement garde ses retours à la ligne : seulement les bords sont nettoyés.
  const reglement = (brut["reglement"] ?? "").trim();
  if (!reglement) erreurs.push("Le règlement est obligatoire.");
  else if (reglement.length > 20_000)
    erreurs.push("Le règlement est trop long (20 000 caractères).");

  for (const [nom, texte] of [
    ["titre", titre],
    ["règlement", reglement],
  ] as const) {
    const trouvees = formulesInterdites(texte);
    if (trouvees.length)
      erreurs.push(
        `Le ${nom} contient une formule de pression ou interdite : ${trouvees.join(", ")}. Un challenge est une invitation libre.`,
      );
  }

  if (erreurs.length || primeHtCents === null) return { ok: false, erreurs };
  return {
    ok: true,
    valeur: {
      titre,
      debutLe,
      finLe,
      paiementJusquAu: paiement === "" ? null : paiement,
      produit: produit as ProduitChallenge,
      critere: critere as CritereChallenge,
      seuil,
      primeHtCents,
      reglement,
    },
  };
}

type RegleFigee = Pick<
  SaisieChallenge,
  | "titre"
  | "debutLe"
  | "finLe"
  | "paiementJusquAu"
  | "produit"
  | "critere"
  | "seuil"
  | "primeHtCents"
  | "reglement"
>;

/**
 * Empreinte SHA-256 (hexadécimal) de la règle COMPLÈTE, posée à la publication : forme canonique
 * (JSON à clés ordonnées) du titre, des dates, du produit, du critère, du seuil, de la prime et
 * du règlement. Ce que l'encart affiche et ce que le calcul de la prime lira est couvert.
 */
export function empreinteChallenge(c: RegleFigee): string {
  const canonique = JSON.stringify({
    titre: c.titre,
    debutLe: c.debutLe,
    finLe: c.finLe,
    paiementJusquAu: c.paiementJusquAu ?? null,
    produit: c.produit,
    critere: c.critere,
    seuil: c.seuil,
    primeHtCents: c.primeHtCents,
    reglement: c.reglement,
  });
  return createHash("sha256").update(canonique, "utf8").digest("hex");
}

/** Vrai si l'empreinte enregistrée est celle de la règle telle qu'elle est lue maintenant. */
export function verifierEmpreinteChallenge(
  c: RegleFigee & { reglementSha256: string | null },
): boolean {
  return c.reglementSha256 !== null && c.reglementSha256 === empreinteChallenge(c);
}

/** Deux périodes (bornes incluses) se recouvrent-elles ? */
export function periodesSeChevauchent(
  a: { debutLe: string; finLe: string },
  b: { debutLe: string; finLe: string },
): boolean {
  return a.debutLe <= b.finLe && b.debutLe <= a.finLe;
}

export type EtatListe = "brouillon" | "a_venir" | "en_cours" | "passe" | "archive";

/** Le classement de la liste de la console, au jour de Paris `aujourdhui`. */
export function etatDansLaListe(
  c: { statut: StatutChallenge; debutLe: string; finLe: string },
  aujourdhui: string,
): EtatListe {
  if (c.statut === "brouillon") return "brouillon";
  if (c.statut === "archive") return "archive";
  if (aujourdhui < c.debutLe) return "a_venir";
  if (aujourdhui > c.finLe) return "passe";
  return "en_cours";
}

/** L'encart de l'espace : publié ET jour de Paris dans la période (bornes incluses). */
export function encartVisible(
  c: { statut: StatutChallenge; debutLe: string; finLe: string },
  aujourdhui: string,
): boolean {
  return c.statut === "publie" && c.debutLe <= aujourdhui && aujourdhui <= c.finLe;
}

/**
 * La page du règlement : publié (ou archivé après publication), à partir du premier jour. Reste
 * lisible après la fin et après l'archivage : c'est le texte qui fonde la prime.
 */
export function reglementVisible(
  c: { statut: StatutChallenge; debutLe: string },
  aujourdhui: string,
): boolean {
  return (c.statut === "publie" || c.statut === "archive") && c.debutLe <= aujourdhui;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const NOMBRES = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
  "vingt",
];

/** « 1er décembre 2026 » (sans l'année si `avecAnnee` est faux). */
function jourEnLettres(j: string, avecAnnee: boolean): string {
  const [a, m, d] = j.split("-").map(Number) as [number, number, number];
  return `${d === 1 ? "1er" : String(d)} ${MOIS[m - 1]}${avecAnnee ? ` ${a}` : ""}`;
}

/** « entre le 1er et le 31 décembre 2026 » ou « entre le 15 novembre 2026 et le 15 janvier 2027 ». */
export function periodeEnLettres(debutLe: string, finLe: string): string {
  const [a1, m1] = debutLe.split("-");
  const [a2, m2] = finLe.split("-");
  if (a1 === a2 && m1 === m2) {
    const [, , d1] = debutLe.split("-").map(Number) as [number, number, number];
    return `entre le ${d1 === 1 ? "1er" : d1} et le ${jourEnLettres(finLe, true)}`;
  }
  return `entre le ${jourEnLettres(debutLe, true)} et le ${jourEnLettres(finLe, true)}`;
}

export function nombreEnLettres(n: number): string {
  return n >= 0 && n <= 20 ? NOMBRES[n]! : String(n);
}

/** « 2 000 € » à partir des centimes (espace insécable de `toLocaleString` normalisée en espace). */
export function montantEnLettres(cents: number): string {
  const v = (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${v.replace(/[  ]/g, " ")} €`;
}

/** Les phrases de l'encart de l'espace (§ 9.2 du plan, à relire par le dirigeant). */
export function phrasesDeLEncart(c: {
  produit: ProduitChallenge;
  seuil: number;
  primeHtCents: number;
  debutLe: string;
  finLe: string;
}): { principale: string; rassurance: string } {
  const produit =
    c.seuil === 1
      ? `une ${LIBELLE_PRODUIT[c.produit]} a été facturée`
      : `${nombreEnLettres(c.seuil)} ${LIBELLE_PRODUIT_PLURIEL[c.produit]} ont été facturées`;
  return {
    principale: `Une prime de ${montantEnLettres(c.primeHtCents)} HT est versée à tout apporteur pour qui ${produit} ${periodeEnLettres(c.debutLe, c.finLe)}, à des entreprises qui lui sont attribuées selon son contrat.`,
    rassurance:
      "Rien n'est attendu de vous : ne pas l'obtenir ne change rien à votre contrat ni à vos commissions.",
  };
}
