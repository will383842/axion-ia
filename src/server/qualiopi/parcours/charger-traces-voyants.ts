/**
 * 🔴 CHANTIER QNC, LOT L12 — LA LECTURE DES TRACES DES VOYANTS.
 *
 * Pour un lot de sessions RÉELLES, lit en base ce que les lots producteurs ont
 * écrit, et le rend sous la forme que `construireVoyants` (PUR) consomme. Chaque
 * lecture est isolée : une qui échoue rend `illisible` pour SON indicateur — un
 * voyant qui ne sait pas ne verdit pas, et n'accuse pas non plus.
 *
 * ## Ce qui est lu, et ce qui ne l'est pas
 *
 *   - la trace est lue telle que son lot l'écrit (journal, date d'envoi, signature
 *     non révoquée…), jamais « la colonne est remplie » ;
 *   - un lot qui n'est pas sur main (L04 recueil temps 2, L09 étapes de
 *     réclamation) rend `lot_absent` : AUCUNE lecture n'est tentée ;
 *   - un lot sur main dont l'interrupteur n'agit pas sur la session rend
 *     `lot_eteint` quand sans lui la trace n'est pas produite (recueil, moyens,
 *     émargement par demi-journée, veille tracée) ;
 *   - une session ou une inscription d'ESSAI n'est jamais lue (`SESSION_REELLE`,
 *     `HORS_ESSAI`).
 */

import { prisma } from "@/lib/prisma";
import {
  ACTION_ANALYSE_VALIDEE,
  ACTION_DEROGATION_ACCORDEE,
  LOT_RECUEIL,
} from "../recueil/constantes";
import { getQualiopiConfig } from "../config/site-settings";
import { estActifPour, lireInterrupteurQualiopi } from "../socle/interrupteurs";
import { HORS_ESSAI, SESSION_REELLE } from "../essai/perimetre";
import { inscriptionsActives } from "../inscriptions/inscriptions-actives";
import { lireSuiviEmargement, ecartsDuSuivi } from "../emargement/demi-journee/suivi";
import { ACTION_TEST_LIEN, ACTION_VERIFICATION } from "../moyens/verification-moyens";
import { categoriesPourModalite, type Modalite } from "../moyens/moyens-regles";
import { besoinAdaptationDeclare, etatReponseAdaptation } from "../adaptation/reponse-organisme";
import { lireCircuitAdaptation } from "../adaptation/journal-consignation";
import { colonneDeclarationDisponible } from "../adaptation/colonne-declaration";
import { lireJournalVeilles, regleVeilleEnVigueur } from "../veille/regle-veille";
import { idsVeillesDecidees } from "../veille/trace-veille";
import { whereReseauHandicapActif } from "../conformite/conformite-service";
import { lirePedagogie } from "../pedagogie/interrupteur";
import type {
  TraceAdaptation,
  TraceAppreciations,
  TraceConvocation,
  TraceEmargementDemiJournee,
  TraceEvaluationAcquis,
  TraceHandicap,
  TraceIntervenants,
  TraceLue,
  TraceMoyens,
  TraceRecueilTemps1,
  TraceRessources,
  TraceSousTraitance,
  TraceVeille,
  TracesVoyants,
} from "./voyants-indicateurs";

/** Une session à lire : le strict nécessaire, déjà filtré hors essai. */
export interface SessionALire {
  readonly id: string;
  readonly formationId: string;
  readonly modalite: Modalite;
  readonly dateDebut: Date;
  readonly dateFin: Date;
  readonly formateurPrincipalId: string | null;
  readonly projetId: string | null;
  readonly estTestInterne: boolean;
}

const lue = <T extends object>(t: T): TraceLue<T> => ({ lecture: "lue", ...t });

async function protege<T extends object>(f: () => Promise<TraceLue<T>>): Promise<TraceLue<T>> {
  try {
    return await f();
  } catch {
    return { lecture: "illisible" };
  }
}

function max(dates: ReadonlyArray<Date | null | undefined>): Date | null {
  let m: Date | null = null;
  for (const d of dates) if (d && (m === null || d > m)) m = d;
  return m;
}

/** Les sessions RÉELLES du périmètre, par leurs identifiants. */
export async function sessionsALire(ids: ReadonlyArray<string>): Promise<SessionALire[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.trainingSession.findMany({
    where: { id: { in: [...ids] }, ...SESSION_REELLE },
    select: {
      id: true,
      formationId: true,
      modalite: true,
      dateDebut: true,
      dateFin: true,
      formateurPrincipalId: true,
      projetId: true,
      estTestInterne: true,
    },
  });
  return rows.map((r) => ({ ...r, modalite: r.modalite as Modalite }));
}

// ── Organisme : ne dépend d'aucune session ────────────────────────────────────

async function lireVeille(): Promise<TraceLue<TraceVeille>> {
  const regle = await regleVeilleEnVigueur();
  if (regle === undefined) return { lecture: "lot_eteint" };
  const trace = await lireJournalVeilles(prisma as never);
  // Ind. 23 = veille LÉGALE et réglementaire. Les veilles métiers (24) et
  // pédagogiques/technologiques (25) ne l'allument pas.
  const decideesToutTypes = idsVeillesDecidees(trace);
  const legales =
    decideesToutTypes.length === 0
      ? []
      : await prisma.veille.findMany({
          where: { id: { in: decideesToutTypes }, type: "legale" },
          select: { id: true },
        });
  const decidees = new Set(legales.map((v) => v.id));
  const derniereDecisionLe = max(
    [...trace.decisions.entries()].filter(([id]) => decidees.has(id)).map(([, d]) => d.decideLe),
  );
  return lue<TraceVeille>({ derniereDecisionLe });
}

async function lireHandicap(): Promise<TraceLue<TraceHandicap>> {
  // Le NOM porte un défaut codé : seul l'e-mail SAISI prouve « nommé et joignable ».
  // Même lecture que le moteur de conformité (une seule vérité).
  const [email, reseau] = await Promise.all([
    getQualiopiConfig("referent_handicap_email").catch(() => ""),
    prisma.partenariat.count({ where: whereReseauHandicapActif() }),
  ]);
  return lue<TraceHandicap>({
    referentNommeEtJoignable: typeof email === "string" && email.includes("@"),
    reseauActif: reseau > 0,
  });
}

// ── Par session ────────────────────────────────────────────────────────────────

async function lireRecueil(s: SessionALire): Promise<TraceLue<TraceRecueilTemps1>> {
  const etat = await lireInterrupteurQualiopi(LOT_RECUEIL);
  if (!estActifPour(etat, { estTestInterne: s.estTestInterne })) return { lecture: "lot_eteint" };
  const questionnaires =
    s.projetId === null
      ? []
      : await prisma.questionnaireCadrage.findMany({
          where: { projetId: s.projetId, modele: "recueil_besoin_v1" },
          select: { id: true, statut: true, reponseRecueLe: true },
        });
  const ids = questionnaires.map((q) => q.id);
  const [validation, derogation] = await Promise.all([
    ids.length === 0
      ? Promise.resolve(null)
      : prisma.activityLog.findFirst({
          where: {
            action: ACTION_ANALYSE_VALIDEE,
            targetType: "QuestionnaireCadrage",
            targetId: { in: ids },
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
    prisma.activityLog.findFirst({
      where: { action: ACTION_DEROGATION_ACCORDEE, targetType: "TrainingSession", targetId: s.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return lue<TraceRecueilTemps1>({
    analyseValideeLe: validation?.createdAt ?? null,
    reponseRecueLe: max(questionnaires.map((q) => q.reponseRecueLe)),
    derogationLe: derogation?.createdAt ?? null,
  });
}

interface InscriptionLue {
  readonly id: string;
  readonly traineeId: string;
  readonly convocationEnvoyeeAt: Date | null;
  readonly adaptationsRealisees: string | null;
  readonly besoinAdaptationDeclareAt?: Date | null;
  readonly trainee: { readonly situationHandicap: boolean };
  readonly questionnaires: ReadonlyArray<{
    readonly type: string;
    readonly reponduAt: Date | null;
    readonly reponses: unknown;
  }>;
  readonly evaluations: ReadonlyArray<{ readonly dateEvaluation: Date }>;
  readonly remises: ReadonlyArray<{ readonly objet: string; readonly survenuLe: Date }>;
}

async function inscriptionsDe(
  sessionIds: ReadonlyArray<string>,
): Promise<Map<string, InscriptionLue[]>> {
  const colonne = await colonneDeclarationDisponible();
  const rows = await prisma.enrollment.findMany({
    where: {
      sessionId: { in: [...sessionIds] },
      ...inscriptionsActives(),
      ...HORS_ESSAI,
      session: SESSION_REELLE,
    },
    select: {
      id: true,
      sessionId: true,
      traineeId: true,
      convocationEnvoyeeAt: true,
      adaptationsRealisees: true,
      besoinAdaptationDeclareAt: colonne,
      trainee: { select: { situationHandicap: true } },
      questionnaires: {
        where: { reponduAt: { not: null } },
        select: { type: true, reponduAt: true, reponses: true },
      },
      evaluations: { where: { type: "finale" }, select: { dateEvaluation: true } },
    },
  });
  const remises = await prisma.remiseRetour.findMany({
    where: { sessionId: { in: [...sessionIds] }, nature: "remise", enrollmentId: { not: null } },
    select: { enrollmentId: true, objet: true, survenuLe: true },
  });
  const parInscription = new Map<string, { objet: string; survenuLe: Date }[]>();
  for (const r of remises) {
    if (r.enrollmentId === null) continue;
    const l = parInscription.get(r.enrollmentId) ?? [];
    l.push({ objet: r.objet, survenuLe: r.survenuLe });
    parInscription.set(r.enrollmentId, l);
  }
  const out = new Map<string, InscriptionLue[]>();
  for (const r of rows) {
    const l = out.get(r.sessionId) ?? [];
    l.push({
      id: r.id,
      traineeId: r.traineeId,
      convocationEnvoyeeAt: r.convocationEnvoyeeAt,
      adaptationsRealisees: r.adaptationsRealisees,
      ...(r.besoinAdaptationDeclareAt !== undefined
        ? { besoinAdaptationDeclareAt: r.besoinAdaptationDeclareAt }
        : {}),
      trainee: r.trainee,
      questionnaires: r.questionnaires,
      evaluations: r.evaluations,
      remises: parInscription.get(r.id) ?? [],
    });
    out.set(r.sessionId, l);
  }
  return out;
}

function convocation(ins: InscriptionLue[]): TraceLue<TraceConvocation> {
  const convoques = ins.filter((i) => i.convocationEnvoyeeAt !== null);
  return lue<TraceConvocation>({
    stagiairesActifs: ins.length,
    convoques: convoques.length,
    derniereConvocation: max(convoques.map((i) => i.convocationEnvoyeeAt)),
    piecesRemises: ins.reduce((n, i) => n + i.remises.length, 0),
  });
}

async function adaptation(
  s: SessionALire,
  ins: InscriptionLue[],
): Promise<TraceLue<TraceAdaptation>> {
  const circuits = await lireCircuitAdaptation(
    ins.map((i) => ({
      id: i.id,
      traineeId: i.traineeId,
      finSession: s.dateFin,
      positionnements: i.questionnaires
        .filter((q) => q.type === "positionnement")
        .map((q) => ({ reponses: q.reponses, reponduAt: q.reponduAt })),
    })),
  );
  let besoins = 0;
  let consignees = 0;
  const dates: Array<Date | null> = [];
  for (const i of ins) {
    const declare = besoinAdaptationDeclare({
      situationHandicap: i.trainee.situationHandicap,
      reponsesPositionnements: i.questionnaires
        .filter((q) => q.type === "positionnement")
        .map((q) => q.reponses),
      besoinAdaptationDeclareAt: i.besoinAdaptationDeclareAt,
    });
    if (!declare) continue;
    besoins += 1;
    const h = circuits.get(i.id);
    if (h && etatReponseAdaptation(true, i.adaptationsRealisees, h) === "consignee") {
      consignees += 1;
      dates.push(h.derniereConsignationLe);
    }
  }
  return lue<TraceAdaptation>({
    besoinsDeclares: besoins,
    reponsesConsignees: consignees,
    derniereReponse: max(dates),
  });
}

function evaluation(ins: InscriptionLue[]): TraceLue<TraceEvaluationAcquis> {
  const evalues = ins.filter((i) => i.evaluations.length > 0);
  return lue<TraceEvaluationAcquis>({
    stagiairesActifs: ins.length,
    evalues: evalues.length,
    derniereEvaluation: max(evalues.flatMap((i) => i.evaluations.map((e) => e.dateEvaluation))),
  });
}

function appreciations(ins: InscriptionLue[]): TraceLue<TraceAppreciations> {
  const chauds = ins
    .map((i) => i.questionnaires.find((q) => q.type === "satisfaction_chaud"))
    .filter((q) => q !== undefined);
  return lue<TraceAppreciations>({
    stagiairesActifs: ins.length,
    chaudRepondus: chauds.length,
    dernierRepondu: max(chauds.map((q) => q.reponduAt)),
  });
}

function ressources(ins: InscriptionLue[]): TraceLue<TraceRessources> {
  const avec = ins.filter((i) => i.remises.some((r) => r.objet.startsWith("support_")));
  return lue<TraceRessources>({
    stagiairesActifs: ins.length,
    avecSupportRemis: avec.length,
    derniereRemise: max(
      avec.flatMap((i) =>
        i.remises.filter((r) => r.objet.startsWith("support_")).map((r) => r.survenuLe),
      ),
    ),
  });
}

async function emargement(
  s: SessionALire,
  maintenant: Date,
): Promise<TraceLue<TraceEmargementDemiJournee>> {
  const suivi = await lireSuiviEmargement(s.id, maintenant);
  // `null` : le lot n'agit pas sur cette session — pas de trace par demi-journée.
  if (suivi === null) return { lecture: "lot_eteint" };
  const toutes = suivi.stagiaires.flatMap((x) => x.demiJournees);
  const echues = toutes.filter((d) => d.etat !== "a_venir" && d.etat !== "a_signer");
  return lue<TraceEmargementDemiJournee>({
    echues: echues.length,
    signeesDansLeCreneau: echues.filter((d) => d.etat === "signee").length,
    ecarts: ecartsDuSuivi(suivi).length,
    aVenir: toutes.length - echues.length,
  });
}

async function moyens(s: SessionALire): Promise<TraceLue<TraceMoyens>> {
  const etat = await lireInterrupteurQualiopi("moyens");
  if (!estActifPour(etat, { estTestInterne: s.estTestInterne })) return { lecture: "lot_eteint" };
  const [verif, lien, nonVerifies] = await Promise.all([
    prisma.activityLog.findFirst({
      where: { action: ACTION_VERIFICATION, targetId: s.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.activityLog.findFirst({
      where: { action: ACTION_TEST_LIEN, targetId: s.id },
      orderBy: { createdAt: "desc" },
      select: { changes: true },
    }),
    prisma.moyenPedagogique.count({
      where: {
        actif: true,
        dateVerification: null,
        categorie: { in: [...categoriesPourModalite(s.modalite)] },
      },
    }),
  ]);
  const ok = (lien?.changes as { ok?: unknown } | null | undefined)?.ok;
  return lue<TraceMoyens>({
    verifieLe: verif?.createdAt ?? null,
    moyensNonVerifies: nonVerifies,
    lienTeste: s.modalite === "presentiel" ? null : ok === true,
  });
}

async function intervenants(s: SessionALire): Promise<TraceLue<TraceIntervenants>> {
  if (s.formateurPrincipalId === null) {
    return lue<TraceIntervenants>({
      formateurDesigne: false,
      habilitationActive: false,
      habiliteLe: null,
    });
  }
  const h = await prisma.trainerHabilitation.findFirst({
    where: { trainerId: s.formateurPrincipalId, formationId: s.formationId, retireAt: null },
    select: { habiliteAt: true },
  });
  return lue<TraceIntervenants>({
    formateurDesigne: true,
    habilitationActive: h !== null,
    habiliteLe: h?.habiliteAt ?? null,
  });
}

async function sousTraitance(s: SessionALire): Promise<TraceLue<TraceSousTraitance>> {
  const membres = await prisma.sessionFormateur.findMany({
    where: { sessionId: s.id },
    select: { trainerId: true },
  });
  const ids = new Set(membres.map((m) => m.trainerId));
  if (s.formateurPrincipalId !== null) ids.add(s.formateurPrincipalId);
  const sts = await prisma.trainer.findMany({
    where: { id: { in: [...ids] }, statut: "sous_traitant" },
    select: { id: true },
  });
  if (sts.length === 0)
    return lue<TraceSousTraitance>({
      sousTraitants: 0,
      controlesConformes: 0,
      dernierControle: null,
    });
  const verifs = await prisma.verificationRegistreSousTraitance.findMany({
    where: { trainerId: { in: sts.map((t) => t.id) } },
    orderBy: { verifieAt: "desc" },
    select: { trainerId: true, verdict: true, verifieAt: true },
  });
  const dernier = new Map<string, { verdict: string; verifieAt: Date }>();
  for (const v of verifs) if (!dernier.has(v.trainerId)) dernier.set(v.trainerId, v);
  const conformes = [...dernier.values()].filter((v) => v.verdict === "vert");
  return lue<TraceSousTraitance>({
    sousTraitants: sts.length,
    controlesConformes: conformes.length,
    dernierControle: max(conformes.map((v) => v.verifieAt)),
  });
}

/**
 * Les traces de chaque session RÉELLE demandée. Une session d'essai (ou
 * inconnue) n'a pas d'entrée : l'appelant la traite `sans_objet`.
 */
export async function chargerTracesVoyants(
  sessionIds: ReadonlyArray<string>,
  maintenant: Date,
): Promise<Map<string, TracesVoyants>> {
  const out = new Map<string, TracesVoyants>();
  const sessions = await sessionsALire(sessionIds);
  if (sessions.length === 0) return out;
  const [parSession, veille, handicap] = await Promise.all([
    inscriptionsDe(sessions.map((s) => s.id)).catch(() => null),
    protege(lireVeille),
    protege(lireHandicap),
  ]);
  const etatPedagogie = await lirePedagogie();
  for (const s of sessions) {
    const ins = parSession?.get(s.id) ?? [];
    const base = parSession === null ? { lecture: "illisible" as const } : null;
    const demarree = s.dateDebut <= maintenant;
    const [i4, i10, i12, i17, i21, i27] = await Promise.all([
      protege(() => lireRecueil(s)),
      base ?? protege(() => adaptation(s, ins)),
      demarree
        ? protege(() => emargement(s, maintenant))
        : Promise.resolve(
            lue<TraceEmargementDemiJournee>({
              echues: 0,
              signeesDansLeCreneau: 0,
              ecarts: 0,
              aVenir: 1,
            }),
          ),
      protege(() => moyens(s)),
      protege(() => intervenants(s)),
      protege(() => sousTraitance(s)),
    ]);
    out.set(s.id, {
      i4,
      // L04 n'est pas sur main : aucune lecture tentée, jamais de vert.
      i6: { lecture: "lot_absent" },
      i9: base ?? convocation(ins),
      i10,
      i11: base ?? evaluation(ins),
      i12,
      i17,
      // L08 éteint : les remises `support_*` ne sont jamais écrites, leur absence
      // ne prouve rien. « Non mesuré », jamais rouge ni vert.
      i19:
        base ??
        (estActifPour(etatPedagogie, { estTestInterne: s.estTestInterne })
          ? ressources(ins)
          : { lecture: "lot_eteint" as const }),
      i21,
      i23: veille,
      i26: handicap,
      i27,
      i30: base ?? appreciations(ins),
      // L09 n'écrit pas encore les étapes (aucun écrivain sur main).
      i31: { lecture: "lot_absent" },
    });
  }
  return out;
}
