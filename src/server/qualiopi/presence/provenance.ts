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
 *   · présent ET rattaché à un relevé archivé (`importId`) → relevé de connexion ;
 *   · présent sans l'un ni l'autre → déclaration manuelle, quelle que soit la
 *     source écrite ;
 *   · ABSENT sans signature → aucune présence, même rattaché à un relevé.
 *
 * ⚠️ Revue A09 (2026-09-14), constat 1 : le test sur `importId` passait AVANT
 * celui sur `present`. Un stagiaire absent du relevé (0 min) ressortait donc
 * « présence issue d'un relevé » dans le dossier d'audit — le même défaut que
 * celui corrigé ici, transposé au distanciel. Une absence n'est une présence
 * sous aucune provenance.
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
  /**
   * Horodatage de la plus ancienne signature VIVANTE du créneau, lu au registre
   * (`EmargementSignature.signeAt`). Absent quand l'appelant ne le lit pas (le
   * dossier d'audit ne compte que les provenances).
   */
  readonly premiereSignatureAt?: Date | null;
}

export function provenanceCreneau(c: CreneauProvenance): ProvenancePresence {
  if (c.signaturesVivantes > 0) return "signature";
  if (!c.present) return "aucune";
  return c.importId !== null ? "releve_connexion" : "declaration_manuelle";
}

export interface ResumeProvenance {
  /** Créneaux portant une signature vivante. */
  readonly signees: number;
  /** Créneaux marqués présents SANS signature ni relevé : déclarations. */
  readonly declarees: number;
  /** Créneaux présents, rattachés à un relevé de connexion importé. */
  readonly releveConnexion: number;
  /** Plus ancienne signature vivante, lue au registre — `null` si inconnue. */
  readonly premiereSignatureAt: Date | null;
}

export function resumerProvenance(creneaux: ReadonlyArray<CreneauProvenance>): ResumeProvenance {
  let signees = 0;
  let declarees = 0;
  let releveConnexion = 0;
  let premiereSignatureAt: Date | null = null;
  for (const c of creneaux) {
    const p = provenanceCreneau(c);
    if (p === "signature") {
      signees += 1;
      const at = c.premiereSignatureAt ?? null;
      if (at !== null && (premiereSignatureAt === null || at < premiereSignatureAt)) {
        premiereSignatureAt = at;
      }
    } else if (p === "declaration_manuelle") declarees += 1;
    else if (p === "releve_connexion") releveConnexion += 1;
  }
  return { signees, declarees, releveConnexion, premiereSignatureAt };
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

function pluriel(n: number, singulier: string, plurielForme: string): string {
  return `${n} ${n > 1 ? plurielForme : singulier}`;
}

/**
 * Libellé de la colonne « Émargement signé » d'un stagiaire.
 *
 * ⚠️ « Oui » exige que TOUTES les présences comptées soient prouvées — signées
 * ou issues d'un relevé. Revue A09, constat 2 : une seule demi-journée signée
 * suffisait à afficher « Oui » en vert à côté d'un taux de 100 % dont cinq
 * demi-journées sur six étaient tapées à la main. Dès qu'une présence n'est que
 * déclarée, l'écran donne la RÉPARTITION.
 *
 * ⚠️ La date affichée est celle de la première signature RÉELLE, lue au
 * registre — jamais `emargementSigneAt` telle quelle. Revue A09, constat 3 : la
 * colonne est write-once ; si l'ancienne grille l'a posée avant la première
 * signature, elle porte une date de saisie administrative ANTÉRIEURE à la
 * signature. L'afficher serait antidater. Rien n'est réécrit en base.
 *
 * Une `emargementSigneAt` sans aucune signature — écrite par la grille avant le
 * correctif — n'est ni effacée (ce serait réécrire une donnée d'audit) ni crue :
 * elle est NOMMÉE pour ce qu'elle est.
 */
export function libelleEmargementSigne(input: {
  readonly emargementSigneAt: Date | null;
  readonly resume: ResumeProvenance;
}): LibelleEmargement {
  const { emargementSigneAt, resume } = input;

  if (resume.signees > 0 && resume.declarees > 0) {
    const releve =
      resume.releveConnexion > 0
        ? `, ${pluriel(resume.releveConnexion, "issu d'un relevé", "issus d'un relevé")}`
        : "";
    return {
      ton: "alerte",
      texte: `Partiel — ${pluriel(resume.signees, "créneau signé", "créneaux signés")}${releve}, ${pluriel(resume.declarees, "déclaré", "déclarés")} à la main sans signature`,
    };
  }

  if (resume.signees > 0) {
    return {
      ton: "succes",
      texte:
        resume.premiereSignatureAt !== null ? `Oui — ${dateFR(resume.premiereSignatureAt)}` : "Oui",
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

/**
 * Libellés « Émargement signé » de toutes les inscriptions d'une session, tels
 * que la sous-page Émargement les affiche. Sortis de la page pour être testés
 * sans rendu : l'écran ne fait que lire cette table.
 */
export function libellesEmargementParInscription(
  inscriptions: ReadonlyArray<{ readonly id: string; readonly emargementSigneAt: Date | null }>,
  creneaux: ReadonlyArray<{
    readonly enrollmentId: string;
    readonly present: boolean;
    readonly importId: string | null;
    readonly emargementSignatures: ReadonlyArray<{ readonly signeAt: Date }>;
  }>,
): Map<string, LibelleEmargement> {
  return new Map(
    inscriptions.map((e) => [
      e.id,
      libelleEmargementSigne({
        emargementSigneAt: e.emargementSigneAt,
        resume: resumerProvenance(
          creneaux
            .filter((c) => c.enrollmentId === e.id)
            .map((c) => ({
              present: c.present,
              importId: c.importId,
              signaturesVivantes: c.emargementSignatures.length,
              premiereSignatureAt: c.emargementSignatures.reduce<Date | null>(
                (min, s) => (min === null || s.signeAt < min ? s.signeAt : min),
                null,
              ),
            })),
        ),
      }),
    ]),
  );
}
