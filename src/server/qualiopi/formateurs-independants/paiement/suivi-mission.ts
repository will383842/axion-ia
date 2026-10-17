/**
 * Formateurs indépendants — LE SUIVI QUOTIDIEN DU PAIEMENT PAR MISSION (lot D2, M22).
 *
 * Branche, à la suite du passage quotidien, les fonctions déjà écrites et restées
 * sans appelant :
 *   1. **rappel du brouillon mensuel** (`brouillonMensuelAPreparer`) : le 1er du
 *      mois, une alerte interne rappelle de lancer le calcul du mois écoulé.
 *      Rien n'est calculé seul : la décision 98 n'est pas arrêtée, et un calcul
 *      automatique changerait le circuit des salariés ;
 *   2. **relevé non validé** (`alerteReleveNonValide`) : à partir du 1er + N
 *      jours, une alerte interne s'il reste un relevé du mois écoulé à valider ;
 *      et (V1-C-3, `alerteReleveNonLance`) s'il n'existe AUCUN relevé mensuel
 *      alors que le run, simulé sans rien écrire, en préparerait.
 *      Aucun relevé n'est validé seul (décision prise : la validation humaine de
 *      chaque relevé de mission est gardée) ;
 *   3. **trop-perçu** (`traiterTropPercu`, F54) : l'avoir d'une pièce PAYÉE
 *      s'impute sur le relevé de mission suivant encore recalculable, sous les
 *      verrous ; sans relevé suivant à 60 jours, la demande de remboursement est
 *      marquée et F54 part, une fois par avoir ;
 *   4. **feuilles manquantes** (M8) : F35, 4e marche, et alertes internes aux
 *      délais existants (`feuilles-manquantes.ts`) ;
 *   5. **reprise de F37** (lot 8B) : les relevés payés dont le F37 s'est perdu
 *      (lot « Virements faits » interrompu) le reçoivent, une fois ;
 *   6. **F38** (V1-C-8, `virement-en-attente-suivi.ts`) : chaque facture de mission
 *      due dont le virement attend l'attestation URSSAF reçoit F38, une fois, sans
 *      attendre un clic en console.
 *
 * 🔴 ÉTEINT : sans date `formateurs.passage_paiement`, rien ne se passe. Ne lève
 * jamais. Alertes et journaux : des compteurs et des numéros de pièce, aucun nom.
 */

import { prisma } from "@/lib/prisma";
import { resolveRibFacture } from "@/lib/legal-identity";
import { sendTelegram } from "@/lib/telegram";
import { journaliser } from "@/server/journal/journaliser";
import {
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION,
  prendreVerrousRemuneration,
} from "@/server/qualiopi/remuneration/verrou-remuneration";

import { totaliser } from "../argent/calcul-mission";
import { jourParis } from "../argent/dates";
import { PARAMETRES_ARGENT_FORMATEURS } from "../argent/parametres";
import { envoyer } from "../envois";
import { traiterTropPercu } from "./corrections-mission";
import { etapesFeuilles, feuillesManquantes } from "./feuilles-manquantes";
import { appartientAuPassage } from "./passage-mission";
import { lireCandidats } from "./passage-mission-base";
import { lireDateBascule } from "./lecture-passage";
import {
  alerteReleveNonLance,
  alerteReleveNonValide,
  brouillonMensuelAPreparer,
  delaiAlerteReleveAtteint,
} from "./releve-mensuel-auto";
import { envoyerF38Dus } from "./virement-en-attente-suivi";
import { montantEnTexte, reprendreVirementsFaitsSansF37 } from "./virement-fait-envoi";

const NOM_MOIS = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export interface BilanSuiviMission {
  readonly etat: "coupe" | "fait" | "echec";
  readonly rappelBrouillon: boolean;
  /** Relevés non validés, plus (V1-C-3) relevés à préparer d'un calcul non lancé. */
  readonly alerteNonValides: number;
  /** V1-C-3 : relevés que le calcul du mois écoulé, jamais lancé, préparerait. */
  readonly relevesNonLances: number;
  readonly tropPercuImputeHtCents: number;
  readonly demandesRemboursement: number;
  readonly f54: number;
  /** Lot D2 (M8) : F35 parties, alertes internes J+10 et J+20. */
  readonly f35: number;
  readonly alertesFeuilles: number;
  /** Lot 8B : relevés payés dont le F37 perdu est repris. */
  readonly f37Repris: number;
  /** V1-C-8 : F38 enfilés (virement suspendu par l'attestation URSSAF). */
  readonly f38: number;
}

const VIDE = {
  rappelBrouillon: false,
  alerteNonValides: 0,
  relevesNonLances: 0,
  tropPercuImputeHtCents: 0,
  demandesRemboursement: 0,
  f54: 0,
  f35: 0,
  alertesFeuilles: 0,
  f37Repris: 0,
  f38: 0,
} as const;

async function alerter(body: string): Promise<void> {
  try {
    await sendTelegram({ tag: "AUTO", body });
  } catch {
    // Une alerte manquée ne défait rien.
  }
}

/** Lot 8B — trace « alerte de feuilles partie », une par (formateur, session, mois, étape). */
export const ACTION_ALERTE_FEUILLES = {
  alerte: "qualiopi.formateur.feuilles_alerte_j10",
  sur_constat: "qualiopi.formateur.feuilles_alerte_j20",
} as const;

/**
 * Pose la trace AVANT d'alerter : `false` si elle existe déjà, ou si elle n'a pas pu
 * être écrite (sans trace, l'alerte se répéterait chaque jour). Identifiants seuls.
 */
async function premiereAlerteFeuilles(
  etape: keyof typeof ACTION_ALERTE_FEUILLES,
  m: { trainerId: string; sessionId: string; mois: string },
): Promise<boolean> {
  const action = ACTION_ALERTE_FEUILLES[etape];
  const cle = `${m.sessionId}:${m.mois}`;
  const deja = await prisma.activityLog.count({
    where: { action, targetId: m.trainerId, changes: { path: ["cle"], equals: cle } },
  });
  if (deja > 0) return false;
  return journaliser(prisma, {
    action,
    targetType: "Trainer",
    targetId: m.trainerId,
    changes: { cle, sessionId: m.sessionId, mois: m.mois },
    session: null,
  });
}

/** Le mois civil qui précède `maintenant` (heure de Paris). */
function moisEcoule(maintenant: Date): { year: number; month: number } {
  const [y, m] = jourParis(maintenant).split("-").map(Number) as [number, number];
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

/**
 * Vérification 2, V2-A-8 — combien de mois AVANT le mois écoulé restent surveillés. Un
 * calcul oublié n'est pas « réglé » le 1er du mois suivant : c'est précisément le jour
 * où il dépasse 30 jours. Douze mois : au-delà, l'oubli relève d'un contrôle annuel.
 */
export const MOIS_OUBLIES_SURVEILLES = 12;

/** Les `n` mois civils qui précèdent `periode`, du plus récent au plus ancien. */
function moisPrecedents(periode: { year: number; month: number }, n: number) {
  const out: Array<{ year: number; month: number }> = [];
  let { year, month } = periode;
  for (let i = 0; i < n; i += 1) {
    if (month === 1) {
      year -= 1;
      month = 12;
    } else month -= 1;
    out.push({ year, month });
  }
  return out;
}

/**
 * V2-A-8 — les mois PLUS ANCIENS que le mois écoulé dont le calcul n'a jamais été lancé
 * (aucun relevé mensuel) alors que le run, simulé sans rien écrire, en préparerait ; et
 * les relevés de ces mois encore à valider. Deux lectures bon marché avant toute
 * simulation : le mois a-t-il eu des journées de session, et un relevé mensuel. Une
 * lecture ou une simulation en échec ne compte rien : jamais d'alerte inventée.
 */
async function moisOublies(periodeEcoulee: { year: number; month: number }): Promise<{
  nonLances: number;
  moisNonLances: string[];
  nonValides: number;
}> {
  const anciens = moisPrecedents(periodeEcoulee, MOIS_OUBLIES_SURVEILLES);
  let nonLances = 0;
  const moisNonLances: string[] = [];
  for (const m of anciens) {
    try {
      const debut = new Date(Date.UTC(m.year, m.month - 1, 1));
      const fin = new Date(Date.UTC(m.year, m.month, 1));
      const journees = await prisma.sessionJour.count({
        where: { date: { gte: debut, lt: fin } },
      });
      if (journees === 0) continue;
      const mensuels = await prisma.trainerStatement.count({
        where: { periodeYear: m.year, periodeMonth: m.month, origine: "releve_mensuel" },
      });
      if (mensuels > 0) continue;
      const { runRemunerationMensuelle } =
        await import("@/server/qualiopi/remuneration/statements");
      const n = (await runRemunerationMensuelle(m, { dryRun: true })).relevesEcrits;
      if (n > 0) {
        nonLances += n;
        moisNonLances.push(NOM_MOIS.format(new Date(Date.UTC(m.year, m.month - 1, 1))));
      }
    } catch {
      // Lecture ou simulation en échec : ce mois ne compte pas.
    }
  }
  let nonValides = 0;
  try {
    nonValides = await prisma.trainerStatement.count({
      where: {
        statut: { in: ["brouillon", "a_valider"] },
        OR: anciens.map((m) => ({ periodeYear: m.year, periodeMonth: m.month })),
      },
    });
  } catch {
    nonValides = 0;
  }
  return { nonLances, moisNonLances, nonValides };
}

/** 1 et 2 — rappels internes ; rien n'est calculé ni validé seul. */
async function rappelsMensuels(
  maintenant: Date,
): Promise<{ rappel: boolean; nonValides: number; nonLances: number }> {
  let rappel = false;
  const brouillon = brouillonMensuelAPreparer(maintenant);
  if (brouillon !== null) {
    rappel = true;
    await alerter(
      `Relevés de ${NOM_MOIS.format(new Date(Date.UTC(brouillon.year, brouillon.month - 1, 1)))} : le mois est clos, lancez le calcul depuis « Honoraires ». Chaque relevé attend ensuite votre validation.`,
    );
  }
  const periode = moisEcoule(maintenant);
  const nomMois = NOM_MOIS.format(new Date(Date.UTC(periode.year, periode.month - 1, 1)));
  const statuts = await prisma.trainerStatement.findMany({
    where: { periodeYear: periode.year, periodeMonth: periode.month },
    select: { statut: true, origine: true },
  });
  const nonLances = await relevesNonLances(maintenant, periode, statuts);
  if (nonLances > 0) {
    await alerter(
      `Le calcul des relevés de ${nomMois} n'a pas été lancé : ${nonLances} relevé(s) à préparer. Lancez-le depuis « Honoraires » (rien ne se calcule ni ne se valide seul).`,
    );
  }
  // V2-A-8 : les mois plus anciens restent surveillés tant qu'ils ne sont pas faits.
  const oublies = delaiAlerteReleveAtteint(maintenant)
    ? await moisOublies(periode)
    : { nonLances: 0, moisNonLances: [], nonValides: 0 };
  if (oublies.nonLances > 0) {
    await alerter(
      `Calcul des relevés jamais lancé pour ${oublies.moisNonLances.join(", ")} : ${oublies.nonLances} relevé(s) à préparer, et le délai de paiement court. Lancez-le depuis « Honoraires » (rien ne se calcule ni ne se valide seul).`,
    );
  }
  if (oublies.nonValides > 0) {
    await alerter(
      `${oublies.nonValides} relevé(s) de mois antérieurs à ${nomMois} attendent encore votre validation (rien ne se valide seul).`,
    );
  }
  const nonValides = statuts.filter(
    (s) => s.statut === "brouillon" || s.statut === "a_valider",
  ).length;
  if (
    alerteReleveNonValide(
      maintenant,
      statuts.map((s) => s.statut),
    )
  ) {
    await alerter(
      `${nonValides} relevé(s) de ${nomMois} attendent encore votre validation (rien ne se valide seul).`,
    );
    return {
      rappel,
      nonValides: nonValides + oublies.nonValides,
      nonLances: nonLances + oublies.nonLances,
    };
  }
  return { rappel, nonValides: oublies.nonValides, nonLances: nonLances + oublies.nonLances };
}

/**
 * V1-C-3 — le nombre de relevés que le calcul du mois écoulé préparerait, s'il n'a
 * jamais été lancé (aucun relevé mensuel du mois en base) et que le délai d'alerte
 * est atteint ; 0 sinon. Le run est SIMULÉ (`dryRun` : il calcule et n'écrit rien,
 * ne prend aucun verrou) : c'est la seule source de « ce que le mois doit payer ».
 * Une simulation en échec rend 0 : jamais d'alerte inventée, jamais de suivi arrêté.
 */
async function relevesNonLances(
  maintenant: Date,
  periode: { year: number; month: number },
  statuts: ReadonlyArray<{ origine?: string | null }>,
): Promise<number> {
  if (!delaiAlerteReleveAtteint(maintenant)) return 0;
  const relevesMensuelsDuMois = statuts.filter((s) => s.origine === "releve_mensuel").length;
  if (relevesMensuelsDuMois > 0) return 0;
  try {
    const { runRemunerationMensuelle } = await import("@/server/qualiopi/remuneration/statements");
    const simulation = await runRemunerationMensuelle(periode, { dryRun: true });
    const relevesAPreparer = simulation.relevesEcrits;
    return alerteReleveNonLance(maintenant, { relevesMensuelsDuMois, relevesAPreparer })
      ? relevesAPreparer
      : 0;
  } catch {
    return 0;
  }
}

/** 3 — trop-perçu, formateur par formateur, sous les verrous. */
async function tropPercus(
  maintenant: Date,
): Promise<{ imputeHtCents: number; demandes: number; f54: number }> {
  const ouverts = await prisma.trainerStatement.findMany({
    where: {
      origine: "passage_mission",
      avoirDeId: { not: null },
      statut: { not: "annule" },
      avoirDe: { statut: "paye" },
    },
    select: { trainerId: true },
    distinct: ["trainerId"],
    take: 100,
  });
  let imputeHtCents = 0;
  let demandes = 0;
  let f54 = 0;
  const aujourdhui = jourParis(maintenant);
  for (const { trainerId } of ouverts) {
    // Le relevé SUIVANT : un relevé de mission encore recalculable, le plus ancien.
    const suivant = await prisma.trainerStatement.findFirst({
      where: {
        trainerId,
        origine: "passage_mission",
        avoirDeId: null,
        statut: { in: ["brouillon", "a_valider"] },
      },
      orderBy: [{ periodeYear: "asc" }, { periodeMonth: "asc" }],
      select: { id: true, periodeYear: true, periodeMonth: true },
    });
    const b = await prisma.$transaction(async (tx) => {
      await prendreVerrousRemuneration(tx, {
        periodes: suivant ? [{ year: suivant.periodeYear, month: suivant.periodeMonth }] : [],
        trainerIds: [trainerId],
      });
      return traiterTropPercu(tx, trainerId, suivant?.id ?? null, aujourdhui, maintenant);
    }, DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION);
    imputeHtCents += b.imputeHtCents;
    demandes += b.demandesRemboursement;
    // Chantier C4 (défaut 3) : à CHAQUE passage, pas seulement quand une demande
    // vient d'être posée — un F54 en échec hier est repris aujourd'hui.
    f54 += await envoyerDemandesRemboursement(trainerId);
  }
  return { imputeHtCents, demandes, f54 };
}

/**
 * F54 — une fois par avoir dont le remboursement est DEMANDÉ et dont aucun envoi
 * n'est parti (journal des envois sous la clé `formateur-trop-percu-<id>`, un échec
 * ne compte pas). Chantier C4 : la demande posée un jour dont l'envoi échoue est
 * reprise au passage suivant (avant, seules les demandes de CE passage partaient).
 * Le reste dû est relu sur l'avoir et ses imputations ; le TTC vient de `totaliser`.
 * Les coordonnées bancaires sont celles d'AXION (celles de ses factures), jamais
 * celles d'un formateur ; elles ne vont dans aucun journal.
 */
async function envoyerDemandesRemboursement(trainerId: string): Promise<number> {
  const avoirs = await prisma.trainerStatement.findMany({
    where: {
      trainerId,
      avoirDeId: { not: null },
      statut: { not: "annule" },
      remboursementDemandeAt: { not: null },
    },
    select: {
      id: true,
      numeroFacture: true,
      totalHtCents: true,
      tvaRegime: true,
      avoirDe: { select: { numeroFacture: true } },
      imputations: { where: { statut: { not: "annule" } }, select: { montantHtCents: true } },
      trainer: { select: { email: true, prenom: true } },
    },
  });
  const rib = await resolveRibFacture().catch(() => null);
  let n = 0;
  for (const a of avoirs) {
    const resteHtCents = Math.max(
      0,
      -a.totalHtCents + a.imputations.reduce((s, l) => s + l.montantHtCents, 0),
    );
    if (resteHtCents === 0) continue;
    const jobId = `formateur-trop-percu-${a.id}`;
    // Une seule fois : le journal des envois fait foi (un échec ne compte pas), et
    // un F54 garé en corbeille de validation (en attente, approuvé ou refusé par un
    // humain) n'est jamais regaré chaque jour.
    const [journal, corbeille] = await Promise.all([
      prisma.emailLog.count({ where: { jobId, status: { not: "failed" } } }),
      prisma.emailOutbox.count({ where: { jobId } }),
    ]);
    if (journal + corbeille > 0) continue;
    const r = await envoyer({
      gabarit: "formateur-trop-percu",
      destinataire: a.trainer.email,
      entityType: "Trainer",
      entityId: trainerId,
      jobId,
      payload: {
        prenom: a.trainer.prenom,
        valeurs: {
          numéro: a.avoirDe?.numeroFacture ?? null,
          "numéro de l'avoir": a.numeroFacture,
          montant: montantEnTexte(
            totaliser([{ montantHtCents: resteHtCents }], a.tvaRegime).totalTtcCents,
          ),
          "coordonnées bancaires d'Axion":
            rib === null ? null : `${rib.titulaire} · IBAN ${rib.iban} · BIC ${rib.bic}`,
        },
      },
    }).catch(() => "indisponible" as const);
    if (r === "envoye") n += 1;
  }
  return n;
}

const JOUR_LONG = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * 4 — feuilles de présence manquantes (M8, sans pièce juridique nouvelle) : F35
 * une fois par (formateur, session, mois) dès J+3 ; alertes internes dès J+10 et
 * dès J+20, une fois chacune (lot 8B : trace au journal d'activité) — « payer sur
 * constat » n'est pas livré : décision humaine. Les trois délais viennent de
 * `argent/parametres.ts`.
 */
async function feuilles(
  maintenant: Date,
  bascule: string,
): Promise<{ f35: number; alertes: number }> {
  const aujourdhui = jourParis(maintenant);
  // Même règle que le passage (V1-C-2 : à cheval à prix figé compris).
  const candidats = (await lireCandidats(bascule)).filter((c) => appartientAuPassage(c, bascule));
  const manques = feuillesManquantes(candidats, aujourdhui);
  if (manques.length === 0) return { f35: 0, alertes: 0 };
  const [formateurs, sessions] = await Promise.all([
    prisma.trainer.findMany({
      where: { id: { in: [...new Set(manques.map((m) => m.trainerId))] } },
      select: { id: true, email: true, prenom: true, statut: true },
    }),
    prisma.trainingSession.findMany({
      where: { id: { in: [...new Set(manques.map((m) => m.sessionId))] } },
      select: { id: true, numero: true },
    }),
  ]);
  const formateur = new Map(formateurs.map((f) => [f.id, f]));
  const numero = new Map(sessions.map((x) => [x.id, x.numero]));
  let f35 = 0;
  let alertes = 0;
  for (const m of manques) {
    const t = formateur.get(m.trainerId);
    if (t === undefined || t.statut !== "sous_traitant") continue;
    const etapes = etapesFeuilles(m.derniereJournee, aujourdhui);
    if (etapes.includes("relance")) {
      const jobId = `fi-feuilles-${m.trainerId}-${m.sessionId}-${m.mois}`;
      // Une seule fois : le journal des envois fait foi (un échec ne compte pas).
      const deja = await prisma.emailLog.count({ where: { jobId, status: { not: "failed" } } });
      if (deja === 0) {
        const jours = [...new Set(m.manquantes.map((d) => d.jour))]
          .map((j) => JOUR_LONG.format(new Date(`${j}T12:00:00Z`)))
          .join(", ");
        const r = await envoyer({
          gabarit: "formateur-feuilles-manquantes",
          destinataire: t.email,
          entityType: "Trainer",
          entityId: m.trainerId,
          jobId,
          payload: { prenom: t.prenom, valeurs: { jour: jours, N: String(m.manquantes.length) } },
        }).catch(() => "indisponible" as const);
        if (r === "envoye") f35 += 1;
      }
    }
    const session = numero.get(m.sessionId) ?? "session";
    if (etapes.includes("alerte") && (await premiereAlerteFeuilles("alerte", m))) {
      alertes += 1;
      await alerter(
        `Feuilles de présence incomplètes ${PARAMETRES_ARGENT_FORMATEURS.feuillesAlerteJours} jours après la dernière journée (${session}, ${m.mois}) : ${m.manquantes.length} demi-journée(s) sans contresignature. Le formateur a été relancé ; la facture attend.`,
      );
    }
    if (etapes.includes("sur_constat") && (await premiereAlerteFeuilles("sur_constat", m))) {
      alertes += 1;
      await alerter(
        `Feuilles toujours incomplètes ${PARAMETRES_ARGENT_FORMATEURS.feuillesSurConstatJours} jours après la dernière journée (${session}, ${m.mois}). « Payer sur constat » n'est pas encore disponible : à décider à la main.`,
      );
    }
  }
  return { f35, alertes };
}

export async function passerSuiviMission(maintenant: Date): Promise<BilanSuiviMission> {
  try {
    const bascule = await lireDateBascule(prisma);
    if (bascule === null || jourParis(maintenant) < bascule) return { etat: "coupe", ...VIDE };
    const { rappel, nonValides, nonLances } = await rappelsMensuels(maintenant);
    const t = await tropPercus(maintenant);
    const f = await feuilles(maintenant, bascule);
    const f37Repris = await reprendreVirementsFaitsSansF37(maintenant);
    const f38 = await envoyerF38Dus(maintenant);
    return {
      etat: "fait",
      rappelBrouillon: rappel,
      alerteNonValides: nonValides + nonLances,
      relevesNonLances: nonLances,
      tropPercuImputeHtCents: t.imputeHtCents,
      demandesRemboursement: t.demandes,
      f54: t.f54,
      f35: f.f35,
      alertesFeuilles: f.alertes,
      f37Repris,
      f38,
    };
  } catch {
    return { etat: "echec", ...VIDE };
  }
}

/** Délai du rappel interne « relevé non validé », exposé pour l'écran et les tests. */
export const JOURS_ALERTE_RELEVE_NON_VALIDE = PARAMETRES_ARGENT_FORMATEURS.releveMensuelAlerteJours;
