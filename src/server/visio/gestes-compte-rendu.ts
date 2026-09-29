/**
 * Les GESTES DE WILL sur un compte rendu (chantier visio, PR 6) — fonctions
 * de domaine, appelées par les actions serveur de la console
 * (`src/features/dossier-client/compte-rendu-actions.ts`) et par la chaîne
 * de Gate D. Aucune ne parle à OpenAI : elles PROGRAMMENT des étapes, que le
 * worker exécute.
 *
 *   · Valider le compte rendu (⇒ purge du son, décision B1) — REFUSÉ tant
 *     que les voix de la piste client ne sont pas attribuées quand il y en a
 *     plusieurs ;
 *   · Réécrire (P5 sur les mêmes faits), Réextraire (P1 depuis la
 *     transcription), Compléter après rattachement (P2 et suivantes, SANS
 *     refaire P1) ;
 *   · Attribuer une voix (« CLIENT_1 = … ») ;
 *   · Confirmer qu'un enregistrement de moins de 90 s doit être traité ;
 *   · Reprendre les étapes suspendues (crédit rechargé, configuration corrigée).
 */

import type { PrismaClient } from "../../../prisma/generated/client";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { etatSansTexteBrut, lireEtat } from "./etat-compte-rendu";
import { ajouterAuJournal } from "./journal-enregistrement";
import { planifierDans } from "./prise-d-etape";

type Db = PrismaClient;

export class GesteRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GesteRefuse";
  }
}

// ── Voix ─────────────────────────────────────────────────────────────────────

/**
 * Les voix de la piste client sans personne attribuée, QUAND il y en a
 * plusieurs. Une seule voix n'exige rien (c'est l'interlocuteur). Fonction PURE.
 */
export function voixNonAttribuees(
  voixClient: readonly string[],
  participants: ReadonlyArray<{
    readonly etiquetteVoix: string | null;
    readonly voixValideeLe: Date | null;
  }>,
): string[] {
  if (voixClient.length <= 1) return [];
  const attribuees = new Set(
    participants
      .filter((p) => p.etiquetteVoix !== null && p.voixValideeLe !== null)
      .map((p) => p.etiquetteVoix!),
  );
  return voixClient.filter((v) => !attribuees.has(v));
}

/** Ce que la lecture des voix demande à la base (client ou transaction). */
type LecteurVoix = Pick<PrismaClient, "transcriptionSegment" | "rencontreParticipant">;

/** Les voix de la piste client de la transcription retenue d'une rencontre. */
export async function voixDeLaRencontre(db: LecteurVoix, rencontreId: string): Promise<string[]> {
  const lignes = await db.transcriptionSegment.findMany({
    where: {
      piste: "client",
      horsAccord: false,
      apresRefus: false,
      transcription: { statut: "retenue", enregistrement: { rencontreId } },
    },
    distinct: ["locuteurBrut"],
    orderBy: { debutMs: "asc" },
    select: { locuteurBrut: true },
  });
  return lignes.map((l) => l.locuteurBrut ?? "A");
}

/**
 * ⛔ « Valider tous » (et la validation du compte rendu) sont REFUSÉS tant que
 * la correspondance des voix n'est pas faite quand la piste client en porte
 * plusieurs. Appelée par `validerCompteRendu` et, dans sa transaction, par
 * `validerApresLAppel` (`src/features/dossier-client/valider.ts`).
 */
export async function exigerVoixAttribuees(db: LecteurVoix, rencontreId: string): Promise<void> {
  const [voix, participants] = await Promise.all([
    voixDeLaRencontre(db, rencontreId),
    db.rencontreParticipant.findMany({
      where: { rencontreId, role: "client" },
      select: { etiquetteVoix: true, voixValideeLe: true },
    }),
  ]);
  const manquantes = voixNonAttribuees(voix, participants);
  if (manquantes.length > 0) {
    throw new GesteRefuse(
      `Plusieurs personnes ont parlé côté client : dites d'abord qui est qui (voix ${manquantes
        .map((v) => `CLIENT_${voix.indexOf(v) + 1}`)
        .join(", ")}).`,
    );
  }
}

/** « CLIENT_1 = … » : attribue une voix à une personne présente. */
export async function attribuerVoix(
  db: Db,
  a: {
    readonly rencontreId: string;
    readonly voix: string;
    readonly participantId: string;
    readonly maintenant: Date;
  },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const p = await tx.rencontreParticipant.findFirst({
      where: { id: a.participantId, rencontreId: a.rencontreId, role: "client" },
      select: { id: true },
    });
    if (!p) throw new GesteRefuse("Cette personne ne fait pas partie de ce rendez-vous.");
    await tx.rencontreParticipant.updateMany({
      where: { rencontreId: a.rencontreId, etiquetteVoix: a.voix, NOT: { id: p.id } },
      data: { etiquetteVoix: null, voixValideeLe: null },
    });
    await tx.rencontreParticipant.update({
      where: { id: p.id },
      data: { etiquetteVoix: a.voix, voixValideeLe: a.maintenant },
    });
    await tx.transcriptionSegment.updateMany({
      where: {
        piste: "client",
        locuteurBrut: a.voix,
        transcription: { statut: "retenue", enregistrement: { rencontreId: a.rencontreId } },
      },
      data: { participantId: p.id, etiquetteVoix: a.voix },
    });
  });
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Valide le compte rendu à valider ; programme la purge du son (B1). */
export async function validerCompteRendu(
  db: Db,
  a: { readonly compteRenduId: string; readonly parAdminId: string; readonly maintenant: Date },
): Promise<void> {
  const cr = await db.compteRendu.findUnique({
    where: { id: a.compteRenduId },
    select: { id: true, rencontreId: true, statut: true },
  });
  if (!cr || cr.statut !== "a_valider")
    throw new GesteRefuse("Ce compte rendu n'est pas à valider.");
  await exigerVoixAttribuees(db, cr.rencontreId);
  await db.$transaction(async (tx) => {
    await tx.compteRendu.updateMany({
      where: { rencontreId: cr.rencontreId, statut: "valide" },
      data: { statut: "remplace" },
    });
    await tx.compteRendu.update({
      where: { id: cr.id },
      data: { statut: "valide", valideParId: a.parAdminId, valideLe: a.maintenant },
    });
    await tx.enregistrement.updateMany({
      where: { rencontreId: cr.rencontreId, statut: { in: ["compte_rendu_pret", "transcrit"] } },
      data: { statut: "valide" },
    });
    await planifierDans(tx, cr.rencontreId, {
      etape: "purger_audio",
      compteRenduId: null,
      reinitialiser: true,
    });
  });
}

// ── Réécrire, réextraire, compléter ──────────────────────────────────────────

async function compteRenduCourant(db: Db, rencontreId: string) {
  return db.compteRendu.findFirst({
    where: { rencontreId, statut: { in: ["brouillon", "a_valider", "valide", "a_regenerer"] } },
    orderBy: { version: "desc" },
    select: { id: true, statut: true, verification: true, version: true },
  });
}

/** « Réécrire » : P5 sur les mêmes faits (une nouvelle version si le compte rendu est validé ou vidé). */
export async function reecrireCompteRendu(db: Db, rencontreId: string): Promise<void> {
  const cr = await compteRenduCourant(db, rencontreId);
  if (!cr) throw new GesteRefuse("Aucun compte rendu à réécrire.");
  await db.$transaction(async (tx) => {
    if (cr.statut === "a_valider") {
      await tx.compteRendu.update({
        where: { id: cr.id },
        data: { statut: "brouillon", contenu: "" },
      });
    }
    await planifierDans(tx, rencontreId, {
      etape: "rediger",
      compteRenduId: cr.id,
      reinitialiser: true,
    });
  });
}

/** « Réextraire » : P1 depuis la transcription retenue ; l'ancienne version est remplacée. */
export async function reextraireCompteRendu(db: Db, rencontreId: string): Promise<void> {
  const t = await db.transcription.count({
    where: { statut: "retenue", enregistrement: { rencontreId } },
  });
  if (t === 0) throw new GesteRefuse("La transcription n'existe plus : impossible de réextraire.");
  await db.$transaction((tx) =>
    planifierDans(tx, rencontreId, { etape: "extraire", compteRenduId: null, reinitialiser: true }),
  );
}

/**
 * ⛔ « Compléter après rattachement » : le circuit repart de P2 — jamais P1.
 * Une nouvelle version reprend l'état (faits déjà vérifiés, couverture) et
 * repart de `rattacher`. Appelée par le bouton « Compléter » et par le point
 * d'enfilage du rattachement (`relancerApresRattachement`,
 * `src/features/dossier-client/rattacher.ts`) — une seule implémentation.
 * Rend l'identifiant de la nouvelle version, ou `null` s'il n'y a pas de
 * compte rendu à compléter.
 */
export async function completerApresRattachement(
  db: Db,
  rencontreId: string,
): Promise<string | null> {
  const cr = await compteRenduCourant(db, rencontreId);
  if (!cr || cr.verification === null) return null;
  const etat = etatSansTexteBrut(lireEtat(dechiffrerParole(cr.verification)));
  return db.$transaction(async (tx) => {
    if (cr.statut === "brouillon" || cr.statut === "a_valider") {
      await tx.compteRendu.update({ where: { id: cr.id }, data: { statut: "remplace" } });
    }
    const nouveau = await tx.compteRendu.create({
      data: {
        rencontreId,
        version: cr.version + 1,
        origine: "ia",
        mode: "completer_apres_rattachement",
        statut: "brouillon",
        schemaVersion: 1,
        contenu: "",
        verification: chiffrerParole(
          JSON.stringify({
            ...etat,
            rattachement: null,
            consolidation: [],
            ebauches: [],
            essaisRedaction: 0,
          }),
        ),
      },
      select: { id: true },
    });
    await planifierDans(tx, rencontreId, { etape: "rattacher", compteRenduId: nouveau.id });
    return nouveau.id;
  });
}

// ── Enregistrement court, reprise ────────────────────────────────────────────

/** G0b : Will confirme qu'un enregistrement de moins de 90 s doit être traité. */
export async function confirmerEnregistrementCourt(
  db: Db,
  rencontreId: string,
  maintenant: Date,
): Promise<void> {
  const e = await db.enregistrement.findFirst({
    where: { rencontreId, statut: "depose" },
    orderBy: { debut: "desc" },
    select: { id: true, evenements: true },
  });
  if (!e) throw new GesteRefuse("Aucun enregistrement court en attente.");
  await db.$transaction(async (tx) => {
    await tx.enregistrement.update({
      where: { id: e.id },
      data: {
        evenements: ajouterAuJournal(e.evenements, { le: maintenant, type: "court_confirme" }),
      },
    });
    await planifierDans(tx, rencontreId, {
      etape: "transcrire",
      compteRenduId: null,
      reinitialiser: true,
    });
  });
}

/** Reprise manuelle des étapes suspendues (crédit rechargé, configuration corrigée). */
export async function reprendreEtapesSuspendues(db: Db): Promise<number> {
  return db.$executeRaw`
    UPDATE "traitements_visio"
       SET "statut" = 'a_faire', "classe_erreur" = NULL, "derniere_erreur" = NULL, "prochaine_tentative_le" = NULL
     WHERE "statut" = 'suspendu' AND "classe_erreur" IN ('quota', 'configuration', 'plafond')`;
  // Une étape suspendue SANS classe attend une réponse de Will (enregistrement
  // de moins de 90 s) : elle ne reprend que par `confirmerEnregistrementCourt`.
}
