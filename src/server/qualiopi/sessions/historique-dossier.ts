/**
 * 🔴 ADR 0060 (D8) — CE QUE VOIT LE CERTIFICATEUR : « rien d'invisible ».
 *
 * Trois sections du dossier de session, écrites ici en fonctions PURES (le
 * dossier `dossier-session.ts` les charge et les place dans `index.txt`) :
 *
 *   1. « Historique du dossier : verrouillage et réouvertures » — chaque
 *      réouverture (date et heure de Paris, NOM de l'auteur, motif intégral),
 *      les actions du journal d'activité menées pendant l'ouverture (avec
 *      avant/après quand ils existent), puis le reverrouillage ;
 *   2. « Signatures révoquées » — motif, date, auteur. Jusqu'ici elles étaient
 *      retirées de la chaîne sans être nommées ;
 *   3. « Origine des réponses aux questionnaires » — stagiaire, organisme, ou
 *      non tracée (sur le modèle de « Provenance des présences »).
 *
 * Et le chargement des réouvertures pour le manifeste global.
 *
 * Module sans `"use server"`.
 */

import { prisma } from "@/lib/prisma";
import { dateHeureParis, dateParis, type TypeEvenementDossier } from "./verrou-dossier";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Historique du verrou
// ─────────────────────────────────────────────────────────────────────────────

export interface EvenementHistorique {
  readonly type: TypeEvenementDossier;
  readonly createdAt: Date;
  readonly auteurNom: string;
  readonly motif: string | null;
}

export interface ActionJournal {
  readonly createdAt: Date;
  readonly action: string;
  readonly auteur: string | null;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly changes: unknown;
  /**
   * Vrai quand l'action porte sur un stagiaire ANONYMISÉ (RGPD art. 17) : le
   * fait reste au dossier, le détail (`changes`, qui peut porter un motif libre
   * comme « Maladie ») n'y est pas recopié.
   */
  readonly detailMasque?: boolean;
}

/**
 * 🔴 ADR 0060 — la garde `assertDossierOuvert` est un contrôle HORS
 * transaction : une écriture autorisée pendant l'ouverture peut atterrir
 * quelques instants APRÈS un reverrouillage concurrent. Elle n'échappe pas
 * pour autant au dossier : les actions inscrites dans ce délai après un
 * reverrouillage sont listées avec l'ouverture, et signalées comme telles.
 */
export const DELAI_GRACE_REVERROUILLAGE_MS = 5 * 60 * 1000;

export const MENTION_DETAIL_MASQUE =
  "détail masqué : stagiaire anonymisé (RGPD art. 17), l'action reste au dossier";

/** Ligne unique qui dit la limite du journal d'activité, sans la taire. */
export const MENTION_JOURNAL_BEST_EFFORT =
  "Note : le journal d'activité est tenu en « meilleur effort » — une action dont l'inscription au journal aurait échoué n'y figure pas. " +
  "Les réouvertures et reverrouillages, eux, sont inscrits dans une table en ajout seul, que la base refuse de modifier ou d'effacer.";

export const TITRE_HISTORIQUE = "Historique du dossier : verrouillage et réouvertures";

function resumeChanges(changes: unknown): string {
  if (changes === null || changes === undefined) return "";
  let texte: string;
  try {
    texte = JSON.stringify(changes);
  } catch {
    return "";
  }
  if (texte === "{}" || texte === "null") return "";
  return texte.length > 600 ? ` — ${texte.slice(0, 600)}…` : ` — ${texte}`;
}

/**
 * Les lignes de la section « Historique du dossier ». L'état actuel est dit en
 * premier, avec le MÊME texte que le bandeau de l'écran : l'appelant passe
 * `texteEtatVerrou(etat)`.
 */
export function sectionHistoriqueDossier(input: {
  /** `texteEtatVerrou(etat)` — le texte même du bandeau de l'écran. */
  readonly texteEtat: string | null;
  readonly evenements: ReadonlyArray<EvenementHistorique>;
  readonly journal: ReadonlyArray<ActionJournal>;
  readonly maintenant: Date;
  /** Vrai quand le chargement a atteint son plafond : la liste n'est pas complète, et c'est dit. */
  readonly journalTronque?: boolean;
}): { lignes: string[]; nbReouvertures: number } {
  const lignes: string[] = [TITRE_HISTORIQUE];
  if (input.texteEtat !== null) lignes.push(`  État à la date de ce dossier : ${input.texteEtat}`);
  const evs = [...input.evenements].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const reouvertures = evs.filter((e) => e.type === "reouverture");
  if (evs.length === 0) {
    lignes.push("  Aucune réouverture : le dossier n'a jamais été rouvert après sa clôture.");
    lignes.push(`  ${MENTION_JOURNAL_BEST_EFFORT}`);
    return { lignes, nbReouvertures: 0 };
  }
  let n = 0;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i] as EvenementHistorique;
    if (e.type === "reverrouillage") {
      lignes.push(
        `  Reverrouillage — le ${dateHeureParis(e.createdAt)}, par ${e.auteurNom}` +
          (e.motif !== null && e.motif !== "" ? ` — motif : « ${e.motif} »` : ""),
      );
      continue;
    }
    n += 1;
    lignes.push(`  Réouverture n°${n} — le ${dateHeureParis(e.createdAt)}, par ${e.auteurNom}`);
    lignes.push(`    Motif : « ${e.motif ?? ""} »`);
    const suivant = evs.slice(i + 1).find((x) => x.type === "reverrouillage");
    const reouvertureSuivante = evs.slice(i + 1).find((x) => x.type === "reouverture");
    const fin = suivant?.createdAt ?? input.maintenant;
    // Délai de grâce après le reverrouillage (écritures engagées avant lui),
    // borné par la réouverture suivante pour ne rien lister deux fois.
    const finGrace =
      suivant === undefined
        ? fin.getTime()
        : Math.min(
            fin.getTime() + DELAI_GRACE_REVERROUILLAGE_MS,
            reouvertureSuivante !== undefined
              ? reouvertureSuivante.createdAt.getTime() - 1
              : Number.POSITIVE_INFINITY,
          );
    const pendant = input.journal
      .filter(
        (a) =>
          a.createdAt.getTime() >= e.createdAt.getTime() &&
          a.createdAt.getTime() <= finGrace &&
          a.action !== "qualiopi.session.dossier.rouvert" &&
          a.action !== "qualiopi.session.dossier.reverrouille",
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (pendant.length === 0) {
      lignes.push("    Actions menées pendant l'ouverture : aucune au journal d'activité.");
    } else {
      lignes.push(
        `    Actions menées pendant l'ouverture (${pendant.length}, journal d'activité) :`,
      );
      for (const a of pendant) {
        const apresReverrouillage = a.createdAt.getTime() > fin.getTime();
        lignes.push(
          `      - ${dateHeureParis(a.createdAt)} — ${a.action}` +
            (a.auteur !== null ? ` — par ${a.auteur}` : "") +
            (a.targetType !== null
              ? ` — ${a.targetType}${a.targetId !== null ? ` ${a.targetId.slice(0, 8)}` : ""}`
              : "") +
            (a.detailMasque === true ? ` — ${MENTION_DETAIL_MASQUE}` : resumeChanges(a.changes)) +
            (apresReverrouillage
              ? " — ⚠️ inscrite APRÈS le reverrouillage (écriture engagée pendant l'ouverture)"
              : ""),
        );
      }
    }
    if (input.journalTronque === true) {
      lignes.push(
        `    ⚠️ Liste tronquée : le journal compte plus de ${PLAFOND_JOURNAL} actions depuis la première réouverture ; les suivantes sont au journal d'activité de la console.`,
      );
    }
    if (suivant === undefined) {
      lignes.push("    Toujours rouvert à la date de ce dossier : aucun reverrouillage.");
    }
  }
  lignes.push(`  ${MENTION_JOURNAL_BEST_EFFORT}`);
  return { lignes, nbReouvertures: reouvertures.length };
}

/**
 * Le signalement porté EN TÊTE de l'index dès qu'il y a eu au moins une
 * réouverture. ⚠️ Ce n'est PAS un « avertissement » au sens du dossier : une
 * réouverture tracée, puis close à nouveau, ne rend pas le dossier incomplet
 * (l'appelant ne le verse donc pas dans `avertissements`).
 */
export function avertissementReouvertures(nb: number): string | null {
  if (nb === 0) return null;
  return (
    `⚠️ Ce dossier a été rouvert ${nb} fois après sa clôture : les pièces ou preuves ont pu être modifiées pendant l'ouverture. ` +
    `Voir « ${TITRE_HISTORIQUE} » (date, auteur, motif, actions menées).`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Signatures révoquées
// ─────────────────────────────────────────────────────────────────────────────

export interface SignatureRevoquee {
  readonly famille: "émargement" | "contreseing formateur" | "pièce";
  /** Ce qui avait été signé : « Simone Blanc — 10/09/2026 matin », « AXI-DOC-2026-007 ». */
  readonly objet: string;
  readonly revokedAt: Date;
  readonly motif: string | null;
  readonly auteur: string | null;
}

export function sectionSignaturesRevoquees(revoquees: ReadonlyArray<SignatureRevoquee>): string[] {
  if (revoquees.length === 0) {
    return ["Signatures révoquées : aucune."];
  }
  const tri = [...revoquees].sort((a, b) => a.revokedAt.getTime() - b.revokedAt.getTime());
  return [
    `Signatures révoquées (${tri.length}) — retirées du décompte, conservées en base avec leur empreinte :`,
    ...tri.map(
      (s) =>
        `  ${s.famille} — ${s.objet} — révoquée le ${dateHeureParis(s.revokedAt)}` +
        ` par ${s.auteur ?? "auteur non renseigné"} — motif : « ${s.motif ?? "non renseigné"} »`,
    ),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Origine des réponses aux questionnaires
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionnaireRepondu {
  readonly type: string;
  readonly origine: "stagiaire" | "organisme" | null;
}

export const LIBELLE_ORIGINE_NULLE = "origine non tracée (réponse antérieure au 30/09/2026)";

export function sectionOrigineReponses(reponses: ReadonlyArray<QuestionnaireRepondu>): string[] {
  if (reponses.length === 0) {
    return ["Origine des réponses aux questionnaires : aucune réponse recueillie."];
  }
  let parRepondant = 0;
  let parOrganisme = 0;
  let nonTracees = 0;
  for (const r of reponses) {
    if (r.origine === "stagiaire") parRepondant += 1;
    else if (r.origine === "organisme") parOrganisme += 1;
    else nonTracees += 1;
  }
  const s = (n: number): string => (n > 1 ? "s" : "");
  return [
    `Origine des réponses aux questionnaires (${reponses.length}) : ` +
      `${parRepondant} répondue${s(parRepondant)} par le stagiaire lui-même (ou l'entreprise, pour l'enquête entreprise), ` +
      `${parOrganisme} saisie${s(parOrganisme)} par l'organisme à sa place, ` +
      `${nonTracees} ${LIBELLE_ORIGINE_NULLE}.`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chargement
// ─────────────────────────────────────────────────────────────────────────────

function tableAbsente(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "P2022";
}

/** Événements d'UNE session ; `null` si la table n'existe pas encore (fenêtre de déploiement). */
export async function lireEvenementsDossier(
  sessionId: string,
): Promise<EvenementHistorique[] | null> {
  try {
    return await prisma.sessionDossierEvenement.findMany({
      where: { sessionId },
      select: { type: true, createdAt: true, auteurNom: true, motif: true },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
}

/** Plafond du chargement ; au-delà, la section le DIT (jamais une liste coupée en silence). */
export const PLAFOND_JOURNAL = 1000;

/**
 * Clé que portent, dans `changes`, les actions dont la cible ne se retrouve
 * plus par son identifiant (une cible SUPPRIMÉE, comme un incident).
 */
export const CLE_DOSSIER_SESSION = "dossierSessionId";

interface CibleJournal {
  readonly id: string;
  /** Vrai si la cible porte sur un stagiaire anonymisé. */
  readonly anonyme: boolean;
}

const estAnonyme = (t: { deletedAt: Date | null } | null | undefined): boolean =>
  t != null && t.deletedAt !== null;

/**
 * 🔴 ADR 0060 (D8) — TOUS les objets d'un dossier sous lesquels une action
 * VERROU se journalise, par `targetType`. La première version ne cherchait que
 * la session, les inscriptions et les pièces : une présence corrigée à la main
 * (`PresenceCreneau`), un émargement révoqué (`EmargementSignature`), une
 * évaluation, un questionnaire saisi, un relevé importé ou un incident
 * disparaissaient de l'historique, qui écrivait alors « aucune au journal » —
 * une affirmation d'absence fausse remise au certificateur.
 *
 * Le test `journal-couvre-ecritures-verrou.spec.ts` lit chaque action VERROU
 * du registre et rougit si elle journalise sous un `targetType` absent d'ici.
 */
const CHARGEURS_CIBLES: Readonly<Record<string, (sessionId: string) => Promise<CibleJournal[]>>> = {
  TrainingSession: async (sessionId) => [{ id: sessionId, anonyme: false }],
  Enrollment: async (sessionId) =>
    (
      await prisma.enrollment.findMany({
        where: { sessionId },
        select: { id: true, trainee: { select: { deletedAt: true } } },
      })
    ).map((e) => ({ id: e.id, anonyme: estAnonyme(e.trainee) })),
  DocumentGenere: async (sessionId) =>
    (
      await prisma.documentGenere.findMany({
        where: { sessionId },
        select: { id: true, trainee: { select: { deletedAt: true } } },
      })
    ).map((d) => ({ id: d.id, anonyme: estAnonyme(d.trainee) })),
  PresenceCreneau: async (sessionId) =>
    (
      await prisma.presenceCreneau.findMany({
        where: { enrollment: { sessionId } },
        select: {
          id: true,
          enrollment: { select: { trainee: { select: { deletedAt: true } } } },
        },
      })
    ).map((c) => ({ id: c.id, anonyme: estAnonyme(c.enrollment.trainee) })),
  EmargementSignature: async (sessionId) =>
    (
      await prisma.emargementSignature.findMany({
        where: { enrollment: { sessionId } },
        select: {
          id: true,
          enrollment: { select: { trainee: { select: { deletedAt: true } } } },
        },
      })
    ).map((x) => ({ id: x.id, anonyme: estAnonyme(x.enrollment?.trainee) })),
  EmargementContresignature: async (sessionId) =>
    (
      await prisma.emargementContresignature.findMany({
        where: { sessionId },
        select: { id: true },
      })
    ).map((x) => ({ id: x.id, anonyme: false })),
  DocumentSignature: async (sessionId) =>
    (
      await prisma.documentSignature.findMany({
        where: { documentGenere: { sessionId } },
        select: {
          id: true,
          documentGenere: { select: { trainee: { select: { deletedAt: true } } } },
        },
      })
    ).map((x) => ({ id: x.id, anonyme: estAnonyme(x.documentGenere.trainee) })),
  EvaluationAcquis: async (sessionId) =>
    (
      await prisma.evaluationAcquis.findMany({
        where: { enrollment: { sessionId } },
        select: {
          id: true,
          enrollment: { select: { trainee: { select: { deletedAt: true } } } },
        },
      })
    ).map((x) => ({ id: x.id, anonyme: estAnonyme(x.enrollment?.trainee) })),
  Questionnaire: async (sessionId) =>
    (
      await prisma.questionnaire.findMany({
        where: { enrollment: { sessionId } },
        select: {
          id: true,
          enrollment: { select: { trainee: { select: { deletedAt: true } } } },
        },
      })
    ).map((x) => ({ id: x.id, anonyme: estAnonyme(x.enrollment.trainee) })),
  ReleveConnexionImport: async (sessionId) =>
    (
      await prisma.releveConnexionImport.findMany({ where: { sessionId }, select: { id: true } })
    ).map((x) => ({ id: x.id, anonyme: false })),
  Incident: async (sessionId) =>
    (await prisma.incident.findMany({ where: { sessionId }, select: { id: true } })).map((x) => ({
      id: x.id,
      anonyme: false,
    })),
  DossierFinancement: async (sessionId) =>
    (
      await prisma.dossierFinancement.findMany({
        where: { trainingSessionId: sessionId },
        select: { id: true },
      })
    ).map((x) => ({ id: x.id, anonyme: false })),
  MissionFormateur: async (sessionId) =>
    (await prisma.missionFormateur.findMany({ where: { sessionId }, select: { id: true } })).map(
      (x) => ({ id: x.id, anonyme: false }),
    ),
};

/** Les `targetType` dont les identifiants sont recherchés dans le journal d'un dossier. */
export const TYPES_CIBLES_JOURNAL_SESSION: ReadonlyArray<string> = Object.keys(CHARGEURS_CIBLES);

/** Tous les identifiants d'objets du dossier, et ceux qui portent sur un stagiaire anonymisé. */
export async function ciblesJournalSession(
  sessionId: string,
): Promise<{ ids: string[]; anonymes: Set<string> }> {
  const lots = await Promise.all(Object.values(CHARGEURS_CIBLES).map((c) => c(sessionId)));
  const ids = new Set<string>();
  const anonymes = new Set<string>();
  for (const lot of lots) {
    for (const c of lot) {
      ids.add(c.id);
      if (c.anonyme) anonymes.add(c.id);
    }
  }
  return { ids: [...ids], anonymes };
}

/**
 * Les actions du journal d'activité portant sur la session et TOUS ses
 * éléments, entre deux dates : par identifiant de cible, OU par le marqueur
 * `changes.dossierSessionId` (cibles supprimées). Best-effort : le journal
 * l'est aussi, et la section le dit.
 */
export async function lireJournalSession(input: {
  readonly sessionId: string;
  readonly depuis: Date;
  readonly jusqua: Date;
}): Promise<{ actions: ActionJournal[]; tronque: boolean }> {
  const { ids, anonymes } = await ciblesJournalSession(input.sessionId);
  const lignes = await prisma.activityLog.findMany({
    where: {
      createdAt: { gte: input.depuis, lte: input.jusqua },
      OR: [
        { targetId: { in: ids } },
        { changes: { path: [CLE_DOSSIER_SESSION], equals: input.sessionId } },
      ],
    },
    select: {
      createdAt: true,
      action: true,
      targetType: true,
      targetId: true,
      changes: true,
      adminUser: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: PLAFOND_JOURNAL + 1,
  });
  const tronque = lignes.length > PLAFOND_JOURNAL;
  const anonymesListe = [...anonymes];
  return {
    tronque,
    actions: lignes.slice(0, PLAFOND_JOURNAL).map((l) => {
      let texte = "";
      try {
        texte = JSON.stringify(l.changes ?? null);
      } catch {
        texte = "";
      }
      const detailMasque =
        (l.targetId !== null && anonymes.has(l.targetId)) ||
        anonymesListe.some((id) => texte.includes(id));
      return {
        createdAt: l.createdAt,
        action: l.action,
        auteur: l.adminUser?.name ?? null,
        targetType: l.targetType,
        targetId: l.targetId,
        changes: l.changes,
        detailMasque,
      };
    }),
  };
}

export interface ReouvertureSessionManifeste {
  readonly sessionId: string;
  readonly numero: string;
  readonly titre: string;
  readonly reouvertures: ReadonlyArray<{
    readonly le: string;
    readonly par: string;
    readonly motif: string;
    readonly reverrouilleLe: string | null;
  }>;
  /** Vrai si le dernier événement est une réouverture. */
  readonly toujoursRouvert: boolean;
}

/** Toutes les sessions rouvertes au moins une fois (manifeste global). */
export async function lireReouverturesSessions(): Promise<ReouvertureSessionManifeste[] | null> {
  let evenements: Array<{
    sessionId: string;
    type: TypeEvenementDossier;
    createdAt: Date;
    auteurNom: string;
    motif: string | null;
    session: { numero: string; titreSession: string };
  }>;
  try {
    evenements = await prisma.sessionDossierEvenement.findMany({
      select: {
        sessionId: true,
        type: true,
        createdAt: true,
        auteurNom: true,
        motif: true,
        session: { select: { numero: true, titreSession: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
  return regrouperReouvertures(evenements);
}

/** Regroupement pur, par session, dans l'ordre chronologique. */
export function regrouperReouvertures(
  evenements: ReadonlyArray<{
    sessionId: string;
    type: TypeEvenementDossier;
    createdAt: Date;
    auteurNom: string;
    motif: string | null;
    session: { numero: string; titreSession: string };
  }>,
): ReouvertureSessionManifeste[] {
  const parSession = new Map<string, (typeof evenements)[number][]>();
  for (const e of evenements) {
    const lot = parSession.get(e.sessionId) ?? [];
    lot.push(e);
    parSession.set(e.sessionId, lot);
  }
  const out: ReouvertureSessionManifeste[] = [];
  for (const [sessionId, lot] of parSession) {
    const tri = [...lot].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const reouvertures = tri
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.type === "reouverture")
      .map(({ e, i }) => {
        const relock = tri.slice(i + 1).find((x) => x.type === "reverrouillage");
        return {
          le: e.createdAt.toISOString(),
          par: e.auteurNom,
          motif: e.motif ?? "",
          reverrouilleLe: relock?.createdAt.toISOString() ?? null,
        };
      });
    if (reouvertures.length === 0) continue;
    const premier = tri[0] as (typeof tri)[number];
    out.push({
      sessionId,
      numero: premier.session.numero,
      titre: premier.session.titreSession,
      reouvertures,
      toujoursRouvert: tri[tri.length - 1]?.type === "reouverture",
    });
  }
  return out.sort((a, b) => a.numero.localeCompare(b.numero));
}

/** Les lignes du manifeste Markdown. */
export function lignesManifesteReouvertures(
  sessions: ReadonlyArray<ReouvertureSessionManifeste> | null,
): string[] {
  if (sessions === null) {
    return [
      "## Réouvertures de dossiers de session",
      "",
      "*Le registre des réouvertures n'a pas pu être lu : ce n'est PAS un constat d'absence de réouverture.*",
      "",
    ];
  }
  const n = sessions.length;
  const lignes = [
    "## Réouvertures de dossiers de session",
    "",
    n === 0
      ? "**0 session rouverte** : aucun dossier clos n'a été rouvert."
      : `**${n} session${n > 1 ? "s" : ""} rouverte${n > 1 ? "s" : ""}** après clôture (registre en ajout seul) :`,
    "",
  ];
  for (const s of sessions) {
    for (const r of s.reouvertures) {
      lignes.push(
        `- ${s.numero} — rouverte le ${dateHeureParis(new Date(r.le))} par ${r.par} — motif : « ${r.motif} » — ` +
          (r.reverrouilleLe !== null
            ? `close à nouveau le ${dateParis(new Date(r.reverrouilleLe))}`
            : "toujours rouverte"),
      );
    }
  }
  lignes.push("");
  return lignes;
}
