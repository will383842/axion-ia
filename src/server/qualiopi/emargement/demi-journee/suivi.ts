/**
 * Chantier QNC, lot L06 — LE SUIVI DE L'ÉMARGEMENT PAR DEMI-JOURNÉE.
 *
 * Une seule lecture alimente les trois vues de la console :
 *   - la liste **J-1** : qui vient demain, sur quelles demi-journées, qui a
 *     droit à la signature « nom tapé » (adaptation), à qui le lien ne pourra
 *     pas partir (adresse absente) ;
 *   - la liste **J0** : l'état de chaque demi-journée du jour, le rappel parti
 *     ou non, la contresignature du formateur ;
 *   - les **écarts** : toute demi-journée close sans signature, rattrapée par
 *     l'organisme, ou signée hors de son créneau. Un écart n'est jamais
 *     maquillé en signature.
 *
 * Les états se décident dans `etatDemiJournee` (pure). La lecture rassemble les
 * faits.
 */

import { prisma } from "@/lib/prisma";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { colonneDeclarationDisponible } from "@/server/qualiopi/adaptation/colonne-declaration";
import { emargementParDemiJourneePour } from "./activation";
import {
  cleDemiJournee,
  fenetreSignature,
  positionFenetre,
  type DemiJourneePrevue,
  type PositionFenetre,
} from "./fenetre";
import { demiJourneesDepuis, porteUneAdaptation } from "./lecture";
import { ACTION_RATTRAPAGE } from "./rattrapage";
import { lireFicheJour, type EtatFicheJour } from "./fiche-jour";
import { PREFIXE_OBJET_RAPPEL } from "./rappel-objet";

export type EtatDemiJournee =
  "a_venir" | "a_signer" | "signee" | "signee_hors_creneau" | "rattrapage" | "non_signee";

/** Les états qui sont des ÉCARTS : visibles comme tels, comptés comme tels. */
export const ETATS_ECART: ReadonlySet<EtatDemiJournee> = new Set([
  "signee_hors_creneau",
  "rattrapage",
  "non_signee",
]);

export const LIBELLE_ETAT: Readonly<Record<EtatDemiJournee, string>> = {
  a_venir: "À venir",
  a_signer: "À signer maintenant",
  signee: "Signée",
  signee_hors_creneau: "Écart — signée hors de son créneau",
  rattrapage: "Écart — rattrapage de l'organisme",
  non_signee: "Écart — non signée",
};

/** Pure : l'état d'une demi-journée. */
export function etatDemiJournee(e: {
  readonly position: PositionFenetre;
  readonly fenetre: { readonly debut: Date; readonly fin: Date };
  readonly signeAt: Date | null;
  readonly rattrapage: boolean;
}): EtatDemiJournee {
  if (e.signeAt !== null) {
    const t = e.signeAt.getTime();
    return t >= e.fenetre.debut.getTime() && t < e.fenetre.fin.getTime()
      ? "signee"
      : "signee_hors_creneau";
  }
  if (e.rattrapage) return "rattrapage";
  if (e.position === "a_venir") return "a_venir";
  if (e.position === "ouverte") return "a_signer";
  return "non_signee";
}

export interface DemiJourneeSuivie {
  readonly creneauId: string;
  readonly date: string;
  readonly demiJournee: DemiJourneePrevue["demiJournee"];
  readonly heureDebut: string;
  readonly heureFin: string;
  readonly etat: EtatDemiJournee;
  readonly signeAt: Date | null;
  readonly motifRattrapage: string | null;
  /** Rappel automatique de début de demi-journée (journal des relances). */
  readonly rappelEnvoyeLe: Date | null;
}

export interface StagiaireSuivi {
  readonly enrollmentId: string;
  readonly stagiaireNom: string;
  /** Signature « nom tapé » ouverte. */
  readonly adaptation: boolean;
  readonly emailPresent: boolean;
  readonly demiJournees: ReadonlyArray<DemiJourneeSuivie>;
}

export interface ContresignatureDuJour {
  readonly demiJournee: DemiJourneePrevue["demiJournee"];
  readonly heureDebut: string;
  readonly heureFin: string;
  readonly faite: boolean;
}

export interface SuiviEmargement {
  readonly aujourdHui: string;
  readonly demain: string;
  readonly stagiaires: ReadonlyArray<StagiaireSuivi>;
  readonly contresignaturesDuJour: ReadonlyArray<ContresignatureDuJour>;
  readonly ficheDuJour: EtatFicheJour;
  /** Le jour J est-il une journée déclarée de la session ? */
  readonly sessionAJourAujourdHui: boolean;
}

/** Pure : le jour civil de Paris qui suit `iso`. */
export function lendemain(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Pure : les écarts d'un suivi, dans l'ordre des stagiaires puis des demi-journées. */
export function ecartsDuSuivi(
  suivi: Pick<SuiviEmargement, "stagiaires">,
): Array<{ stagiaire: StagiaireSuivi; demiJournee: DemiJourneeSuivie }> {
  return suivi.stagiaires.flatMap((s) =>
    s.demiJournees
      .filter((d) => ETATS_ECART.has(d.etat))
      .map((d) => ({ stagiaire: s, demiJournee: d })),
  );
}

function motifDuJournal(changes: unknown): string | null {
  if (changes === null || typeof changes !== "object") return null;
  const m = (changes as { motif?: unknown }).motif;
  return typeof m === "string" ? m : null;
}

/**
 * La lecture complète. `null` si la session n'existe pas OU si l'interrupteur
 * n'agit pas sur elle : éteint, rien d'autre que ce réglage n'est lu.
 */
export async function lireSuiviEmargement(
  sessionId: string,
  maintenant: Date = new Date(),
): Promise<SuiviEmargement | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  const tete = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { estTestInterne: true },
  });
  if (tete === null || !(await emargementParDemiJourneePour(tete))) return null;
  const colonne = await colonneDeclarationDisponible();
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      jours: { select: { date: true, heureDebut: true, heureFin: true } },
      enrollments: {
        where: { ...inscriptionsActives(), trainee: { deletedAt: null } },
        select: {
          id: true,
          adaptationsRealisees: true,
          besoinAdaptationDeclareAt: colonne,
          trainee: { select: { nom: true, prenom: true, email: true, situationHandicap: true } },
          questionnaires: {
            where: { type: "positionnement", reponduAt: { not: null } },
            select: { reponses: true },
          },
          presences: {
            select: {
              id: true,
              date: true,
              demiJournee: true,
              emargementSignatures: {
                where: { revokedAt: null },
                select: { signeAt: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { trainee: { nom: "asc" } },
      },
    },
  });
  if (session === null) return null;

  const aujourdHui = parisDateISO(maintenant);
  const creneauIds = session.enrollments.flatMap((e) => e.presences.map((p) => p.id));
  const [rattrapages, relances, contresignatures, ficheDuJour] = await Promise.all([
    creneauIds.length === 0
      ? Promise.resolve([])
      : prisma.activityLog.findMany({
          where: { action: ACTION_RATTRAPAGE, targetId: { in: creneauIds } },
          select: { targetId: true, changes: true },
        }),
    prisma.relanceJournal.findMany({
      where: { sessionId, objet: { startsWith: PREFIXE_OBJET_RAPPEL } },
      select: { enrollmentId: true, objet: true, creeLe: true },
    }),
    prisma.emargementContresignature.findMany({
      where: { sessionId, date: new Date(`${aujourdHui}T00:00:00.000Z`), revokedAt: null },
      select: { demiJournee: true },
    }),
    lireFicheJour(sessionId, aujourdHui),
  ]);

  const motifParCreneau = new Map(
    rattrapages.map((r) => [r.targetId ?? "", motifDuJournal(r.changes) ?? ""] as const),
  );
  const rappelParCle = new Map(
    relances.map((r) => [`${r.enrollmentId ?? ""}|${r.objet}`, r.creeLe] as const),
  );

  const stagiaires: StagiaireSuivi[] = session.enrollments.map((e) => {
    const signeAtParCreneau = new Map(
      e.presences.map((p) => [p.id, p.emargementSignatures[0]?.signeAt ?? null] as const),
    );
    const djs = demiJourneesDepuis(e.presences, session.jours).sort(
      (a, b) => fenetreSignature(a).debut.getTime() - fenetreSignature(b).debut.getTime(),
    );
    return {
      enrollmentId: e.id,
      stagiaireNom: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
      adaptation: porteUneAdaptation({
        situationHandicap: e.trainee.situationHandicap,
        besoinAdaptationDeclareAt: e.besoinAdaptationDeclareAt ?? null,
        reponsesPositionnements: e.questionnaires.map((q) => q.reponses),
        adaptationsRealisees: e.adaptationsRealisees,
      }),
      emailPresent: e.trainee.email.includes("@"),
      demiJournees: djs.map((dj) => {
        const fenetre = fenetreSignature(dj);
        const signeAt = signeAtParCreneau.get(dj.creneauId) ?? null;
        const motif = motifParCreneau.get(dj.creneauId);
        return {
          creneauId: dj.creneauId,
          date: dj.date,
          demiJournee: dj.demiJournee,
          heureDebut: fenetre.heureDebut,
          heureFin: fenetre.heureFin,
          etat: etatDemiJournee({
            position: positionFenetre(dj, maintenant),
            fenetre,
            signeAt,
            rattrapage: motif !== undefined,
          }),
          signeAt,
          motifRattrapage: motif ?? null,
          rappelEnvoyeLe:
            rappelParCle.get(`${e.id}|${PREFIXE_OBJET_RAPPEL}${cleDemiJournee(dj)}`) ?? null,
        };
      }),
    };
  });

  // Les demi-journées du jour, une fois chacune, pour la contresignature.
  const vues = new Map<string, ContresignatureDuJour>();
  for (const s of stagiaires) {
    for (const d of s.demiJournees) {
      if (d.date !== aujourdHui || vues.has(d.demiJournee)) continue;
      vues.set(d.demiJournee, {
        demiJournee: d.demiJournee,
        heureDebut: d.heureDebut,
        heureFin: d.heureFin,
        faite: contresignatures.some((c) => c.demiJournee === d.demiJournee),
      });
    }
  }

  return {
    aujourdHui,
    demain: lendemain(aujourdHui),
    stagiaires,
    contresignaturesDuJour: [...vues.values()],
    ficheDuJour,
    sessionAJourAujourdHui: session.jours.some((j) => parisDateISO(j.date) === aujourdHui),
  };
}
