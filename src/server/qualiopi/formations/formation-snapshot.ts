/**
 * Qualiopi — Snapshot légal Formation → TrainingSession (WS5).
 *
 * Problème :
 *   Les documents légaux (convention, convention tripartite, contrat,
 *   attestation, facture) lisaient la Formation EN LIVE au moment de leur
 *   génération. Si la formation évoluait après la session (titre, objectifs,
 *   durée, programme), les documents émis pour cette session divergeaient de la
 *   prestation réellement vendue/livrée → preuve Qualiopi falsifiée.
 *
 * Solution :
 *   À la création de la session, on FIGE les champs engageants de la formation
 *   dans `TrainingSession.formationSnapshot`. Les générateurs de documents lisent
 *   ce snapshot EN PRIORITÉ (`readFormationForDocs`), avec repli sur la lecture
 *   LIVE pour les sessions créées avant WS5 (snapshot null).
 *
 * Helpers purs (aucune I/O) — testables et réutilisables côté action.
 */

/** Champs Formation à sélectionner pour bâtir un snapshot (Prisma `select`). */
export const FORMATION_SNAPSHOT_SELECT = {
  titre: true,
  dureeHeures: true,
  modalite: true,
  objectifsPedagogiques: true,
  programmeDetaille: true,
  methodesPedagogiques: true,
  certificationType: true,
  versionProgramme: true,
} as const;

/** Forme d'une Formation suffisante pour bâtir un snapshot (sous-ensemble). */
export interface FormationSnapshotSource {
  titre: string;
  dureeHeures: number;
  modalite?: string | null;
  objectifsPedagogiques?: unknown;
  programmeDetaille?: unknown;
  methodesPedagogiques?: string | null;
  certificationType?: string | null;
  versionProgramme?: string | null;
}

/** Snapshot figé persisté dans `TrainingSession.formationSnapshot`. */
export interface FormationSnapshot {
  /** Version du schéma de snapshot (évolutions futures). */
  v: 1;
  titre: string;
  dureeHeures: number;
  modalite: string | null;
  objectifsPedagogiques: unknown;
  programmeDetaille: unknown;
  methodesPedagogiques: string | null;
  certificationType: string | null;
  versionProgramme: string | null;
  /** Horodatage ISO de capture. */
  capturedAt: string;
}

/** Construit le snapshot figé d'une formation à un instant donné. */
export function buildFormationSnapshot(
  formation: FormationSnapshotSource,
  capturedAt: Date,
): FormationSnapshot {
  return {
    v: 1,
    titre: formation.titre,
    dureeHeures: formation.dureeHeures,
    modalite: formation.modalite ?? null,
    objectifsPedagogiques: formation.objectifsPedagogiques ?? null,
    programmeDetaille: formation.programmeDetaille ?? null,
    methodesPedagogiques: formation.methodesPedagogiques ?? null,
    certificationType: formation.certificationType ?? null,
    versionProgramme: formation.versionProgramme ?? null,
    capturedAt: capturedAt.toISOString(),
  };
}

/** Champs résolus pour la génération d'un document légal. */
export interface ResolvedFormationForDocs {
  titre: string | null;
  dureeHeures: number | null;
  objectifsPedagogiques: unknown;
  programmeDetaille: unknown;
  methodesPedagogiques: string | null;
  /** Provenance — utile pour l'observabilité/tests. */
  source: "snapshot" | "live";
}

/** Forme LIVE minimale d'une Formation pour le repli (tous champs optionnels). */
export interface LiveFormationForDocs {
  titre?: string | null;
  dureeHeures?: number | null;
  objectifsPedagogiques?: unknown;
  programmeDetaille?: unknown;
  methodesPedagogiques?: string | null;
}

/**
 * Un snapshot est exploitable s'il s'agit d'un objet portant au minimum un
 * `titre` exploitable (les champs engageants ont été capturés).
 */
function isUsableSnapshot(value: unknown): value is FormationSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { titre?: unknown }).titre === "string"
  );
}

/**
 * Résout les champs Formation pour un document légal : snapshot EN PRIORITÉ,
 * sinon repli sur la lecture LIVE (session legacy sans snapshot).
 */
export function readFormationForDocs(
  snapshot: unknown,
  live: LiveFormationForDocs | null | undefined,
): ResolvedFormationForDocs {
  if (isUsableSnapshot(snapshot)) {
    return {
      titre: snapshot.titre ?? null,
      dureeHeures: typeof snapshot.dureeHeures === "number" ? snapshot.dureeHeures : null,
      objectifsPedagogiques: snapshot.objectifsPedagogiques ?? null,
      programmeDetaille: snapshot.programmeDetaille ?? null,
      methodesPedagogiques: snapshot.methodesPedagogiques ?? null,
      source: "snapshot",
    };
  }
  return {
    titre: live?.titre ?? null,
    dureeHeures: typeof live?.dureeHeures === "number" ? live.dureeHeures : null,
    objectifsPedagogiques: live?.objectifsPedagogiques ?? null,
    programmeDetaille: live?.programmeDetaille ?? null,
    methodesPedagogiques: live?.methodesPedagogiques ?? null,
    source: "live",
  };
}
