/**
 * CLÔTURE D'OFFICE des enregistrements abandonnés (chantier visio ; PR 5).
 *
 *   · `accord_en_attente` depuis plus de 3 min → `accord_non_confirme`
 *     (l'extension a détruit son son de son côté) ;
 *   · `en_cours` sans signe de vie depuis 10 min → `interrompu` ;
 *   · `interrompu` jusqu'à `max(fin prévue, dernier signe) + 2 h` → `depose`
 *     avec `incomplet = true` : le son reçu est gardé, ce qui manque est dit.
 *
 * Aucune de ces décisions n'est définitive : un accord daté à temps, un
 * battement qui revient ou une `fin` tardive la corrigent (`sessions.ts`).
 *
 * Le « dernier signe de vie » est `Enregistrement.updatedAt` : chaque battement,
 * morceau ou fin de tranche le pose. La clôture le CONSERVE explicitement quand
 * elle change le statut (sinon `@updatedAt` le remplacerait par l'heure de la
 * clôture, et repousserait d'autant la décision suivante).
 *
 * Appelée à chaque requête de l'extension (coût : une requête indexée) et
 * exportée pour le balayage du worker (PR 4) — voir `balayage-enregistreur.ts`.
 * Module sans `server-only`.
 */

import type { EnregistrementStatut, PrismaClient } from "../../../prisma/generated/client";
import { DELAIS_SERVEUR } from "@/lib/schemas/enregistreur";
import { ETATS_ENREGISTREMENT_ACTIFS } from "./etats";
import { ajouterAuJournal } from "./journal-enregistrement";

/** Le son est effacé au plus tard 30 jours après la fin (B1, ADR 0056 ; purge en PR 6). */
export const CONSERVATION_AUDIO_MAX_JOURS = 30;

export interface EtatPourCloture {
  readonly statut: EnregistrementStatut;
  readonly debut: Date;
  /** Dernier signe de vie. */
  readonly updatedAt: Date;
  readonly finPrevueRencontre: Date | null;
}

export type DecisionCloture =
  | { readonly action: "aucune" }
  | { readonly action: "accord_non_confirme" }
  | { readonly action: "interrompre" }
  | { readonly action: "deposer_incomplet"; readonly finRetenue: Date };

/** Décision PURE : que faire de cet enregistrement, maintenant ? */
export function decisionCloture(e: EtatPourCloture, maintenant: Date): DecisionCloture {
  const t = maintenant.getTime();
  if (e.statut === "accord_en_attente") {
    return t - e.debut.getTime() > DELAIS_SERVEUR.accordMaxMs
      ? { action: "accord_non_confirme" }
      : { action: "aucune" };
  }
  if (e.statut === "en_cours") {
    return t - e.updatedAt.getTime() > DELAIS_SERVEUR.sansBattementMs
      ? { action: "interrompre" }
      : { action: "aucune" };
  }
  if (e.statut === "interrompu") {
    const repere = Math.max(e.finPrevueRencontre?.getTime() ?? 0, e.updatedAt.getTime());
    return t > repere + DELAIS_SERVEUR.interrompuVersDeposeMs
      ? { action: "deposer_incomplet", finRetenue: e.updatedAt }
      : { action: "aucune" };
  }
  return { action: "aucune" };
}

type Db = Pick<PrismaClient, "enregistrement" | "enregistrementTranche">;

/**
 * V2, m3 — Chrome a planté : la tranche en cours n'a jamais reçu sa fin.
 * Ses morceaux, contigus depuis le premier (qui porte l'en-tête WebM), sont
 * lisibles : elle passe `complete` et sera transcrite. Un trou la laisse
 * de côté.
 */
async function completerTranchesContigues(db: Db, enregistrementId: string): Promise<void> {
  const tranches = await db.enregistrementTranche.findMany({
    where: { enregistrementId, statut: { in: ["en_reception", "incomplete"] } },
    select: { id: true, morceaux: { select: { seq: true } } },
  });
  for (const t of tranches) {
    const seqs = t.morceaux.map((m) => m.seq).sort((a, b) => a - b);
    if (seqs.length === 0 || !seqs.every((s, i) => s === i)) continue;
    await db.enregistrementTranche.update({
      where: { id: t.id },
      data: { statut: "complete", nbMorceauxAnnonces: seqs.length },
    });
  }
}

export interface BilanCloture {
  readonly accordNonConfirme: number;
  readonly interrompus: number;
  readonly deposes: number;
}

/** Applique les décisions de clôture à tous les enregistrements actifs. */
export async function cloturerEnregistrements(db: Db, maintenant: Date): Promise<BilanCloture> {
  const actifs = await db.enregistrement.findMany({
    where: { statut: { in: [...ETATS_ENREGISTREMENT_ACTIFS] } },
    select: {
      id: true,
      statut: true,
      debut: true,
      updatedAt: true,
      evenements: true,
      rencontre: { select: { finPrevue: true } },
    },
    take: 200,
  });
  let accordNonConfirme = 0;
  let interrompus = 0;
  let deposes = 0;
  for (const e of actifs) {
    const d = decisionCloture(
      {
        statut: e.statut,
        debut: e.debut,
        updatedAt: e.updatedAt,
        finPrevueRencontre: e.rencontre.finPrevue,
      },
      maintenant,
    );
    if (d.action === "aucune") continue;
    // `updateMany` conditionné au statut lu : une requête de l'extension qui
    // arrive entre la lecture et l'écriture gagne toujours.
    if (d.action === "accord_non_confirme") {
      const r = await db.enregistrement.updateMany({
        where: { id: e.id, statut: "accord_en_attente" },
        data: {
          statut: "accord_non_confirme",
          motifArret: "accord_non_confirme",
          fin: maintenant,
          updatedAt: e.updatedAt,
          evenements: ajouterAuJournal(e.evenements, {
            le: maintenant,
            type: "cloture_accord_absent",
          }),
        },
      });
      accordNonConfirme += r.count;
    } else if (d.action === "interrompre") {
      const r = await db.enregistrement.updateMany({
        where: { id: e.id, statut: "en_cours", updatedAt: e.updatedAt },
        data: {
          statut: "interrompu",
          updatedAt: e.updatedAt,
          evenements: ajouterAuJournal(e.evenements, {
            le: maintenant,
            type: "interrompu_sans_battement",
          }),
        },
      });
      interrompus += r.count;
    } else {
      const r = await db.enregistrement.updateMany({
        where: { id: e.id, statut: "interrompu", updatedAt: e.updatedAt },
        data: {
          statut: "depose",
          incomplet: true,
          motifArret: "cloture_serveur",
          fin: d.finRetenue,
          audioAPurgerAvant: new Date(
            d.finRetenue.getTime() + CONSERVATION_AUDIO_MAX_JOURS * 86_400_000,
          ),
          updatedAt: e.updatedAt,
          evenements: ajouterAuJournal(e.evenements, { le: maintenant, type: "cloture_serveur" }),
        },
      });
      if (r.count > 0) await completerTranchesContigues(db, e.id);
      deposes += r.count;
    }
  }
  return { accordNonConfirme, interrompus, deposes };
}
