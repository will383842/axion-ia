/**
 * LA PRISE D'UNE ÉTAPE du circuit, et son ÉCRITURE FINALE (ADR 0054 ; plan §3.11).
 *
 * L'état de chaque étape vit en BASE (`traitements_visio`), jamais dans Redis :
 * une file qui perd un job, un worker qui redémarre, deux workers qui prennent
 * le même job — rien de tout cela ne fait écrire deux fois.
 *
 *   · PRISE ATOMIQUE — `UPDATE … SET statut='en_cours', execution=execution+1,
 *     verrou_jusqua=now()+5 min WHERE id=$1 AND statut='a_faire' AND (verrou
 *     libre) RETURNING execution`. Une seule prise réussit ; `execution` est le
 *     JETON DE PROPRIÉTÉ de celui qui l'a obtenue.
 *   · PROLONGATION toutes les 60 s, `WHERE execution=$n` : un worker qui a
 *     perdu la main (verrou expiré, étape reprise par un autre) le découvre.
 *   · ÉCRITURE FINALE dans UNE transaction qui COMMENCE par
 *     `UPDATE … SET statut='reussie' WHERE id=$1 AND statut='en_cours' AND
 *     execution=$n` : 0 ligne = « résultat orphelin », tout est annulé. Puis
 *     elle vérifie qu'aucun RETRAIT de l'accord n'a été enregistré entre-temps
 *     (un retrait pendant le traitement n'écrit AUCUN fait).
 *   · Les écritures INTERMÉDIAIRES (une tranche transcrite) passent par la
 *     même porte, sans changer le statut (`ecrireEnCours`).
 *
 * `DepotEtapes` est l'interface ; `depotEtapesPrisma` son implémentation SQL,
 * prouvée sur une vraie base par la chaîne de Gate D. Les tests unitaires
 * utilisent une implémentation en mémoire aux mêmes prédicats.
 */

import type {
  ClasseErreur,
  CodeErreurVisio,
  EtapeVisio,
  Prisma,
  PrismaClient,
  StatutEtape,
} from "../../../prisma/generated/client";

/** Le verrou d'une prise (prolongé toutes les 60 s). */
export const DUREE_VERROU_MS = 5 * 60_000;

export interface EtapeTenue {
  readonly id: string;
  readonly rencontreId: string;
  readonly etape: EtapeVisio;
  readonly compteRenduId: string | null;
  /** Le jeton de propriété. */
  readonly execution: number;
  /**
   * Les prises NON IMPUTÉES au plafond de 10 exécutions : arrêt du worker
   * (SIGTERM), report (base pas encore migrée, enregistrement encore actif),
   * suspension. Une prise perdue par un verrou expiré (worker tué, mémoire),
   * elle, est imputée : c'est ce qui borne une boucle de plantages.
   */
  readonly interruptions: number;
  readonly echecs: number;
  readonly premierEchecLe: Date | null;
  /**
   * La classe du DERNIER échec (V1, F5) : un échec d'une autre classe ouvre
   * une nouvelle série (`DecisionEchec.nouvelleSerie`). Absente = inconnue :
   * la série continue.
   */
  readonly classeErreur?: ClasseErreur | null;
}

/** Une étape à programmer après celle-ci. */
export interface Suite {
  readonly etape: EtapeVisio;
  readonly compteRenduId: string | null;
  /** Remettre `a_faire` une étape déjà terminée (réécrire, réextraire, compléter). */
  readonly reinitialiser?: boolean;
  /** Pas avant (défaut : tout de suite). */
  readonly pasAvant?: Date;
}

/** Ce qu'il advient d'une étape qui n'a pas réussi. */
export interface DecisionEchec {
  readonly statut: Extract<StatutEtape, "a_faire" | "echec_definitif" | "suspendu">;
  readonly classe: ClasseErreur | null;
  readonly code: CodeErreurVisio | null;
  /** Compte-t-elle comme un échec ? (Jamais pour un arrêt du worker ni une base en retard.) */
  readonly compter: boolean;
  readonly prochaineTentativeLe: Date | null;
  readonly premierEchecLe: Date | null;
  /**
   * L'échec est d'une AUTRE classe que le précédent : le compteur `echecs`
   * repart de zéro avant d'être incrémenté (V1, F5). `premierEchecLe` porte
   * alors la date de ce premier échec de la nouvelle classe.
   */
  readonly nouvelleSerie?: boolean;
}

/** Le résultat a été produit par quelqu'un qui n'avait plus la main : rien n'est écrit. */
export class ResultatOrphelin extends Error {
  constructor() {
    super("résultat orphelin : l'étape a été reprise ou annulée entre-temps");
    this.name = "ResultatOrphelin";
  }
}

/** L'accord a été retiré pendant le traitement : rien n'est écrit. */
export class RetraitConstate extends Error {
  constructor() {
    super("accord retiré pendant le traitement : rien n'est écrit");
    this.name = "RetraitConstate";
  }
}

export type Tx = Prisma.TransactionClient;

export interface DepotEtapes {
  readonly prendre: (id: string) => Promise<EtapeTenue | null>;
  readonly prolonger: (t: EtapeTenue) => Promise<boolean>;
  /** Écrit sans changer le statut, si l'on a toujours la main et qu'aucun retrait n'est là. */
  readonly ecrireEnCours: <R>(t: EtapeTenue, fn: (tx: Tx) => Promise<R>) => Promise<R>;
  /** Écriture finale : `reussie` + `fn` + les suites, en une transaction. */
  readonly terminer: (
    t: EtapeTenue,
    fn: (tx: Tx) => Promise<readonly Suite[]>,
  ) => Promise<readonly Suite[]>;
  /** Arrêt du worker : `a_faire`, sans compter d'échec. */
  readonly relacher: (t: EtapeTenue) => Promise<void>;
  readonly echouer: (t: EtapeTenue, d: DecisionEchec) => Promise<void>;
  /** Programme une étape (hors d'une étape tenue : validation, retrait, balayage). */
  readonly planifier: (s: Suite & { readonly rencontreId: string }) => Promise<void>;
  /** Quota épuisé ou plafond atteint : suspend TOUT ce qui attend. */
  readonly suspendreTout: (classe: ClasseErreur, code: CodeErreurVisio) => Promise<number>;
}

type Client = Pick<PrismaClient, "$queryRaw" | "$executeRaw" | "$transaction">;

interface LigneTenue {
  id: string;
  rencontre_id: string;
  etape: EtapeVisio;
  compte_rendu_id: string | null;
  execution: number;
  interruptions: number;
  echecs: number;
  premier_echec_le: Date | null;
  classe_erreur: ClasseErreur | null;
}

function tenue(l: LigneTenue): EtapeTenue {
  return {
    id: l.id,
    rencontreId: l.rencontre_id,
    etape: l.etape,
    compteRenduId: l.compte_rendu_id,
    execution: Number(l.execution),
    interruptions: Number(l.interruptions),
    echecs: Number(l.echecs),
    premierEchecLe: l.premier_echec_le,
    classeErreur: l.classe_erreur ?? null,
  };
}

/** Programme une étape dans une transaction ouverte (INSERT idempotent). */
export async function planifierDans(
  tx: Pick<PrismaClient, "$executeRaw">,
  rencontreId: string,
  s: Suite,
): Promise<void> {
  const pasAvant = s.pasAvant ?? null;
  if (s.compteRenduId === null) {
    await tx.$executeRaw`
      INSERT INTO "traitements_visio" ("id", "rencontre_id", "etape", "statut", "prochaine_tentative_le")
      VALUES (gen_random_uuid(), ${rencontreId}::uuid, ${s.etape}::"etape_visio", 'a_faire', ${pasAvant})
      ON CONFLICT ("rencontre_id", "etape") WHERE "compte_rendu_id" IS NULL DO NOTHING`;
  } else {
    await tx.$executeRaw`
      INSERT INTO "traitements_visio" ("id", "rencontre_id", "etape", "statut", "compte_rendu_id", "prochaine_tentative_le")
      VALUES (gen_random_uuid(), ${rencontreId}::uuid, ${s.etape}::"etape_visio", 'a_faire', ${s.compteRenduId}::uuid, ${pasAvant})
      ON CONFLICT ("rencontre_id", "etape", "compte_rendu_id") DO NOTHING`;
  }
  if (s.reinitialiser) {
    await tx.$executeRaw`
      UPDATE "traitements_visio"
         SET "statut" = 'a_faire', "echecs" = 0, "premier_echec_le" = NULL, "classe_erreur" = NULL,
             "derniere_erreur" = NULL, "verrou_jusqua" = NULL, "termine_le" = NULL,
             "prochaine_tentative_le" = ${pasAvant}
       WHERE "rencontre_id" = ${rencontreId}::uuid AND "etape" = ${s.etape}::"etape_visio"
         AND "compte_rendu_id" IS NOT DISTINCT FROM ${s.compteRenduId}::uuid
         AND "statut" IN ('reussie', 'echec_definitif', 'annule', 'suspendu')`;
  }
}

/**
 * V1 P-1 : les étapes d'une version REMPLACÉE du compte rendu s'arrêtent.
 * Une étape à faire, suspendue ou EN COURS passe `annule` : une étape en
 * cours perd la main (son écriture finale exige `statut = 'en_cours'`), son
 * résultat est orphelin et n'écrit rien. Seule implémentation, appelée partout
 * où une version est remplacée (`completerApresRattachement`,
 * `creerCompteRendu`), dans la transaction qui la remplace.
 */
export async function annulerEtapesDesVersions(
  tx: Pick<PrismaClient, "traitementVisio">,
  compteRenduIds: readonly string[],
): Promise<void> {
  if (compteRenduIds.length === 0) return;
  await tx.traitementVisio.updateMany({
    where: {
      compteRenduId: { in: [...compteRenduIds] },
      statut: { in: ["a_faire", "suspendu", "en_cours"] },
    },
    data: { statut: "annule", verrouJusqua: null },
  });
}

async function exigerLaMain(tx: Tx, t: EtapeTenue): Promise<void> {
  const tenueEncore = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "traitements_visio"
     WHERE "id" = ${t.id}::uuid AND "statut" = 'en_cours' AND "execution" = ${t.execution}
     FOR UPDATE`;
  if (tenueEncore.length === 0) throw new ResultatOrphelin();
}

/**
 * Les étapes qui DOIVENT aboutir malgré un retrait de l'accord : la purge du
 * son est précisément ce que le retrait demande (B2). Sans cette exemption,
 * `terminer` levait `RetraitConstate` : les objets R2 étaient supprimés, mais
 * `audioSupprimeLe` n'était jamais posé — aucune preuve de la suppression, le
 * son encore affiché, une purge reprogrammée toutes les 5 minutes jusqu'au
 * plafond, puis une FAUSSE alerte critique « audio non purgé ».
 */
export const ETAPES_PERMISES_APRES_RETRAIT: ReadonlySet<EtapeVisio> = new Set(["purger_audio"]);

async function exigerAucunRetrait(
  tx: Tx,
  t: Pick<EtapeTenue, "rencontreId" | "etape">,
): Promise<void> {
  if (ETAPES_PERMISES_APRES_RETRAIT.has(t.etape)) return;
  const rencontreId = t.rencontreId;
  const retrait = await tx.$queryRaw<Array<{ un: number }>>`
    SELECT 1 AS "un" FROM "enregistrement_consentements"
     WHERE "rencontre_id" = ${rencontreId}::uuid AND "type" = 'retrait' AND "enregistrement_id" IS NULL
     LIMIT 1`;
  if (retrait.length > 0) throw new RetraitConstate();
}

/**
 * Une prise qui finit SANS COMPTER et sans échec définitif (report, suspension)
 * n'est pas imputée au plafond de 10 exécutions : une base non migrée pendant
 * 2 h 30 ou un second enregistrement actif pendant 50 min ne tuent pas l'étape.
 */
export function priseNonImputee(d: DecisionEchec): boolean {
  return !d.compter && d.statut !== "echec_definitif";
}

/** Exécutions imputées au plafond : les prises, moins celles qui ont été reportées ou relâchées. */
export function executionsImputees(t: Pick<EtapeTenue, "execution" | "interruptions">): number {
  return t.execution - t.interruptions;
}

export function depotEtapesPrisma(db: Client): DepotEtapes {
  return {
    prendre: async (id) => {
      const lignes = await db.$queryRaw<LigneTenue[]>`
        UPDATE "traitements_visio"
           SET "statut" = 'en_cours', "execution" = "execution" + 1,
               "verrou_jusqua" = (now() AT TIME ZONE 'UTC') + interval '5 minutes'
         WHERE "id" = ${id}::uuid AND "statut" = 'a_faire'
           AND ("verrou_jusqua" IS NULL OR "verrou_jusqua" < (now() AT TIME ZONE 'UTC'))
         RETURNING "id", "rencontre_id", "etape", "compte_rendu_id", "execution", "interruptions", "echecs", "premier_echec_le", "classe_erreur"`;
      return lignes[0] ? tenue(lignes[0]) : null;
    },
    prolonger: async (t) => {
      const n = await db.$executeRaw`
        UPDATE "traitements_visio" SET "verrou_jusqua" = (now() AT TIME ZONE 'UTC') + interval '5 minutes'
         WHERE "id" = ${t.id}::uuid AND "statut" = 'en_cours' AND "execution" = ${t.execution}`;
      return n > 0;
    },
    ecrireEnCours: async (t, fn) =>
      db.$transaction(async (tx) => {
        await exigerLaMain(tx, t);
        await exigerAucunRetrait(tx, t);
        return fn(tx);
      }),
    terminer: async (t, fn) =>
      db.$transaction(
        async (tx) => {
          const n = await tx.$executeRaw`
            UPDATE "traitements_visio"
               SET "statut" = 'reussie', "termine_le" = (now() AT TIME ZONE 'UTC'), "verrou_jusqua" = NULL,
                   "classe_erreur" = NULL, "derniere_erreur" = NULL
             WHERE "id" = ${t.id}::uuid AND "statut" = 'en_cours' AND "execution" = ${t.execution}`;
          if (n === 0) throw new ResultatOrphelin();
          await exigerAucunRetrait(tx, t);
          const suites = await fn(tx);
          for (const s of suites) await planifierDans(tx, t.rencontreId, s);
          return suites;
        },
        { timeout: 60_000 },
      ),
    relacher: async (t) => {
      await db.$executeRaw`
        UPDATE "traitements_visio"
           SET "statut" = 'a_faire', "verrou_jusqua" = NULL, "interruptions" = "interruptions" + 1,
               "derniere_erreur" = 'interrompu_par_arret'
         WHERE "id" = ${t.id}::uuid AND "statut" = 'en_cours' AND "execution" = ${t.execution}`;
    },
    echouer: async (t, d) => {
      await db.$executeRaw`
        UPDATE "traitements_visio"
           SET "statut" = ${d.statut}::"statut_etape",
               "echecs" = CASE WHEN ${d.nouvelleSerie === true}::boolean THEN 0 ELSE "echecs" END + ${d.compter ? 1 : 0},
               "interruptions" = "interruptions" + ${priseNonImputee(d) ? 1 : 0},
               "classe_erreur" = ${d.classe}::"classe_erreur",
               "derniere_erreur" = ${d.code}::"code_erreur_visio",
               "prochaine_tentative_le" = ${d.prochaineTentativeLe},
               "premier_echec_le" = ${d.premierEchecLe},
               "verrou_jusqua" = NULL,
               "termine_le" = CASE WHEN ${d.statut} = 'echec_definitif' THEN (now() AT TIME ZONE 'UTC') ELSE NULL END
         WHERE "id" = ${t.id}::uuid AND "statut" = 'en_cours' AND "execution" = ${t.execution}`;
    },
    planifier: async (s) => {
      await db.$transaction(async (tx) => planifierDans(tx, s.rencontreId, s));
    },
    suspendreTout: async (classe, code) =>
      db.$executeRaw`
        UPDATE "traitements_visio"
           SET "statut" = 'suspendu', "classe_erreur" = ${classe}::"classe_erreur",
               "derniere_erreur" = ${code}::"code_erreur_visio"
         WHERE "statut" = 'a_faire'`,
  };
}
