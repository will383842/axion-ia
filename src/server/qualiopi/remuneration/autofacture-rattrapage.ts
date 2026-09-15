/**
 * Qualiopi — PASSAGE du cron « rattrapage des autofactures » (worker, hors Next).
 *
 * 🔑 CE CRON EXISTE PARCE QUE L'ÉMISSION EST AUTOMATIQUE. Elle part à la
 * validation du relevé, en fail-soft : un PDF qui ne se rend pas, une file
 * d'envoi absente, et la pièce n'existe pas. Plus personne n'attend de bouton ;
 * sans ce passage, ce silence ne serait rattrapé par RIEN (ADR 0050 : le geste
 * couvre le cas normal, le cron couvre ce que personne ne va cliquer).
 *
 * 🔴 JUSQU'AU 2026-09-15, IL N'A JAMAIS RIEN ÉMIS. Il appelait la Server Action
 * du bouton, dont la garde lit la session du navigateur : sous `tsx`, elle
 * levait, et le `catch` comptait « refusée ». Il appelle désormais le service
 * pur `autofacture-emission.ts`, le MÊME que le bouton, avec un journal
 * `adminUserId: null` et `origine: "rattrapage_automatique"`.
 *
 * À chaque passage, pour chaque relevé validé sans facture d'un sous-traitant :
 *   · émise → comptée (et « non transmise » comptée à part : l'alerte
 *     `autofacture_non_transmise` la porte) ;
 *   · refus métier (`ineligible`) → compté, SANS bruit : l'alerte
 *     `autofacture_a_emettre` porte la liste des manques ;
 *   · anomalie ou panne → `console.error` avec l'identifiant du relevé, et une
 *     ligne `qualiopi.autofacture.rattrapage.echec` que le moteur d'alertes lit
 *     quand elle se répète (`autofacture-rattrapage-regles.ts`).
 *
 * ⚠️ Ce module ne doit mener, par ses imports, ni à `server-only`, ni à
 * `next/headers`, ni à un fichier `"use server"`. Garde :
 * `autofacture-rattrapage.graphe-worker.spec.ts`.
 */

import { prisma } from "@/lib/prisma";
import {
  emettreAutofacture,
  journalSysteme,
} from "@/server/qualiopi/remuneration/autofacture-emission";
import {
  ACTION_JOURNAL_ECHEC_RATTRAPAGE_AUTOFACTURE,
  typeErreur,
  type CodeEchecRattrapage,
} from "@/server/qualiopi/remuneration/autofacture-rattrapage-regles";

/**
 * Plafond d'autofactures tentées par passage.
 *
 * 🔴 Ce cron ÉMET des pièces au nom de tiers et les leur envoie. Une borne n'est
 * pas un réglage de confort : sans elle, une dégénérescence — un run de
 * rémunération qui valide tout un historique, une migration mal jouée — enverrait
 * des dizaines de factures à de vrais formateurs avant que quiconque s'en
 * aperçoive. Bornée, l'anomalie se voit dans le journal et s'arrête d'elle-même.
 *
 * 25 : très au-dessus du volume mensuel normal (quelques indépendants), assez
 * bas pour qu'un afflux anormal se remarque au lieu de s'écouler.
 */
export const PLAFOND_AUTOFACTURES_PAR_PASSAGE = 25;

export interface EchecRattrapage {
  readonly statementId: string;
  readonly code: CodeEchecRattrapage;
  readonly motif: string;
}

export interface BilanRattrapageAutofactures {
  readonly candidats: number;
  readonly emises: number;
  /** Émises, mais l'envoi n'est pas parti (fenêtre de contestation fermée). */
  readonly nonTransmises: number;
  /** Refus métier attendus (fiche incomplète, relevé plus éligible). */
  readonly refusees: number;
  /** Anomalies et pannes : ce qu'aucune autre surface ne voit. */
  readonly echecs: readonly EchecRattrapage[];
  readonly plafondAtteint: boolean;
}

export async function rattraperAutofactures(): Promise<BilanRattrapageAutofactures> {
  const candidats = await prisma.trainerStatement.findMany({
    where: {
      statut: "valide",
      autofactureAt: null,
      numeroFacture: null,
      trainer: { statut: "sous_traitant" },
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: PLAFOND_AUTOFACTURES_PAR_PASSAGE,
  });

  const journal = journalSysteme("rattrapage_automatique");
  let emises = 0;
  let nonTransmises = 0;
  let refusees = 0;
  const echecs: EchecRattrapage[] = [];

  /**
   * ⚠️ Ni le journal ni les logs ne reçoivent le MESSAGE de l'exception : Prisma
   * y recopie les paramètres de la requête (cf. `typeErreur`). L'étape et le
   * type d'erreur suffisent à savoir où chercher.
   */
  const echouer = async (
    statementId: string,
    code: CodeEchecRattrapage,
    motif: string,
    etape: string | null,
    erreur: string | null,
  ): Promise<void> => {
    console.error(
      `[autofactures] relevé ${statementId} — ${code}` +
        (etape !== null ? ` à l'étape ${etape}` : "") +
        (erreur !== null ? ` (${erreur})` : "") +
        ` : ${motif}`,
    );
    echecs.push({ statementId, code, motif });
    await journal({
      action: ACTION_JOURNAL_ECHEC_RATTRAPAGE_AUTOFACTURE,
      targetType: "TrainerStatement",
      targetId: statementId,
      changes: {
        code,
        motif,
        ...(etape !== null ? { etape } : {}),
        ...(erreur !== null ? { erreur } : {}),
      },
    });
  };

  for (const c of candidats) {
    // Une pièce qui échoue n'arrête pas les suivantes : un formateur ne doit
    // pas attendre parce que le relevé d'un autre a planté.
    try {
      const res = await emettreAutofacture(c.id, journal);
      if ("data" in res) {
        emises += 1;
        if (!res.data.transmise) nonTransmises += 1;
        continue;
      }
      // 🔑 `introuvable` : le relevé a disparu entre la sélection et
      // l'émission. `verrou_pris` : un autre émetteur tenait la série — le
      // relevé est repris au passage suivant, relu sous verrou. Ni l'un ni
      // l'autre n'est une panne ou un manque de données.
      if (res.code === "ineligible" || res.code === "introuvable" || res.code === "verrou_pris") {
        refusees += 1;
        continue;
      }
      await echouer(
        c.id,
        res.code,
        res.error,
        res.etape ?? null,
        res.cause !== undefined ? typeErreur(res.cause) : null,
      );
    } catch (err) {
      await echouer(c.id, "technique", "Exception pendant l'émission.", null, typeErreur(err));
    }
  }

  return {
    candidats: candidats.length,
    emises,
    nonTransmises,
    refusees,
    echecs,
    plafondAtteint: candidats.length === PLAFOND_AUTOFACTURES_PAR_PASSAGE,
  };
}

/** La ligne de journal du passage, et son niveau. */
export function ligneJournalRattrapage(b: BilanRattrapageAutofactures): {
  niveau: "warn" | "error";
  ligne: string;
} {
  const ligne =
    `[autofactures] ${b.emises} émise(s)` +
    (b.nonTransmises > 0 ? ` dont ${b.nonTransmises} non transmise(s)` : "") +
    `, ${b.refusees} refusée(s), ${b.echecs.length} en échec sur ${b.candidats} relevé(s) validés` +
    (b.plafondAtteint
      ? ` — PLAFOND ATTEINT : d'autres restent en attente, et un afflux de cette taille mérite d'être regardé.`
      : "");
  return { niveau: b.echecs.length > 0 ? "error" : "warn", ligne };
}
