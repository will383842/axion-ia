/**
 * Réseau d'apporteurs — FIN DE VIE du contrat : « Résilier » et « Enregistrer une reprise ».
 *
 * Contrat v2, article 12 :
 *   · 12.1 les attributions provisoires (réservées, en attente) sont annulées, les attributions
 *     définitives non converties prennent fin ;
 *   · 12.2 les commissions déjà acquises sont facturées et payées comme les autres (plus de
 *     seuil ni de « dernier relevé » : chaque commission due est facturée dès qu'elle l'est) ;
 *   · 12.3 les commandes signées AVANT la fin continuent d'ouvrir droit à commission : le
 *     passage quotidien lit les présentations protégées, y compris terminées, et
 *     `commandeCouverte` compare la date de commande au terme de la protection. On ramène donc
 *     ce terme à la date de résiliation (jamais plus tard) : rien d'antérieur n'est perdu.
 *
 * ⛔ Une commission déjà créée (à qualifier, en attente de vigilance, due) est ACQUISE : elle
 * n'est jamais annulée ni supprimée ici. Le brief parlait de « provisoires » ; le contrat (12.2
 * et 12.3) ne connaît de provisoire que l'attribution, pas la commission.
 *
 * Reprise (art. 4.5 et 12.4) : une ligne `reprise` de montant NÉGATIF, déduite de la prochaine autofacture du même apporteur.
 * Elle est enregistrée à la main (montant + motif) : savoir si la restitution donne lieu à reprise
 * (client qui réclame, ou restitution décidée par la Société) est un jugement, pas un calcul.
 *
 * ⚠️ Module sans `server-only` : testable directement, appelé seulement par la console.
 */

import { randomUUID } from "node:crypto";

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { jourParis } from "./autofacture-donnees";
import { envoyer } from "./envois";
import { urlDossier } from "./jeton";
import { euros, ajouterMois } from "./regles";
import { lireReservations, tableAbsente } from "./reservation-presentation";
import { argentEnJeu } from "./retrait";
import { signalerErreurReseau } from "./signaler";

// ── Résiliation ──────────────────────────────────────────────────────────

export interface PresentationARegler {
  id: string;
  statut: string;
  protegeeJusquAt: Date | null;
  /** Règle par rendez-vous : la fin de la réservation provisoire, si la présentation en porte une. */
  reserveeJusquAt?: Date | null;
}

/** Ce qu'il faut écrire sur chaque présentation en cours. Pur. */
export function planResiliation(
  presentations: readonly PresentationARegler[],
  maintenant: Date,
): Array<{ id: string; protegeeJusquAt: Date | null; reserveeJusquAt: Date | null }> {
  return presentations
    .filter((p) => p.statut === "reservee" || p.statut === "confirmee")
    .map((p) => ({
      id: p.id,
      // Le terme ne recule que s'il était plus tard : une commande antérieure reste couverte.
      protegeeJusquAt:
        p.protegeeJusquAt && p.protegeeJusquAt.getTime() > maintenant.getTime()
          ? maintenant
          : p.protegeeJusquAt,
      // Même règle pour la réservation (art. 12.3) : une commande signée avant la résiliation reste
      // couverte, aucune commande d'après ne l'est, et la réservation ne se prolonge pas.
      reserveeJusquAt:
        p.reserveeJusquAt && p.reserveeJusquAt.getTime() > maintenant.getTime()
          ? maintenant
          : (p.reserveeJusquAt ?? null),
    }));
}

const STATUTS_RESILIABLES = ["signe"] as const;

// ── Résiliation en deux temps (lot L1b, 2026-11-25) ──────────────────────
// 1. NOTIFIER (`notifierResiliation`) : ligne `apporteur_resiliation`, journal, e-mail. Le statut
//    reste « signe » : l'apporteur peut continuer à présenter des entreprises pendant le préavis.
// 2. PRENDRE EFFET (`executerResiliation`) : à la date d'effet, par le passage quotidien (ou
//    aussitôt pour 11.2 et 12.5). Seule cette fonction écrit le statut « resilie ».
// Les seules échéances portent sur ce que FAIT AXION (préavis) : aucune sur l'apporteur.

// ⚖️ DÉCOMPTE (décision du dirigeant, 25/11/2026, arts. 641-642 du code de procédure civile) :
// le jour de la notification (ou de la mise en demeure) NE COMPTE PAS. Préavis de 30 jours notifié
// le 1er décembre : le contrat prend fin le 31 décembre au soir, la résiliation prend effet le
// 1er janvier à 00 h (Paris). Mise en demeure de 15 jours le 1er : résiliation possible le 17.
/** Délai de la mise en demeure restée sans effet (article 11.2), en jours de Paris, jour de la mise en demeure exclu. */
export const MISE_EN_DEMEURE_JOURS = 15;
/** Ancienneté maximale de la date de notification saisie (jamais d'effet rétroactif). */
export const NOTIFICATION_MAX_ANTERIORITE_JOURS = 7;

/** Préavis de l'article 11.1, en jours de Paris, jour de la notification exclu. */
export const DELAI_RESILIATION_11_1_JOURS = 30;

export type InitiativeResiliation = "societe" | "apporteur";
export type FondementResiliation = "11.1" | "11.2" | "12.5";

/** Minuit, heure de Paris, au début du jour « AAAA-MM-JJ ». */
function minuitParis(jour: string): Date {
  const [a, m, j] = jour.split("-").map(Number);
  for (const h of [23, 22]) {
    const c = new Date(Date.UTC(a!, m! - 1, j! - 1, h));
    if (jourParis(c) === jour && jourParis(new Date(c.getTime() - 1)) !== jour) return c;
  }
  return new Date(Date.UTC(a!, m! - 1, j!, 0));
}

/** Le premier jour où la résiliation peut intervenir : le délai de `n` jours est ÉCOULÉ, le jour de départ n'étant pas compté. */
function lendemainDuDelai(jour: string, n: number): string {
  return plusJours(jour, n + 1);
}

function plusJours(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, j! + n)).toISOString().slice(0, 10);
}

export type PlanNotification =
  { ok: true; effetLe: Date; immediat: boolean } | { ok: false; message: string };

/**
 * La date d'effet d'une résiliation, ou un refus. Pur.
 *   · 11.1 : notification + 30 jours de Paris, jour de la notification exclu (effet le 1er janvier pour une notification du 1er décembre) ; jamais plus tôt (une date d'effet plus proche est
 *     refusée) ; plus tard seulement à la demande écrite de l'apporteur ;
 *   · 11.2 : mise en demeure antérieure et motif obligatoires ; effet immédiat ;
 *   · 12.5 : motif obligatoire ; effet immédiat.
 */
export function planNotificationResiliation(e: {
  initiative: InitiativeResiliation;
  fondement: FondementResiliation;
  notifieeLe: Date;
  miseEnDemeureLe?: Date | null;
  motif?: string | null;
  /** 11.1 : date d'effet demandée par écrit. Jamais antérieure au préavis. */
  effetDemandeLe?: Date | null;
  maintenant: Date;
}): PlanNotification {
  const motif = (e.motif ?? "").trim();
  if (Number.isNaN(e.notifieeLe.getTime()))
    return { ok: false, message: "Indiquez la date de la notification écrite." };
  if (jourParis(e.notifieeLe) > jourParis(e.maintenant))
    return { ok: false, message: "La date de notification ne peut pas être dans le futur." };
  // Pas d'effet rétroactif : la notification saisie ne remonte pas à plus de 7 jours.
  if (
    jourParis(e.notifieeLe) <
    plusJours(jourParis(e.maintenant), -NOTIFICATION_MAX_ANTERIORITE_JOURS)
  )
    return {
      ok: false,
      message: `La date de notification ne peut pas remonter à plus de ${NOTIFICATION_MAX_ANTERIORITE_JOURS} jours.`,
    };
  if (e.fondement === "11.1") {
    if (motif)
      return {
        ok: false,
        message: "L'article 11.1 dispense de motiver : ne saisissez pas de motif.",
      };
    const minimum = minuitParis(
      lendemainDuDelai(jourParis(e.notifieeLe), DELAI_RESILIATION_11_1_JOURS),
    );
    if (e.effetDemandeLe) {
      if (!(e.effetDemandeLe.getTime() >= minimum.getTime()))
        return { ok: false, message: "Le préavis de 30 jours ne peut pas être raccourci." };
      if (e.initiative !== "apporteur")
        return { ok: false, message: "Seul l'apporteur peut demander un effet plus lointain." };
      return { ok: true, effetLe: minuitParis(jourParis(e.effetDemandeLe)), immediat: false };
    }
    return { ok: true, effetLe: minimum, immediat: false };
  }
  if (e.initiative !== "societe")
    return { ok: false, message: "Ce fondement ne relève que d'Axion IA." };
  if (!motif) return { ok: false, message: "Indiquez le motif." };
  if (e.fondement === "11.2") {
    const m = e.miseEnDemeureLe;
    if (
      !m ||
      Number.isNaN(m.getTime()) ||
      !(lendemainDuDelai(jourParis(m), MISE_EN_DEMEURE_JOURS) <= jourParis(e.notifieeLe))
    )
      return {
        ok: false,
        message: `L'article 11.2 exige une mise en demeure restée sans effet pendant ${MISE_EN_DEMEURE_JOURS} jours.`,
      };
  }
  return { ok: true, effetLe: e.maintenant, immediat: true };
}

const jourLong = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Le dernier jour du contrat : la veille de la prise d'effet (effet le 1er janvier → fin le 31 décembre au soir). */
export function dernierJourDuContrat(effetLe: Date): Date {
  return new Date(`${plusJours(jourParis(effetLe), -1)}T12:00:00Z`);
}

/** La résiliation notifiée et pas encore effective, dates formatées ; `null` si aucune ou table absente. */
export async function lireResiliationEnCours(
  apporteurId: string,
): Promise<{ notifieeLe: string; effetLe: string; dernierJourLe: string } | null> {
  try {
    const r = await prisma.apporteurResiliation.findUnique({
      where: { apporteurId },
      select: { notifieeLe: true, effetLe: true, executeeAt: true, fondement: true },
    });
    return r && !r.executeeAt
      ? {
          notifieeLe: jourLong(r.notifieeLe),
          effetLe: jourLong(r.effetLe),
          // Effet déjà atteint (11.2 / 12.5 dont la prise d'effet a échoué) : le contrat a pris fin ce jour-là.
          dernierJourLe: jourLong(
            r.fondement !== "11.1" && r.effetLe.getTime() <= Date.now()
              ? r.effetLe
              : dernierJourDuContrat(r.effetLe),
          ),
        }
      : null;
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
}

/** Écriture conditionnelle : deux passages ne résilient pas deux fois. */
export async function executerResiliation(
  apporteurId: string,
  effetLe: Date,
  maintenant: Date = new Date(),
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { id: true, statut: true, prenom: true, email: true, versionLien: true },
  });
  if (!a) return { ok: false, message: "Apporteur introuvable." };
  if (!(STATUTS_RESILIABLES as readonly string[]).includes(a.statut))
    return { ok: false, message: "Seul un contrat signé peut être résilié." };
  // B1 bis : si de l'argent est en jeu, le lien n'est PAS révoqué (mode restreint après la fin).
  const argent = await argentEnJeu(apporteurId);

  // Lues AVANT la transaction (tolérant à la table absente : une erreur dans une transaction Postgres
  // l'aurait annulée). Aucune ligne : rien à ramener.
  const reservations = await lireReservations(
    (
      await prisma.presentationEntreprise.findMany({
        where: { apporteurId, statut: "reservee" },
        select: { id: true },
      })
    ).map((p) => p.id),
  );
  const termine = await prisma.$transaction(
    async (tx) => {
      const r = await tx.apporteurReseau.updateMany({
        where: { id: apporteurId, statut: "signe" },
        data: {
          statut: "resilie",
          resilieAt: effetLe,
          ...(argent ? {} : { versionLien: { increment: 1 } }),
        },
      });
      if (r.count !== 1) return null;
      const presentations = await tx.presentationEntreprise.findMany({
        where: { apporteurId, statut: { in: ["reservee", "confirmee"] } },
        select: { id: true, statut: true, protegeeJusquAt: true },
      });
      const plan = planResiliation(
        presentations.map((p) => ({
          ...p,
          reserveeJusquAt: reservations.get(p.id)?.reserveeJusquAt ?? null,
        })),
        effetLe,
      );
      for (const p of plan) {
        if (reservations.has(p.id) && p.reserveeJusquAt) {
          // Conditionnelle : ne touche qu'une réservation qui courait encore.
          await tx.presentationReservation.updateMany({
            where: { presentationId: p.id, reserveeJusquAt: { gt: p.reserveeJusquAt } },
            data: { reserveeJusquAt: p.reserveeJusquAt },
          });
        }
        await tx.presentationEntreprise.update({
          where: { id: p.id },
          data: { statut: "terminee", protegeeJusquAt: p.protegeeJusquAt },
        });
      }
      await tx.apporteurResiliation.updateMany({
        where: { apporteurId, executeeAt: null },
        data: { executeeAt: maintenant },
      });
      await tx.activityLog.create({
        data: {
          action: "apporteur.resiliation_effective",
          targetType: "apporteur_reseau",
          targetId: apporteurId,
          changes: { effetLe: effetLe.toISOString(), attributionsTerminees: plan.length } as object,
        },
      });
      return plan.length;
    },
    { timeout: 15_000 },
  );
  if (termine === null) return { ok: false, message: "Ce contrat vient déjà d'être résilié." };

  // E-mail de prise d'effet : après la transaction, jamais bloquant pour elle.
  await envoyerEmailPriseEffet(apporteurId, effetLe, maintenant);
  return {
    ok: true,
    message: `Contrat résilié : ${termine} attribution(s) terminée(s), rappels coupés. Les commissions acquises restent à verser : elles sont facturées comme les autres.`,
  };
}

/**
 * E-mail de prise d'effet. Idempotent : même clé de journal (`resiliation-effet-<id>`), et
 * `emailEffetEnvoyeAt` n'est posé que si l'envoi est parti. Appelé à la prise d'effet, puis chaque
 * jour par `renvoyerEmailsEffetManques` pour celui qui n'est pas parti. Ne lève jamais.
 */
export async function envoyerEmailPriseEffet(
  apporteurId: string,
  effetLe: Date,
  maintenant: Date,
): Promise<"envoye" | "non-envoye"> {
  try {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { prenom: true, email: true, versionLien: true },
    });
    if (!a) return "non-envoye";
    const argent = await argentEnJeu(apporteurId);
    const destinataire = decryptPii(a.email) ?? "";
    const lien = argent ? urlDossier(apporteurId, a.versionLien) : null;
    if (!destinataire) return "non-envoye";
    const r = await envoyer({
      gabarit: "apporteur-resiliation-effective",
      destinataire,
      payload: {
        prenom: decryptPii(a.prenom) ?? "",
        effetLe: jourLong(effetLe),
        argentEnJeu: argent,
        ...(lien ? { lien } : {}),
      },
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      jobId: `resiliation-effet-${apporteurId}`,
    });
    if (r === "envoye") {
      await poserHorodatage(apporteurId, { emailEffetEnvoyeAt: maintenant });
      return "envoye";
    }
  } catch (err) {
    signalerErreurReseau("résiliation : e-mail de prise d'effet", err);
  }
  return "non-envoye";
}

/** Fenêtre de reprise : au-delà, l'e-mail n'a plus de sens et reste à la main. */
export const REPRISE_EMAIL_EFFET_JOURS = 30;

/**
 * Passage quotidien : renvoie l'e-mail de prise d'effet d'une résiliation déjà exécutée dont
 * l'envoi n'est pas parti (`emailEffetEnvoyeAt` vide). Se tait s'il n'y a rien. Rend le nombre
 * d'e-mails partis. Table absente : rien.
 */
export async function renvoyerEmailsEffetManques(maintenant: Date): Promise<number> {
  let lignes: Array<{ apporteurId: string; effetLe: Date }> = [];
  try {
    lignes = await prisma.apporteurResiliation.findMany({
      where: {
        executeeAt: {
          not: null,
          gte: new Date(maintenant.getTime() - REPRISE_EMAIL_EFFET_JOURS * 86_400_000),
        },
        emailEffetEnvoyeAt: null,
      },
      select: { apporteurId: true, effetLe: true },
      take: 100,
    });
  } catch (err) {
    if (tableAbsente(err)) return 0;
    throw err;
  }
  let partis = 0;
  for (const l of lignes) {
    if ((await envoyerEmailPriseEffet(l.apporteurId, l.effetLe, maintenant)) === "envoye")
      partis += 1;
  }
  return partis;
}

async function poserHorodatage(
  apporteurId: string,
  data: { emailNotifEnvoyeAt?: Date; emailEffetEnvoyeAt?: Date },
): Promise<void> {
  try {
    await prisma.apporteurResiliation.updateMany({ where: { apporteurId }, data });
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
}

/**
 * Les résiliations notifiées dont la date d'effet est atteinte prennent effet. Table absente
 * (le worker peut tourner avant la migration) : rien à faire. Une seule exécution par apporteur
 * (écriture conditionnelle dans `executerResiliation`).
 */
export async function executerResiliationsEchues(maintenant: Date): Promise<void> {
  let echues: Array<{ apporteurId: string; effetLe: Date }> = [];
  try {
    echues = await prisma.apporteurResiliation.findMany({
      where: { effetLe: { lte: maintenant }, executeeAt: null },
      select: { apporteurId: true, effetLe: true },
    });
  } catch (err) {
    if (tableAbsente(err)) return;
    throw err;
  }
  for (const r of echues) {
    try {
      const res = await executerResiliation(r.apporteurId, r.effetLe, maintenant);
      if (!res.ok) {
        // Introuvable, plus « signe » ou déjà résilié : définitif. On clôt la ligne (sinon elle
        // reviendrait chaque jour) et on le signale.
        await prisma.apporteurResiliation.updateMany({
          where: { apporteurId: r.apporteurId, executeeAt: null },
          data: { executeeAt: maintenant },
        });
        signalerErreurReseau(
          "résiliation échue non exécutée",
          new Error(`${r.apporteurId} : ${res.message}`),
        );
      }
    } catch (err) {
      signalerErreurReseau("résiliation échue en échec", err);
    }
  }
}

/** Temps 1 : la notification écrite. Le statut reste « signe » (sauf effet immédiat, 11.2 et 12.5). */
export async function notifierResiliation(e: {
  apporteurId: string;
  adminId: string;
  initiative: InitiativeResiliation;
  fondement: FondementResiliation;
  notifieeLe: Date;
  miseEnDemeureLe?: Date | null;
  motif?: string | null;
  maintenant?: Date;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const maintenant = e.maintenant ?? new Date();
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: e.apporteurId },
    select: { id: true, statut: true, prenom: true, email: true },
  });
  if (!a) return { ok: false, message: "Apporteur introuvable." };
  if (!(STATUTS_RESILIABLES as readonly string[]).includes(a.statut))
    return { ok: false, message: "Seul un contrat signé peut être résilié." };
  const plan = planNotificationResiliation({ ...e, maintenant });
  if (!plan.ok) return plan;
  const motif = (e.motif ?? "").trim().slice(0, 1000) || null;
  const miseEnDemeureLe = e.fondement === "11.2" ? (e.miseEnDemeureLe ?? null) : null;

  const cree = await prisma.$transaction(async (tx) => {
    const deja = await tx.apporteurResiliation.findUnique({
      where: { apporteurId: e.apporteurId },
      select: { executeeAt: true },
    });
    if (deja) return false;
    await tx.apporteurResiliation.create({
      data: {
        apporteurId: e.apporteurId,
        initiative: e.initiative,
        fondement: e.fondement,
        notifieeLe: e.notifieeLe,
        effetLe: plan.effetLe,
        miseEnDemeureLe,
        motif,
        parId: e.adminId,
      },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: e.adminId,
        action: "apporteur.resiliation_notifiee",
        targetType: "apporteur_reseau",
        targetId: e.apporteurId,
        changes: {
          initiative: e.initiative,
          fondement: e.fondement,
          notifieeLe: e.notifieeLe.toISOString(),
          effetLe: plan.effetLe.toISOString(),
          miseEnDemeureLe: miseEnDemeureLe?.toISOString() ?? null,
          motif,
        } as object,
      },
    });
    return true;
  });
  if (!cree) return { ok: false, message: "Une résiliation est déjà notifiée pour cet apporteur." };

  try {
    const destinataire = decryptPii(a.email) ?? "";
    if (destinataire) {
      const fondement =
        e.fondement === "11.1"
          ? e.initiative === "apporteur"
            ? "11.1-apporteur"
            : "11.1-societe"
          : e.fondement;
      const r = await envoyer({
        gabarit: "apporteur-resiliation-notifiee",
        destinataire,
        payload: {
          prenom: decryptPii(a.prenom) ?? "",
          fondement,
          notifieeLe: jourLong(e.notifieeLe),
          effetLe: jourLong(plan.effetLe),
          ...(e.fondement === "11.2" && e.miseEnDemeureLe
            ? { miseEnDemeureLe: jourLong(e.miseEnDemeureLe) }
            : {}),
          ...(motif && e.fondement !== "11.1" ? { motif } : {}),
        },
        entityType: "ApporteurReseau",
        entityId: e.apporteurId,
        jobId: `resiliation-notif-${e.apporteurId}`,
      });
      if (r === "envoye") await poserHorodatage(e.apporteurId, { emailNotifEnvoyeAt: maintenant });
    }
  } catch (err) {
    signalerErreurReseau("résiliation : e-mail de notification", err);
  }

  if (plan.immediat) {
    try {
      const r = await executerResiliation(e.apporteurId, plan.effetLe, maintenant);
      return r.ok ? { ok: true, message: `Résiliation notifiée, effet immédiat. ${r.message}` } : r;
    } catch (err) {
      signalerErreurReseau("résiliation : prise d'effet immédiate", err);
      return {
        ok: true,
        message:
          "Résiliation notifiée ; la prise d'effet a échoué et sera reprise par le passage quotidien. Ne la saisissez pas une seconde fois.",
      };
    }
  }
  return {
    ok: true,
    message: `Résiliation notifiée le ${jourLong(e.notifieeLe)} ; elle prendra effet le ${jourLong(plan.effetLe)}.`,
  };
}

// ── Reprise ──────────────────────────────────────────────────────────────

/** Art. 4.5 (contrat 2.3) : la reprise ne peut intervenir que dans les vingt-quatre mois suivant l'annulation. */
export const DELAI_REPRISE_MOIS = 24;

export function verifierReprise(e: {
  statutOrigine: string;
  montantOrigineCents: number | null;
  reprisesDejaCents: number;
  demandeeCents: number;
  motif: string;
  annulationLe: Date;
  maintenant: Date;
}): { ok: true } | { ok: false; message: string } {
  if (e.statutOrigine !== "versee")
    return { ok: false, message: "Une reprise ne porte que sur une commission déjà versée." };
  if (!Number.isInteger(e.demandeeCents) || e.demandeeCents <= 0)
    return { ok: false, message: "Indiquez un montant positif." };
  if (!e.motif.trim()) return { ok: false, message: "Indiquez le motif de la reprise." };
  const restant = (e.montantOrigineCents ?? 0) - e.reprisesDejaCents;
  if (e.demandeeCents > restant)
    return {
      ok: false,
      message: `La reprise ne peut dépasser ${euros(Math.max(0, restant))} (commission versée, moins les reprises déjà faites).`,
    };
  if (e.maintenant.getTime() > ajouterMois(e.annulationLe, DELAI_REPRISE_MOIS).getTime())
    return {
      ok: false,
      message: "Plus de vingt-quatre mois depuis l'annulation : reprise impossible (art. 4.5).",
    };
  // Des JOURS de Paris : la date du jour, saisie dans la console, est toujours admise.
  if (jourParis(e.annulationLe) > jourParis(e.maintenant))
    return { ok: false, message: "La date d'annulation ne peut pas être dans le futur." };
  return { ok: true };
}

/** « 150,50 » ou « 150.5 » → 15050 centimes ; `null` si ce n'est pas un montant. */
export function montantEnCentimes(brut: string): number | null {
  const s = brut.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Préfixe du champ `palier` d'une ligne de reprise : il porte l'id de la commission d'origine. */
export const PREFIXE_PALIER_REPRISE = "reprise-de:";

export async function enregistrerReprise(e: {
  commissionId: string;
  /** L'apporteur dont on ouvre la fiche : la commission doit être la sienne. */
  apporteurId?: string;
  demandeeCents: number;
  motif: string;
  /** Date de l'annulation (remboursement, avoir) ; par défaut aujourd'hui. */
  annulationLe?: Date;
  maintenant?: Date;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const maintenant = e.maintenant ?? new Date();
  const origine = await prisma.commissionApporteur.findUnique({
    where: { id: e.commissionId },
    select: {
      id: true,
      apporteurId: true,
      presentationId: true,
      statut: true,
      parrainage: true,
      montantCents: true,
      autofactureNumero: true,
    },
  });
  if (!origine || (e.apporteurId && origine.apporteurId !== e.apporteurId))
    return { ok: false, message: "Commission introuvable." };
  const deja = await prisma.commissionApporteur.findMany({
    where: { apporteurId: origine.apporteurId, palier: `${PREFIXE_PALIER_REPRISE}${origine.id}` },
    select: { montantCents: true },
  });
  const reprisesDejaCents = deja.reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0);
  const verdict = verifierReprise({
    statutOrigine: origine.statut,
    montantOrigineCents: origine.montantCents,
    reprisesDejaCents,
    demandeeCents: e.demandeeCents,
    motif: e.motif,
    annulationLe: e.annulationLe ?? maintenant,
    maintenant,
  });
  if (!verdict.ok) return verdict;
  const motif = e.motif.trim().slice(0, 500);
  const refusTardif = await prisma.$transaction(
    async (tx) => {
      // Relecture de a1 (09/10) : deux passages concurrents (ou un clic et un passage) ne reprennent
      // pas deux fois. Verrou par commission d'origine, puis RELECTURE des reprises sous le verrou.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reprise:${origine.id}`}))`;
      const sousVerrou = await tx.commissionApporteur.findMany({
        where: {
          apporteurId: origine.apporteurId,
          palier: `${PREFIXE_PALIER_REPRISE}${origine.id}`,
        },
        select: { montantCents: true },
      });
      const dejaSousVerrou = sousVerrou.reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0);
      if (dejaSousVerrou !== reprisesDejaCents) {
        const v = verifierReprise({
          statutOrigine: origine.statut,
          montantOrigineCents: origine.montantCents,
          reprisesDejaCents: dejaSousVerrou,
          demandeeCents: e.demandeeCents,
          motif: e.motif,
          annulationLe: e.annulationLe ?? maintenant,
          maintenant,
        });
        if (!v.ok) return v;
      }
      // `factureId` n'a pas de clé étrangère : la ligne de reprise porte son propre identifiant, la
      // ligne d'origine est conservée telle quelle (art. 4.5) et la contrainte d'unicité est tenue.
      await tx.commissionApporteur.create({
        data: {
          apporteurId: origine.apporteurId,
          presentationId: origine.presentationId,
          factureId: randomUUID(),
          parrainage: origine.parrainage,
          activite: "reprise",
          palier: `${PREFIXE_PALIER_REPRISE}${origine.id}`,
          factureHtCents: 0,
          montantCents: -e.demandeeCents,
          statut: "reprise",
        },
        select: { id: true },
      });
      const a = await tx.apporteurReseau.findUnique({
        where: { id: origine.apporteurId },
        select: { noteInterne: true },
      });
      const ligne = `[${maintenant.toISOString().slice(0, 10)}] Reprise de ${euros(e.demandeeCents)} sur une commission versée${origine.autofactureNumero ? ` (${origine.autofactureNumero})` : ""} : ${motif}`;
      await tx.apporteurReseau.update({
        where: { id: origine.apporteurId },
        data: { noteInterne: [a?.noteInterne, ligne].filter(Boolean).join("\n").slice(0, 5000) },
      });
      return null;
    },
    { timeout: 15_000 },
  );
  if (refusTardif) return refusTardif;
  return {
    ok: true,
    message: `Reprise de ${euros(e.demandeeCents)} enregistrée : elle sera déduite de la prochaine autofacture de cet apporteur.`,
  };
}
