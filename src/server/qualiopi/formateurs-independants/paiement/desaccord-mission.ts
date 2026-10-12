/**
 * Formateurs indépendants — LE DÉSACCORD SUR UN RELEVÉ DE MISSION (lot D2, M10 ;
 * plan 08 §3 F39, F58, F59, séquence S10).
 *
 *   1. **Le formateur signale un désaccord** depuis « Mes honoraires », pendant les
 *      8 jours de sa fenêtre de contestation, sur SA facture de mission non payée.
 *      Le paiement de CE relevé est bloqué (`contesteeAt`, la garde existante du
 *      « payé »), F58 accuse réception, l'administrateur est prévenu.
 *   2. **Désaccord accepté** : l'administrateur corrige d'abord la donnée
 *      d'origine (journées, forfait) dans les écrans existants. L'outil recalcule
 *      alors le relevé par LE calcul du passage (`lireCandidats` puis
 *      `planifierPassage`) — jamais un montant saisi à la main —, émet l'avoir
 *      TOTAL de l'autofacture et réémet le relevé recalculé (« à valider » : un
 *      humain le valide, puis l'autofacture part par le chemin existant ; F39
 *      part avec elle, cf. `envoyerFactureRectifiee`).
 *   3. **Désaccord non retenu** : motif écrit obligatoire, F59 au formateur. C'est
 *      le SEUL geste qui débloque le paiement, tracé sur le relevé (qui, quand,
 *      issue, motif) — `contesteeAt` n'est jamais effacé.
 *
 * 🔴 Relevés de MISSION seulement : un relevé mensuel, un salarié, un apporteur
 * ne passent par aucune de ces fonctions. Éteint tant que `passage_paiement`
 * n'a pas de date (aucun relevé de mission n'existe alors).
 *
 * 🔒 Ni le texte du formateur ni le motif de l'administrateur n'entrent dans un
 * journal : ils restent sur le relevé. Les journaux portent des UUID et des codes.
 */

import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { journaliser } from "@/server/journal/journaliser";
import { contestationOuverte } from "@/server/qualiopi/remuneration/autofacturation";
import {
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION,
  prendreVerrousRemuneration,
} from "@/server/qualiopi/remuneration/verrou-remuneration";

import type { ReleveMissionCalcule } from "../argent/calcul-mission";
import { envoyer } from "../envois";
import { emettreAvoirMission, reemettreMission } from "./corrections-mission";
import { ISSUE_DESACCORD_ACCEPTE, ISSUE_DESACCORD_NON_RETENU } from "./desaccord-regle";
import { lireDateBascule, uniqueHistoriqueRetire } from "./lecture-passage";
import { lireCandidats } from "./passage-mission-base";
import { planifierPassage, type MoisAEcrire } from "./passage-mission";

/** Le texte libre du formateur : court. */
export const LONGUEUR_MAX_DESACCORD = 1000;
/** Le motif écrit par l'administrateur quand il ne retient pas le désaccord. */
export const LONGUEUR_MIN_MOTIF_NON_RETENU = 10;
export const LONGUEUR_MAX_MOTIF_NON_RETENU = 1000;

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** Les seules lignes qu'un recalcul sait refaire : l'animation et le déplacement. */
const OBJETS_RECALCULABLES = new Set(["animation", "deplacement"]);

async function alerter(body: string): Promise<void> {
  try {
    await sendTelegram({ tag: "AUTO", body });
  } catch {
    // Une alerte manquée ne défait jamais l'acte.
  }
}

/* ─── 1. Le formateur signale un désaccord ───────────────────────────────── */

export type IssueSignalement =
  | "enregistre"
  /** Interrupteur sans date : le paiement par mission n'existe pas encore. */
  | "coupe"
  | "texte_invalide"
  /** Inconnu, ou pas à CE formateur : même réponse, rien n'est révélé. */
  | "introuvable"
  /** Pas une facture de mission ouverte au désaccord (mensuel, avoir, payée…). */
  | "non_contestable"
  /** La fenêtre de 8 jours est fermée : répondre à l'e-mail de la facture. */
  | "hors_delai"
  | "deja_signale";

export async function signalerDesaccord(e: {
  readonly trainerId: string;
  readonly statementId: string;
  readonly texte: string;
  readonly maintenant: Date;
}): Promise<IssueSignalement> {
  const texte = e.texte.trim();
  if (texte.length === 0 || texte.length > LONGUEUR_MAX_DESACCORD) return "texte_invalide";
  if ((await lireDateBascule(prisma)) === null) return "coupe";
  const r = await prisma.trainerStatement.findUnique({
    where: { id: e.statementId },
    select: {
      id: true,
      trainerId: true,
      origine: true,
      avoirDeId: true,
      statut: true,
      autofactureAt: true,
      numeroFacture: true,
      payeAt: true,
      contestationAvantAt: true,
      contesteeAt: true,
      trainer: { select: { email: true, prenom: true } },
    },
  });
  // 🔒 Contrôle côté serveur : un formateur n'agit que sur SES relevés.
  if (r === null || r.trainerId !== e.trainerId) return "introuvable";
  if (
    r.origine !== "passage_mission" ||
    r.avoirDeId !== null ||
    r.autofactureAt === null ||
    r.numeroFacture === null ||
    r.statut === "annule" ||
    r.statut === "paye" ||
    r.payeAt !== null
  ) {
    return "non_contestable";
  }
  if (r.contesteeAt !== null) return "deja_signale";
  // La règle de la fenêtre vient du module, jamais recopiée (`contestationOuverte`).
  if (!contestationOuverte(r, e.maintenant)) return "hors_delai";

  // Conditionnelle : un double clic, deux onglets ou un administrateur qui
  // consigne au même moment n'écrivent qu'une fois.
  const { count } = await prisma.trainerStatement.updateMany({
    where: {
      id: r.id,
      trainerId: e.trainerId,
      origine: "passage_mission",
      contesteeAt: null,
      payeAt: null,
      autofactureAt: { not: null },
      statut: { notIn: ["annule", "paye"] },
    },
    data: { contesteeAt: e.maintenant, contestationMotif: texte },
  });
  if (count !== 1) return "deja_signale";

  await journaliser(prisma, {
    action: "qualiopi.remuneration.desaccord_signale",
    targetType: "TrainerStatement",
    targetId: r.id,
    // Le texte reste sur le relevé : il peut porter des données personnelles.
    changes: { longueur: texte.length, parLeFormateur: true },
    session: null,
  });
  // F58 — l'accusé, une fois par désaccord (clé `fi-contestation-<id>-recue`).
  await envoyer({
    gabarit: "formateur-desaccord-recu",
    destinataire: r.trainer.email,
    entityType: "Trainer",
    entityId: r.trainerId,
    jobId: `fi-contestation-${r.id}-recue`,
    payload: {
      prenom: r.trainer.prenom,
      valeurs: { date: DATE_LONGUE.format(e.maintenant), numéro: r.numeroFacture },
    },
  }).catch(() => undefined);
  // L'administrateur est prévenu : numéro de pièce seulement, aucun nom.
  await alerter(
    `Désaccord signalé par un formateur sur la facture ${r.numeroFacture} : son paiement est bloqué. À trancher depuis l'écran du relevé (désaccord accepté ou non retenu).`,
  );
  return "enregistre";
}

/* ─── 2. Désaccord accepté : aperçu, puis avoir et réémission ────────────── */

export type MotifRefusAcceptation =
  | "introuvable"
  | "coupe"
  | "pas_de_desaccord_ouvert"
  /** Indemnité, imputation, présentation : le recalcul ne sait refaire que l'animation et le déplacement. */
  | "lignes_non_recalculables"
  /** Les feuilles du mois ne sont pas complètes, ou les conditions manquent. */
  | "mois_non_payable"
  /** Le recalcul donne exactement le relevé contesté : corrigez d'abord la donnée d'origine. */
  | "rien_n_a_change";

export interface ApercuAcceptation {
  readonly ok: true;
  readonly ancien: {
    readonly numero: string;
    readonly totalHtCents: number;
    readonly tvaCents: number;
    readonly totalTtcCents: number;
  };
  readonly nouveau: MoisAEcrire;
}

interface ReleveConteste {
  id: string;
  trainerId: string;
  sessionId: string | null;
  periodeYear: number;
  periodeMonth: number;
  statut: string;
  origine: string;
  avoirDeId: string | null;
  numeroFacture: string | null;
  payeAt: Date | null;
  contesteeAt: Date | null;
  contestationCloseAt: Date | null;
  totalHtCents: number;
  tvaCents: number;
  totalTtcCents: number;
  feeLines: Array<{ objet: string | null; montantHtCents: number; demiJournees: number | null }>;
}

const SELECT_CONTESTE = {
  id: true,
  trainerId: true,
  sessionId: true,
  periodeYear: true,
  periodeMonth: true,
  statut: true,
  origine: true,
  avoirDeId: true,
  numeroFacture: true,
  payeAt: true,
  contesteeAt: true,
  contestationCloseAt: true,
  totalHtCents: true,
  tvaCents: true,
  totalTtcCents: true,
  feeLines: {
    where: { statut: { not: "annule" } },
    select: { objet: true, montantHtCents: true, demiJournees: true },
  },
} as const;

/** Un désaccord encore ouvert sur une facture de mission non payée. */
function desaccordOuvert(r: ReleveConteste): boolean {
  return (
    r.origine === "passage_mission" &&
    r.avoirDeId === null &&
    r.sessionId !== null &&
    r.numeroFacture !== null &&
    r.contesteeAt !== null &&
    r.contestationCloseAt === null &&
    r.payeAt === null &&
    r.statut !== "annule" &&
    r.statut !== "paye"
  );
}

function moisDe(r: { periodeYear: number; periodeMonth: number }): string {
  return `${r.periodeYear}-${String(r.periodeMonth).padStart(2, "0")}`;
}

function memesLignes(
  a: ReadonlyArray<{ objet: string | null; montantHtCents: number; demiJournees: number | null }>,
  b: ReleveMissionCalcule["lignes"],
): boolean {
  const cle = (l: { objet: string | null; montantHtCents: number; demiJournees?: number | null }) =>
    `${l.objet}|${l.montantHtCents}|${l.demiJournees ?? ""}`;
  const x = a.map(cle).sort();
  const y = b.map(cle).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/**
 * Ce que l'outil réémettrait si le désaccord était accepté MAINTENANT : le relevé
 * recalculé par le passage sur la donnée d'origine telle qu'elle est en base.
 * Lecture seule.
 */
export async function apercuDesaccordAccepte(
  statementId: string,
): Promise<ApercuAcceptation | { ok: false; motif: MotifRefusAcceptation }> {
  const r = (await prisma.trainerStatement.findUnique({
    where: { id: statementId },
    select: SELECT_CONTESTE,
  })) as ReleveConteste | null;
  if (r === null) return { ok: false, motif: "introuvable" };
  if (!desaccordOuvert(r)) return { ok: false, motif: "pas_de_desaccord_ouvert" };
  if (r.feeLines.some((l) => !OBJETS_RECALCULABLES.has(l.objet ?? "")))
    return { ok: false, motif: "lignes_non_recalculables" };
  const bascule = await lireDateBascule(prisma);
  if (bascule === null) return { ok: false, motif: "coupe" };
  const candidats = (await lireCandidats(bascule)).filter(
    (c) => c.trainerId === r.trainerId && c.sessionId === r.sessionId,
  );
  const plan = planifierPassage(candidats, bascule);
  const nouveau = plan.aEcrire.find((m) => m.releve.mois === moisDe(r));
  if (nouveau === undefined) return { ok: false, motif: "mois_non_payable" };
  if (
    nouveau.releve.totalHtCents === r.totalHtCents &&
    memesLignes(r.feeLines, nouveau.releve.lignes)
  )
    return { ok: false, motif: "rien_n_a_change" };
  return {
    ok: true,
    ancien: {
      numero: r.numeroFacture!,
      totalHtCents: r.totalHtCents,
      tvaCents: r.tvaCents,
      totalTtcCents: r.totalTtcCents,
    },
    nouveau,
  };
}

export type IssueAcceptation =
  | { readonly issue: "acceptee"; readonly avoirId: string; readonly nouveauId: string }
  | {
      readonly issue: "refusee";
      readonly motif:
        | MotifRefusAcceptation
        /** Le montant recalculé n'est plus celui de l'aperçu : rien n'est écrit. */
        | "apercu_perime"
        /** Déjà tranché (double clic, deux administrateurs) : rien de plus. */
        | "deja_traite"
        /** M-D non fait : l'avoir et la réémission refusent net. */
        | "contract_non_fait"
        | string;
    };

class Refus extends Error {
  constructor(readonly motif: string) {
    super(motif);
  }
}

/**
 * « Désaccord accepté » : avoir TOTAL de l'autofacture puis réémission du relevé
 * recalculé, dans UNE transaction, sous les verrous (période puis formateur).
 * N'écrit que le montant vu à l'aperçu. Un rejeu trouve le désaccord clos.
 */
export async function accepterDesaccord(e: {
  readonly statementId: string;
  readonly htVuCents: number;
  readonly parId: string;
  readonly maintenant: Date;
}): Promise<IssueAcceptation> {
  const a = await apercuDesaccordAccepte(e.statementId);
  if (!a.ok) {
    return {
      issue: "refusee",
      motif: a.motif === "pas_de_desaccord_ouvert" ? "deja_traite" : a.motif,
    };
  }
  if (a.nouveau.releve.totalHtCents !== e.htVuCents)
    return { issue: "refusee", motif: "apercu_perime" };
  if (!(await uniqueHistoriqueRetire(prisma)))
    return { issue: "refusee", motif: "contract_non_fait" };
  const m = a.nouveau;
  const [annee, mois] = m.releve.mois.split("-").map(Number) as [number, number];
  try {
    return await prisma.$transaction(async (tx) => {
      await prendreVerrousRemuneration(tx, {
        periodes: [{ year: annee, month: mois }],
        trainerIds: [m.trainerId],
      });
      // Relu SOUS verrou : un second administrateur attend, puis trouve le désaccord clos.
      const r = (await tx.trainerStatement.findUnique({
        where: { id: e.statementId },
        select: SELECT_CONTESTE,
      })) as ReleveConteste | null;
      if (r === null || !desaccordOuvert(r)) throw new Refus("deja_traite");
      const avoir = await emettreAvoirMission(tx, r.id, e.maintenant);
      if (avoir.issue !== "avoir_emis")
        throw new Refus(avoir.issue === "refuse" ? avoir.motif : "deja_traite");
      const re = await reemettreMission(
        tx,
        r.id,
        m.releve,
        m.regimeTva,
        m.tarifJourneeHtCents,
        e.maintenant,
      );
      if (re.issue !== "reemis") throw new Refus(re.motif);
      const { count } = await tx.trainerStatement.updateMany({
        where: { id: r.id, contestationCloseAt: null },
        data: {
          contestationCloseAt: e.maintenant,
          contestationCloseParId: e.parId,
          contestationCloseIssue: ISSUE_DESACCORD_ACCEPTE,
          contestationCloseMotif: null,
        },
      });
      if (count !== 1) throw new Refus("deja_traite");
      await journaliser(
        tx,
        {
          action: "qualiopi.remuneration.desaccord_accepte",
          targetType: "TrainerStatement",
          targetId: r.id,
          changes: {
            avoirId: avoir.avoirId,
            nouveauId: re.id,
            ancienHtCents: r.totalHtCents,
            nouveauHtCents: m.releve.totalHtCents,
          },
          session: null,
        },
        { exiger: true },
      );
      return { issue: "acceptee" as const, avoirId: avoir.avoirId, nouveauId: re.id };
    }, DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION);
  } catch (err) {
    if (err instanceof Refus) return { issue: "refusee", motif: err.motif };
    throw err;
  }
}

/* ─── 3. Désaccord non retenu : motif, F59, et le seul déblocage ─────────── */

export type IssueNonRetenu =
  | {
      readonly issue: "non_retenu";
      readonly envoi: Awaited<ReturnType<typeof envoyer>> | "indisponible";
    }
  | { readonly issue: "motif_requis" | "introuvable" | "deja_traite" };

export async function refuserDesaccord(e: {
  readonly statementId: string;
  readonly motif: string;
  readonly parId: string;
  readonly maintenant: Date;
}): Promise<IssueNonRetenu> {
  const motif = e.motif.trim();
  if (motif.length < LONGUEUR_MIN_MOTIF_NON_RETENU || motif.length > LONGUEUR_MAX_MOTIF_NON_RETENU)
    return { issue: "motif_requis" };
  const r = await prisma.trainerStatement.findUnique({
    where: { id: e.statementId },
    select: {
      id: true,
      trainerId: true,
      numeroFacture: true,
      contesteeAt: true,
      trainer: { select: { email: true, prenom: true } },
    },
  });
  if (r === null) return { issue: "introuvable" };
  // Conditionnelle : seul un désaccord OUVERT sur une facture de mission non payée
  // se clôt ; un double clic ou un second administrateur ne réécrivent rien.
  const { count } = await prisma.trainerStatement.updateMany({
    where: {
      id: r.id,
      origine: "passage_mission",
      avoirDeId: null,
      contesteeAt: { not: null },
      contestationCloseAt: null,
      payeAt: null,
      statut: { notIn: ["annule", "paye"] },
    },
    data: {
      contestationCloseAt: e.maintenant,
      contestationCloseParId: e.parId,
      contestationCloseIssue: ISSUE_DESACCORD_NON_RETENU,
      contestationCloseMotif: motif,
    },
  });
  if (count !== 1) return { issue: "deja_traite" };
  const envoi = await envoyer({
    gabarit: "formateur-desaccord-non-retenu",
    destinataire: r.trainer.email,
    entityType: "Trainer",
    entityId: r.trainerId,
    jobId: `fi-contestation-${r.id}-close`,
    payload: {
      prenom: r.trainer.prenom,
      valeurs: {
        date: DATE_LONGUE.format(r.contesteeAt ?? e.maintenant),
        numéro: r.numeroFacture,
        "motif écrit par vous": motif,
      },
    },
  }).catch(() => "indisponible" as const);
  return { issue: "non_retenu", envoi };
}
