/**
 * Dossier en ligne de l'apporteur — les règles de la SIGNATURE, en fonctions pures.
 *
 * ⚠️ Module PUR et sans import serveur : il est lu par la page publique (composant
 * client, pour activer le bouton « Signer mon contrat ») ET par la fonction serveur de
 * signature (`signature.ts`), qui revérifie tout. Le navigateur ne décide jamais seul.
 */

// Import de TYPE seul : effacé à la compilation, il n'embarque pas le module serveur.
import type { ValeursContrat } from "./contrat-pdf";
import {
  ACCEPTATIONS,
  APPROCHE_VIGILANCE_CENTS,
  DECLARATIONS,
  MOTIFS_A_RETRANSMETTRE,
  manquesPourSigner,
  type TypePiece,
} from "./regles";

export type StatutDossier =
  | "dossier_en_cours"
  | "a_verifier"
  | "a_completer"
  | "signe"
  | "refuse"
  | "resilie";

// ── États de la page ─────────────────────────────────────────────────────

/**
 * Ce que montre la page publique pour un statut :
 * - `modifiable` : le parcours en 4 étapes (dossier en cours, ou à compléter) ;
 * - `a_verifier` : « Dossier reçu », rien ne se modifie ;
 * - `signe` : « Votre contrat est signé », dépôt des pièces de vigilance ;
 * - `neutre` : refusé ou résilié → la même page neutre qu'un lien faux.
 */
export type EtatPage = "modifiable" | "a_verifier" | "signe" | "neutre";

export function etatDeLaPage(statut: StatutDossier): EtatPage {
  switch (statut) {
    case "dossier_en_cours":
    case "a_completer":
      return "modifiable";
    case "a_verifier":
      return "a_verifier";
    case "signe":
      return "signe";
    default:
      return "neutre";
  }
}

/**
 * Les pièces de vigilance (attestation URSSAF, extrait d'immatriculation) sont-elles
 * DEMANDÉES à l'apporteur ? Seulement à l'approche du seuil (cumul déjà dû), ou si des
 * commissions attendent ces pièces, ou s'il en a déjà déposé. Avant, la page « signé » ne
 * dit pas « déposez » : il n'y a rien à déposer.
 */
export function vigilanceDemandee(e: {
  cumulCents: number;
  enAttente: boolean;
  piecesDeposees: number;
}): boolean {
  return e.enAttente || e.piecesDeposees > 0 || e.cumulCents >= APPROCHE_VIGILANCE_CENTS;
}

/** Types de pièces que l'apporteur peut déposer, selon l'état de son dossier. */
export function piecesDeposables(etat: EtatPage): readonly TypePiece[] {
  if (etat === "modifiable") return ["identite", "rib", "rc_pro"];
  if (etat === "signe") return ["vigilance", "immatriculation"];
  return [];
}

// ── Pièces ───────────────────────────────────────────────────────────────

interface PieceLue {
  type: TypePiece;
  statut: "deposee" | "conforme" | "a_retransmettre";
}

/** Les pièces qui comptent comme déposées : une pièce « à retransmettre » ne compte pas. */
export function typesDeposes(pieces: readonly PieceLue[]): TypePiece[] {
  return pieces.filter((p) => p.statut !== "a_retransmettre").map((p) => p.type);
}

export function libelleMotif(motif: string | null): string {
  return MOTIFS_A_RETRANSMETTRE.find((m) => m.valeur === motif)?.libelle ?? "à remplacer";
}

/** Ce qui manque pour signer, lu dans le dossier tel que la page le voit (IBAN masqué). */
export function manquesDuDossier(d: {
  siren: string | null;
  statutJuridique: string | null;
  regimeTva: "franchise_293b" | "assujetti" | null;
  numeroTva: string | null;
  ibanSaisi: boolean;
  pieces: readonly PieceLue[];
}): string[] {
  return manquesPourSigner({
    siren: d.siren,
    statutJuridique: d.statutJuridique,
    regimeTva: d.regimeTva,
    numeroTva: d.numeroTva,
    iban: d.ibanSaisi ? "saisi" : null,
    piecesDeposees: typesDeposes(d.pieces),
  });
}

// ── Nom tapé ─────────────────────────────────────────────────────────────

/** « Éloïse  D'Arc-Lefèvre » → « eloise d arc lefevre » : sans accents, sans casse. */
export function normaliserNom(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-'’.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Le nom tapé correspond-il au prénom et au nom du dossier (dans un ordre ou l'autre) ? */
export function nomTapeCorrespond(tape: string, prenom: string, nom: string): boolean {
  const t = normaliserNom(tape);
  const p = normaliserNom(prenom);
  const n = normaliserNom(nom);
  if (!t || !p || !n) return false;
  return t === `${p} ${n}` || t === `${n} ${p}`;
}

/**
 * Étape 1 : un nom d'UN SEUL MOT (prénom seul) laisse `nom` vide et la signature est
 * impossible. L'apporteur peut alors compléter son nom ; on ne l'accepte que si le
 * dossier n'en a pas déjà un (le serveur ne laisse jamais réécrire un nom connu).
 * Rend le nom nettoyé, ou `null` s'il ne faut rien écrire.
 */
export function nomAjoutable(
  nomDuDossier: string,
  saisi: string | null | undefined,
): string | null {
  if (nomDuDossier.trim() !== "") return null;
  const propre = (saisi ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return propre === "" ? null : propre;
}

/** Marqueur, dans le JSON `declarations`, d'une admission non jugée (registre muet). */
export const CLE_REGISTRE_INDISPONIBLE = "_registre_indisponible";

// ── Cases ────────────────────────────────────────────────────────────────

export const CLES_DECLARATIONS: readonly string[] = DECLARATIONS.map((d) => d.cle);
export const CLES_ACCEPTATIONS: readonly string[] = ACCEPTATIONS.map((a) => a.cle);

/** Ne garde que les clés connues, dans l'ordre du contrat, sans doublon. */
export function casesConnues(cochees: readonly string[], reference: readonly string[]): string[] {
  const s = new Set(cochees);
  return reference.filter((c) => s.has(c));
}

/** Les 4 déclarations et les 6 acceptations sont-elles TOUTES cochées ? */
export function casesCompletes(
  declarations: readonly string[],
  acceptations: readonly string[],
): boolean {
  return (
    casesConnues(declarations, CLES_DECLARATIONS).length === CLES_DECLARATIONS.length &&
    casesConnues(acceptations, CLES_ACCEPTATIONS).length === CLES_ACCEPTATIONS.length
  );
}

// ── Contrôle complet avant signature ─────────────────────────────────────

export type RefusSignature = "non_modifiable" | "incomplet" | "cases" | "nom";

export const LIBELLE_REFUS_SIGNATURE: Readonly<Record<RefusSignature, string>> = {
  non_modifiable: "Ce dossier ne peut plus être signé depuis ce lien.",
  incomplet: "Votre dossier n'est pas encore complet.",
  cases: "Cochez toutes les cases avant de signer.",
  nom: "Le nom du signataire ne correspond pas au dossier : écrivez-nous avant de signer.",
};

export function verifierAvantSignature(e: {
  statut: StatutDossier;
  manques: readonly string[];
  declarations: readonly string[];
  acceptations: readonly string[];
  nomTape: string;
  prenom: string;
  nom: string;
}): { ok: true } | { ok: false; refus: RefusSignature } {
  if (etatDeLaPage(e.statut) !== "modifiable") return { ok: false, refus: "non_modifiable" };
  if (e.manques.length > 0) return { ok: false, refus: "incomplet" };
  if (!casesCompletes(e.declarations, e.acceptations)) return { ok: false, refus: "cases" };
  if (!nomTapeCorrespond(e.nomTape, e.prenom, e.nom)) return { ok: false, refus: "nom" };
  return { ok: true };
}

// ── Valeurs du contrat ───────────────────────────────────────────────────

const A_COMPLETER = "[à compléter]";

/** « 5 octobre 2026 », à Paris. */
export function dateFrancaise(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** « 5 octobre 2026 à 14 h 32 (heure de Paris) ». */
export function dateHeureParis(d: Date): string {
  const heure = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(":", " h ");
  return `${dateFrancaise(d)} à ${heure} (heure de Paris)`;
}

/** Société (SAS, SARL…) et non entrepreneur individuel. */
export function estSociete(statut: string): boolean {
  return statut !== "micro_entrepreneur" && statut !== "entrepreneur_individuel";
}

/** La qualité au sens de l'art. 14 (copie de `qualiteDuStatut`, module pur). */
function qualite(statut: string): string {
  return estSociete(statut) ? "société commerciale" : "entrepreneur individuel";
}

/**
 * Les valeurs qui remplissent le contrat. Identité = prénom + NOM ; siège = adresse
 * déclarée ; grille datée du jour. Une valeur absente s'affiche « [à compléter] »
 * (aperçu seulement : on ne signe qu'un dossier complet).
 */
export function valeursDuContrat(
  d: {
    prenom: string;
    nom: string;
    statutJuridique: string | null;
    siren: string | null;
    /** SIRET de l'établissement ; l'adresse est alors celle de l'établissement. */
    siret?: string | null;
    adresse: string | null;
    /** Dénomination au registre ; ne sert que pour une société (contrat 2.5). */
    denomination?: string | null;
  },
  le: Date,
): ValeursContrat {
  const identite = `${d.prenom.trim()} ${d.nom.trim().toLocaleUpperCase("fr-FR")}`.trim();
  const denomination =
    d.statutJuridique && estSociete(d.statutJuridique) ? d.denomination?.trim() || null : null;
  return {
    ...(denomination ? { denomination } : {}),
    identite: identite || A_COMPLETER,
    statutJuridique: d.statutJuridique ?? A_COMPLETER,
    siren: d.siren ?? A_COMPLETER,
    ...(d.siret ? { siret: d.siret } : {}),
    siege: d.adresse?.trim() || A_COMPLETER,
    qualite: d.statutJuridique ? qualite(d.statutJuridique) : A_COMPLETER,
    grilleDate: dateFrancaise(le),
  };
}

/** Clé R2 du contrat signé par l'apporteur. */
export function cleContratApporteur(apporteurId: string, sha256: string): string {
  return `apporteurs/${apporteurId}/contrat-v2-apporteur-${sha256.slice(0, 8)}.pdf`;
}

/** « Chrome sur Android », « Safari sur iPhone »… ; jamais l'agent complet. */
export function resumerNavigateur(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const nav = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Navigateur inconnu";
  const sys = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  return sys ? `${nav} sur ${sys}` : nav;
}
