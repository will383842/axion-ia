/**
 * Qualiopi — PROVENANCE d'une présence : signée, relevée ou déclarée.
 *
 * ## Pourquoi ce module existe (`G-prerequis-02`, audit initial 2026-09-14)
 *
 * La grille de présence de la console posait `source: "emargement_presentiel"`
 * et `Enrollment.emargementSigneAt` sans qu'aucune signature n'existe. Une case
 * cochée par un administrateur ressortait donc à l'écran (« Émargement signé :
 * Oui »), dans l'indicateur off.12 et dans le dossier d'audit comme la preuve
 * signée d'un stagiaire.
 *
 * Le chemin d'écriture est corrigé (`actions/qualiopi/presence.ts`). Ce module
 * porte la LECTURE : dire, pour chaque créneau, d'où vient la présence.
 *
 * ## 🔑 Le discriminant est une VALEUR, jamais le texte de `source`
 *
 * Les grilles enregistrées AVANT le correctif portent `emargement_presentiel`,
 * exactement comme un créneau signé électroniquement — et `toPresenceSource
 * ("autre")` rend aussi `emargement_presentiel` pour un relevé distanciel. Lire
 * `source` rangerait donc ces présences parmi les émargements, c'est-à-dire
 * reproduirait le défaut à la lecture. On lit ce qui PROUVE :
 *
 *   · une signature vivante (`revokedAt: null`) → présence signée ;
 *   · un rattachement à un relevé archivé (`importId`) → relevé de connexion ;
 *   · présent sans l'un ni l'autre → déclaration manuelle, quelle que soit la
 *     source écrite.
 *
 * Module PUR : aucun accès base, testable sans double.
 */

export type ProvenancePresence =
  "signature" | "releve_connexion" | "declaration_manuelle" | "aucune";

export interface CreneauProvenance {
  readonly present: boolean;
  readonly importId: string | null;
  /** Nombre de signatures NON révoquées portées par le créneau. */
  readonly signaturesVivantes: number;
}

export function provenanceCreneau(c: CreneauProvenance): ProvenancePresence {
  if (c.signaturesVivantes > 0) return "signature";
  if (c.importId !== null) return "releve_connexion";
  return c.present ? "declaration_manuelle" : "aucune";
}

export interface ResumeProvenance {
  /** Créneaux portant une signature vivante. */
  readonly signees: number;
  /** Créneaux marqués présents SANS signature ni relevé : déclarations. */
  readonly declarees: number;
  /** Créneaux rattachés à un relevé de connexion importé. */
  readonly releveConnexion: number;
}

export function resumerProvenance(creneaux: ReadonlyArray<CreneauProvenance>): ResumeProvenance {
  let signees = 0;
  let declarees = 0;
  let releveConnexion = 0;
  for (const c of creneaux) {
    const p = provenanceCreneau(c);
    if (p === "signature") signees += 1;
    else if (p === "declaration_manuelle") declarees += 1;
    else if (p === "releve_connexion") releveConnexion += 1;
  }
  return { signees, declarees, releveConnexion };
}

export interface LibelleEmargement {
  readonly ton: "succes" | "alerte" | "neutre";
  readonly texte: string;
}

function dateFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Libellé de la colonne « Émargement signé » d'un stagiaire.
 *
 * ⚠️ « Oui » exige une signature EN BASE. Une `emargementSigneAt` sans signature
 * — écrite par la grille avant le correctif — n'est ni effacée (ce serait
 * réécrire une donnée d'audit) ni crue : elle est NOMMÉE pour ce qu'elle est.
 */
export function libelleEmargementSigne(input: {
  readonly emargementSigneAt: Date | null;
  readonly resume: ResumeProvenance;
}): LibelleEmargement {
  const { emargementSigneAt, resume } = input;

  if (resume.signees > 0) {
    return {
      ton: "succes",
      texte: emargementSigneAt !== null ? `Oui — ${dateFR(emargementSigneAt)}` : "Oui",
    };
  }

  if (emargementSigneAt !== null) {
    return {
      ton: "alerte",
      texte:
        resume.declarees > 0
          ? `Non — date posée le ${dateFR(emargementSigneAt)} sans signature (présence déclarée à la main)`
          : `Non — date posée le ${dateFR(emargementSigneAt)} sans signature en base`,
    };
  }

  if (resume.declarees > 0) {
    const n = resume.declarees;
    return {
      ton: "alerte",
      texte: `Non — présence déclarée à la main (${n} créneau${n > 1 ? "x" : ""}, sans signature)`,
    };
  }

  return { ton: "neutre", texte: "Non" };
}
