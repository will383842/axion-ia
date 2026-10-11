/**
 * Formateurs indépendants — RÈGLES du contrôle registre (lot L4, ADR 0066
 * étape 6 et (i)).
 *
 * Module PUR : aucune lecture en base, aucun appel réseau. Le verdict se forme
 * sur ce que le registre a répondu ; l'écrivain (`controle.ts`) interroge, juge
 * ici, puis inscrit la preuve.
 *
 * Quatre vérifications : SIREN ACTIF, établissement OUVERT, activité
 * cohérente, numéro de déclaration d'activité PRÉSENT sur la liste publique des
 * organismes de formation AU MÊME SIREN.
 *
 * 🔴 Une absence de réponse n'est JAMAIS une conclusion (ADR 0066 (i)) : un
 * registre muet donne « à contrôler » (orange), jamais « entreprise fermée » ni
 * « numéro caduc », et jamais vert.
 */

import type { VerdictRegistre } from "../../../../prisma/generated/client";

import { FENETRE_ENVOI_PAR_DEFAUT, dansFenetreEnvoi } from "@/lib/relances/campagne";

/** Ce que le registre des entreprises dit du SIREN et de l'établissement. */
export interface FaitsEntreprise {
  readonly siren: string;
  /** `A` = actif, `C` = cessé ; `null` = non dit. */
  readonly etatAdministratif: "A" | "C" | null;
  /** Code NAF (« 85.59A » ou « 8559A »). */
  readonly naf: string | null;
  /** L'établissement du SIRET déclaré ; `null` = introuvable dans la réponse. */
  readonly etablissement: { readonly siret: string; readonly ouvert: boolean | null } | null;
}

/** Ce que la liste publique des organismes de formation dit. */
export interface FaitsListeOF {
  /** Numéros de déclaration listés pour CE SIREN. */
  readonly ndaDuSiren: ReadonlyArray<string>;
  /** SIREN qui porte le numéro déclaré, s'il est listé ailleurs. */
  readonly sirenDuNda: string | null;
}

export interface EntreeControle {
  readonly siret: string | null;
  /** Numéro saisi par le formateur, tel quel (« en cours » compris). */
  readonly nda: string | null;
  /** `null` = registre muet (panne, délai, réponse illisible). */
  readonly entreprise: FaitsEntreprise | null;
  /** `null` = liste publique muette. */
  readonly listeOF: FaitsListeOF | null;
}

export type MotifControle =
  | "siret_absent"
  | "registre_muet"
  | "siren_cesse"
  | "etablissement_introuvable"
  | "etablissement_ferme"
  | "activite_a_controler"
  | "nda_absent"
  | "nda_en_cours"
  | "liste_of_muette"
  | "nda_hors_liste"
  | "nda_autre_siren";

/** Motifs qui font un ROUGE : un fait positif du registre, jamais un silence. */
const MOTIFS_ROUGES: ReadonlySet<MotifControle> = new Set([
  "siren_cesse",
  "etablissement_ferme",
  "nda_autre_siren",
]);

/** Libellés de console. L'orange s'affiche « À contrôler » (mot des apporteurs). */
export const LIBELLES_MOTIFS: Readonly<Record<MotifControle, string>> = {
  siret_absent: "SIRET non renseigné : à contrôler.",
  registre_muet: "Le registre des entreprises n'a pas répondu : à contrôler.",
  siren_cesse: "L'entreprise est cessée au registre.",
  etablissement_introuvable: "L'établissement déclaré n'apparaît pas au registre : à contrôler.",
  etablissement_ferme: "L'établissement déclaré est fermé au registre.",
  activite_a_controler:
    "L'activité déclarée au registre n'est pas une activité de formation : à contrôler.",
  nda_absent: "Numéro de déclaration d'activité non renseigné : à contrôler.",
  nda_en_cours: "Numéro de déclaration d'activité en cours d'attribution : à contrôler.",
  liste_of_muette: "La liste publique des organismes de formation n'a pas répondu : à contrôler.",
  nda_hors_liste:
    "Le numéro de déclaration n'apparaît pas encore sur la liste publique : à contrôler.",
  nda_autre_siren: "Le numéro de déclaration est inscrit au nom d'une autre entreprise.",
};

export const LIBELLES_VERDICT: Readonly<Record<VerdictRegistre, string>> = {
  vert: "Conforme",
  orange: "À contrôler",
  rouge: "Non conforme",
};

/**
 * Préfixes NAF d'une activité de formation ou de conseil proche. Hors liste =
 * orange (« à contrôler »), jamais rouge : un code NAF mal choisi n'est pas
 * une fraude.
 */
const NAF_COHERENTS = ["85.5", "85.6", "70.2", "62.0", "63.1", "73.1", "74.9", "82.3", "90.0"];

function nafNormalise(naf: string): string {
  const s = naf.replace(/\s+/g, "").toUpperCase();
  return /^\d{4}[A-Z]$/.test(s) ? `${s.slice(0, 2)}.${s.slice(2)}` : s;
}

export function activiteCoherente(naf: string | null): boolean {
  if (naf === null || naf.trim() === "") return false;
  const n = nafNormalise(naf);
  return NAF_COHERENTS.some((p) => n.startsWith(p));
}

/** Numéro de déclaration d'activité : 11 chiffres, sinon `null`. */
export function normaliserNda(brut: string | null | undefined): string | null {
  if (typeof brut !== "string") return null;
  const chiffres = brut.replace(/[\s.-]/g, "");
  return /^\d{11}$/.test(chiffres) ? chiffres : null;
}

function ndaEnCours(brut: string | null): boolean {
  return typeof brut === "string" && /en\s*cours/i.test(brut);
}

export interface VerdictControle {
  readonly verdict: VerdictRegistre;
  readonly motifs: ReadonlyArray<MotifControle>;
  /** Le numéro déclaré est vu sur la liste publique, au même SIREN. */
  readonly ndaSurLaListe: boolean;
}

export function jugerControleRegistre(e: EntreeControle): VerdictControle {
  const motifs: MotifControle[] = [];
  const siret = (e.siret ?? "").replace(/\s+/g, "");
  if (!/^\d{14}$/.test(siret)) motifs.push("siret_absent");

  const ent = e.entreprise;
  if (ent === null) {
    motifs.push("registre_muet");
  } else {
    if (ent.etatAdministratif === "C") motifs.push("siren_cesse");
    else if (ent.etatAdministratif !== "A") motifs.push("registre_muet");
    if (ent.etablissement === null || ent.etablissement.siret !== siret) {
      motifs.push("etablissement_introuvable");
    } else if (ent.etablissement.ouvert === false) {
      motifs.push("etablissement_ferme");
    } else if (ent.etablissement.ouvert !== true) {
      motifs.push("etablissement_introuvable");
    }
    if (!activiteCoherente(ent.naf)) motifs.push("activite_a_controler");
  }

  const nda = normaliserNda(e.nda);
  let ndaSurLaListe = false;
  if (nda === null) {
    motifs.push(ndaEnCours(e.nda) ? "nda_en_cours" : "nda_absent");
  } else if (e.listeOF === null) {
    motifs.push("liste_of_muette");
  } else {
    const sirenDeclare = ent?.siren ?? (siret.length === 14 ? siret.slice(0, 9) : null);
    const listes = e.listeOF.ndaDuSiren.map((n) => normaliserNda(n)).filter((n) => n !== null);
    if (sirenDeclare !== null && listes.includes(nda)) {
      ndaSurLaListe = true;
    } else if (
      e.listeOF.sirenDuNda !== null &&
      sirenDeclare !== null &&
      e.listeOF.sirenDuNda !== sirenDeclare
    ) {
      motifs.push("nda_autre_siren");
    } else {
      motifs.push("nda_hors_liste");
    }
  }

  const verdict: VerdictRegistre = motifs.some((m) => MOTIFS_ROUGES.has(m))
    ? "rouge"
    : motifs.length > 0
      ? "orange"
      : "vert";
  return { verdict, motifs, ndaSurLaListe };
}

// ─── Ce que vaut le dernier contrôle ────────────────────────────────────────

/** Un contrôle compte 30 jours (ADR 0066 (d) 2 : « relu il y a un mois au plus »). */
export const FRAICHEUR_CONTROLE_JOURS = 30;
/** Le contrôle périodique repasse au-delà de 25 jours : jamais de trou au-delà de 30 (K-4). */
export const DELAI_RECONTROLE_JOURS = 25;
/**
 * Source d'une ligne qui VALIDE un orange (K-2). Elle reprend la date du
 * contrôle validé : un orange validé vaut un vert, aux mêmes dates.
 */
export const SOURCE_VALIDATION_ORANGE = "validation_administrateur";

const JOUR_MS = 24 * 3600 * 1000;

export interface LigneControle {
  readonly verdict: VerdictRegistre;
  readonly source: string;
  readonly verifieAt: Date;
  readonly createdAt: Date;
}

export type StatutControle = "aucun" | "vert" | "orange_a_valider" | "orange_valide" | "rouge";

export interface EtatControle {
  readonly statut: StatutControle;
  /** Date de contrôle retenue (celle du contrôle validé pour un orange validé). */
  readonly dernierAt: Date | null;
  /** Vert ou orange validé, de moins de 30 jours. */
  readonly probant: boolean;
}

/** L'état d'un formateur d'après ses lignes de contrôle (ordre indifférent). */
export function etatControle(lignes: ReadonlyArray<LigneControle>, maintenant: Date): EtatControle {
  if (lignes.length === 0) return { statut: "aucun", dernierAt: null, probant: false };
  // La DERNIÈRE inscrite décide : une validation s'inscrit après son contrôle.
  const derniere = [...lignes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
  let statut: StatutControle;
  if (derniere.verdict === "rouge") statut = "rouge";
  else if (derniere.verdict === "vert") statut = "vert";
  else statut = derniere.source === SOURCE_VALIDATION_ORANGE ? "orange_valide" : "orange_a_valider";
  const at = derniere.verifieAt;
  const frais =
    !Number.isNaN(at.getTime()) &&
    at.getTime() <= maintenant.getTime() &&
    maintenant.getTime() - at.getTime() <= FRAICHEUR_CONTROLE_JOURS * JOUR_MS;
  return {
    statut,
    dernierAt: at,
    probant: frais && (statut === "vert" || statut === "orange_valide"),
  };
}

/** Faut-il recontrôler un formateur actif ? */
export function aRecontroler(dernierControleAt: Date | null, maintenant: Date): boolean {
  if (dernierControleAt === null || Number.isNaN(dernierControleAt.getTime())) return true;
  return maintenant.getTime() - dernierControleAt.getTime() > DELAI_RECONTROLE_JOURS * JOUR_MS;
}

/** Le passage périodique ne tourne qu'entre 8 h et 19 h, heure de Paris (fenêtre commune). */
export function dansLaPlageDuPassage(maintenant: Date): boolean {
  return dansFenetreEnvoi(maintenant, FENETRE_ENVOI_PAR_DEFAUT);
}
