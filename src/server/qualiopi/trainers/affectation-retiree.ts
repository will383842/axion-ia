/**
 * 🔴 D6 — GARDER LA TRACE DU FORMATEUR ÉCARTÉ (2026-09-05).
 *
 * ## Le défaut que ce module ferme
 *
 * Trois chemins supprimaient la ligne `SessionFormateur` d'un formateur :
 * le remplacement (`assignTrainerToSessionAction`), le refus et le passage en
 * `sans_reponse` (`mission-formateur.ts`). La ligne partait avec le tarif
 * SNAPSHOTÉ à son affectation — celui que la lettre de mission a repris —, les
 * heures animées, et les envois déjà faits (convocation J-7, rappel J-1).
 *
 * Après un remplacement, **plus rien ne disait qu'une personne avait un jour
 * été le formateur de cette session**. Sur un dossier qui doit se raconter
 * devant un auditeur (ind. 21/22), c'est une preuve perdue — exactement le
 * raisonnement qui avait fait passer `TrainerHabilitation` du `deleteMany` au
 * retrait daté le 2026-08-17.
 *
 * ## Pourquoi une ARCHIVE et pas un `retireAt` sur `SessionFormateur`
 *
 * Le patron du dépôt est bien « retirer par une date ». Il n'est pas
 * transplantable ici, et c'est vérifié : `SessionFormateur` signifie « qui est
 * sur cette session MAINTENANT », et une vingtaine de lectures réparties sur
 * six modules s'en servent telle quelle. Sans filtrer chacune d'elles dans le
 * même mouvement, une ligne conservée ferait partir la convocation J-7 au
 * formateur remplacé, lui rouvrirait l'émargement, le PAIERAIT
 * (`remuneration/statements.ts`) et le compterait deux fois au cockpit de
 * marge. Le détail des lecteurs est au commentaire du modèle
 * `SessionFormateurRetire` dans `prisma/schema.prisma`.
 *
 * Échanger une preuve perdue contre quatre défauts actifs n'est pas un
 * correctif. On archive donc À CÔTÉ : la table vivante garde son sens, et la
 * question de l'auditeur — « qui devait animer, à quel tarif, qu'avait-il
 * reçu ? » — retrouve une réponse.
 *
 * ## L'ordre des gestes, et pourquoi il n'est pas indifférent
 *
 * On LIT le snapshot avant la transaction, on SUPPRIME dans la transaction du
 * chemin appelant, on ARCHIVE après son succès. Archiver avant écrirait un
 * retrait qui n'a peut-être pas eu lieu — une archive qui ment est pire qu'une
 * archive absente. L'inverse (archiver après) ne peut perdre qu'un
 * enregistrement, et il est journalisé.
 *
 * ⚠️ **Best-effort assumé, et pour une raison mesurée.** Le worker atterrit
 * ~50 min AVANT l'app (AGENTS.md), donc il exécutera ce code alors que la
 * migration — portée par l'entrypoint de l'app — n'est pas encore passée.
 * Faire échouer le retrait sur une archive impossible gèlerait les sessions
 * pendant cette fenêtre. On logue, on poursuit, et l'archive redevient
 * systématique dès l'atterrissage de l'app.
 */

import { prisma } from "@/lib/prisma";
import type { SessionFormateurRole } from "../../../../prisma/generated/client";

/**
 * Pourquoi l'affectation a été retirée. Miroir de l'enum Prisma
 * `SessionFormateurRetraitMotif` — dérivé du CHEMIN, jamais saisi : les quatre
 * valeurs sont les quatre seules écritures du dépôt.
 */
export type MotifRetraitAffectation =
  "remplacement" | "desaffectation" | "refus_formateur" | "sans_reponse_delai";

/** Ce que la ligne `SessionFormateur` portait à l'instant de son retrait. */
export interface SnapshotAffectation {
  sessionId: string;
  trainerId: string;
  role: SessionFormateurRole;
  heuresAnimees: unknown;
  tarifHtCents: number | null;
  convocationJ7EnvoyeeAt: Date | null;
  rappelJ1EnvoyeAt: Date | null;
  affecteAt: Date;
}

const SELECT_SNAPSHOT = {
  sessionId: true,
  trainerId: true,
  role: true,
  heuresAnimees: true,
  tarifHtCents: true,
  convocationJ7EnvoyeeAt: true,
  rappelJ1EnvoyeAt: true,
  createdAt: true,
} as const;

function isStub(): boolean {
  return Boolean(process.env["DATABASE_URL"]?.includes("stub.invalid"));
}

/**
 * Lit ce que les affectations sur le point d'être supprimées portent.
 *
 * À appeler AVANT la transaction qui supprime, avec le MÊME `where` : une
 * lecture faite après ne trouverait plus rien, et c'est précisément ce que le
 * défaut consistait à laisser arriver.
 */
export async function lireAffectationsAvantRetrait(where: {
  sessionId: string;
  role?: SessionFormateurRole;
  /** Exclut ce formateur — celui qu'on garde ou qu'on vient d'affecter. */
  saufTrainerId?: string | null;
  /** Ne vise QUE ce formateur (chemins refus / sans réponse). */
  trainerId?: string;
}): Promise<SnapshotAffectation[]> {
  if (isStub()) return [];
  try {
    const rows = await prisma.sessionFormateur.findMany({
      where: {
        sessionId: where.sessionId,
        ...(where.role !== undefined ? { role: where.role } : {}),
        ...(where.trainerId !== undefined ? { trainerId: where.trainerId } : {}),
        ...(where.saufTrainerId ? { trainerId: { not: where.saufTrainerId } } : {}),
      },
      select: SELECT_SNAPSHOT,
    });
    return rows.map((r) => ({
      sessionId: r.sessionId,
      trainerId: r.trainerId,
      role: r.role,
      heuresAnimees: r.heuresAnimees,
      tarifHtCents: r.tarifHtCents,
      convocationJ7EnvoyeeAt: r.convocationJ7EnvoyeeAt,
      rappelJ1EnvoyeAt: r.rappelJ1EnvoyeAt,
      affecteAt: r.createdAt,
    }));
  } catch (err) {
    console.error(
      `[affectation-retiree] lecture du snapshot impossible (session ${where.sessionId}):`,
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

/**
 * Écrit l'archive des affectations retirées. À appeler APRÈS le succès de la
 * transaction qui les a supprimées.
 *
 * Rend le nombre de lignes archivées. Ne lève jamais : cf. l'en-tête sur la
 * fenêtre de déploiement worker / app.
 */
export async function archiverAffectationsRetirees(
  snapshots: readonly SnapshotAffectation[],
  opts: { motif: MotifRetraitAffectation; retireById?: string | null; now?: Date },
): Promise<number> {
  if (isStub() || snapshots.length === 0) return 0;
  const retireAt = opts.now ?? new Date();
  try {
    const r = await prisma.sessionFormateurRetire.createMany({
      data: snapshots.map((s) => ({
        sessionId: s.sessionId,
        trainerId: s.trainerId,
        role: s.role,
        heuresAnimees: s.heuresAnimees as never,
        tarifHtCents: s.tarifHtCents,
        convocationJ7EnvoyeeAt: s.convocationJ7EnvoyeeAt,
        rappelJ1EnvoyeAt: s.rappelJ1EnvoyeAt,
        affecteAt: s.affecteAt,
        retireAt,
        motifRetrait: opts.motif,
        retireById: opts.retireById ?? null,
      })),
    });
    return r.count;
  } catch (err) {
    // 🔴 Un `console.error` et pas un throw : voir l'en-tête. Le message NOMME
    // les formateurs concernés, parce que c'est la seule chose qui restera si
    // la table n'existe pas encore.
    console.error(
      `[affectation-retiree] ARCHIVE PERDUE — session ${snapshots[0]?.sessionId}, ` +
        `formateurs ${snapshots.map((s) => s.trainerId).join(", ")}, motif ${opts.motif}:`,
      err instanceof Error ? err.message : String(err),
    );
    return 0;
  }
}

/** Une affectation retirée, telle qu'un écran de dossier la raconterait. */
export interface AffectationRetiree {
  id: string;
  trainerId: string;
  trainerNom: string;
  role: SessionFormateurRole;
  tarifHtCents: number | null;
  convocationJ7EnvoyeeAt: Date | null;
  rappelJ1EnvoyeAt: Date | null;
  affecteAt: Date;
  retireAt: Date;
  motifRetrait: MotifRetraitAffectation;
}

/** Libellé humain de chaque motif. `Record` exhaustif : oublier ne compile pas. */
export const LIBELLE_MOTIF_RETRAIT: Record<MotifRetraitAffectation, string> = {
  remplacement: "Remplacé par un autre formateur",
  desaffectation: "Retiré de la session sans remplaçant",
  refus_formateur: "A refusé la mission",
  sans_reponse_delai: "N'a pas répondu dans le délai",
};

/**
 * Qui a été écarté de cette session, quand et pourquoi — du plus récent au plus
 * ancien.
 *
 * ⚠️ Cette lecture n'a PAS encore d'écran : le bloc « formateurs écartés » de la
 * fiche session relève de `src/components/**`, hors de la zone de ce chantier.
 * Elle est écrite ici pour que le raccordement soit un branchement et non une
 * reconstruction — et elle est signalée comme telle dans le rapport de lot.
 */
export async function listerAffectationsRetirees(sessionId: string): Promise<AffectationRetiree[]> {
  if (isStub()) return [];
  try {
    const rows = await prisma.sessionFormateurRetire.findMany({
      where: { sessionId },
      orderBy: { retireAt: "desc" },
      select: {
        id: true,
        trainerId: true,
        role: true,
        tarifHtCents: true,
        convocationJ7EnvoyeeAt: true,
        rappelJ1EnvoyeAt: true,
        affecteAt: true,
        retireAt: true,
        motifRetrait: true,
        trainer: { select: { prenom: true, nom: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      trainerId: r.trainerId,
      trainerNom: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
      role: r.role,
      tarifHtCents: r.tarifHtCents,
      convocationJ7EnvoyeeAt: r.convocationJ7EnvoyeeAt,
      rappelJ1EnvoyeAt: r.rappelJ1EnvoyeAt,
      affecteAt: r.affecteAt,
      retireAt: r.retireAt,
      motifRetrait: r.motifRetrait as MotifRetraitAffectation,
    }));
  } catch {
    return [];
  }
}
