/**
 * 🔴 ADR 0060 — LA garde des écritures sur un dossier de session.
 *
 * Appelée en tête de chaque action classée VERROU dans
 * `verrou-dossier-registre.ts` ; ré-exportée par `actions/qualiopi/_guards.ts`.
 * Le test `ecritures-refusees-dossier-clos.spec.ts` parcourt le registre et
 * vérifie qu'aucune de ces actions n'écrit sur un dossier clos.
 *
 * Module sans `"use server"` : ce n'est pas un point d'entrée HTTP.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import type { DocumentType } from "../../../../prisma/generated/client";
import {
  chargerEtatVerrou,
  messageDossierClos,
  resoudreSessionId,
  verrouDossierActif,
  type RefSession,
} from "./verrou-dossier";

/**
 * Refus d'une écriture sur un dossier de session CLOS (ADR 0060).
 *
 * 🔑 L'objet porte `error` ET `message` : il se renvoie TEL QUEL depuis une
 * action qui répond `{ error }` (ActionResult) comme depuis une action qui
 * répond `{ ok: false, message }`. Une seule forme, donc une seule garde, au
 * lieu d'un message recopié dans soixante actions.
 */
export interface RefusDossierClos {
  readonly ok: false;
  readonly code: "DOSSIER_CLOS";
  readonly message: string;
  readonly error: string;
}

/**
 * 🔴 ADR 0060 — la garde des écritures classées VERROU
 * (`verrou-dossier-registre.ts`). À appeler EN TÊTE de l'action, avant toute
 * lecture métier et toute écriture.
 *
 * Refuse quand le dossier de la session est `clos` ; laisse passer quand il est
 * `rouvert` (le geste de réouverture est tracé), en préparation, en cours, ou
 * encore à recueillir.
 *
 * @param ref identifiant de session, ou référence à résoudre (inscription,
 *            pièce, créneau, questionnaire, incident…). Une cible sans session
 *            (pièce hors session) ou introuvable passe : l'action répondra
 *            elle-même.
 */
export async function assertDossierOuvert(
  ref: string | RefSession | null | undefined,
): Promise<{ readonly ok: true; readonly sessionId: string | null } | RefusDossierClos> {
  if (ref == null) return { ok: true, sessionId: null };
  const sessionId = typeof ref === "string" ? ref : await resoudreSessionId(ref);
  // Interrupteur de secours : le verrou est coupé, on laisse passer — mais une
  // écriture sur un dossier CLOS ne passe jamais en silence (revue sécurité
  // #1245) : elle est signalée, puisque le journal du dossier, lui, dit « clos ».
  if (!verrouDossierActif()) {
    if (sessionId !== null) await signalerEcritureVerrouCoupe(sessionId);
    return { ok: true, sessionId };
  }
  if (sessionId === null) return { ok: true, sessionId: null };
  const lu = await chargerEtatVerrou(sessionId);
  if (lu !== null && lu.etat.etat === "clos") {
    const message = messageDossierClos(lu.etat.depuis);
    return { ok: false, code: "DOSSIER_CLOS", message, error: message };
  }
  return { ok: true, sessionId };
}

/**
 * Signale (Sentry, niveau warning) une écriture laissée passer sur un dossier
 * CLOS parce que l'interrupteur `QUALIOPI_VERROU_DOSSIER=off` est posé. Ne
 * bloque jamais : une panne de lecture ou de signalement laisse l'écriture
 * passer, puisque c'est précisément ce que l'interrupteur demande.
 */
async function signalerEcritureVerrouCoupe(sessionId: string): Promise<void> {
  try {
    const lu = await chargerEtatVerrou(sessionId);
    if (lu === null || lu.etat.etat !== "clos") return;
    Sentry.captureMessage("qualiopi : écriture sur un dossier CLOS, verrou coupé par l'interrupteur", {
      level: "warning",
      tags: { etape: "verrou_dossier_coupe" },
      extra: { sessionId },
    });
  } catch {
    // Le signalement ne doit jamais faire échouer l'écriture autorisée.
  }
}

/**
 * Variante pour les pièces dont la PREMIÈRE émission reste ouverte sur un
 * dossier clos (certificat de réalisation, kits OPCO / CPF / France Travail) :
 * la garde ne s'applique que si une pièce VIVANTE de ce type existe déjà pour
 * la même cible — c'est-à-dire quand le geste est une RÉGÉNÉRATION.
 *
 * Pourquoi la première émission reste ouverte : un financeur peut réclamer le
 * certificat des mois après la clôture ; le refuser priverait l'organisme de
 * son règlement sans rien protéger, puisqu'aucune preuve existante n'est
 * modifiée.
 */
export async function assertDossierOuvertSiRegeneration(
  cible: { readonly sessionId: string } | { readonly enrollmentId: string },
  type: DocumentType,
): Promise<{ readonly ok: true; readonly sessionId: string | null } | RefusDossierClos> {
  let sessionId: string | null;
  let traineeId: string | null = null;
  if ("sessionId" in cible) {
    sessionId = cible.sessionId;
  } else {
    const e = await prisma.enrollment.findUnique({
      where: { id: cible.enrollmentId },
      select: { sessionId: true, traineeId: true },
    });
    sessionId = e?.sessionId ?? null;
    traineeId = e?.traineeId ?? null;
  }
  if (sessionId === null) return { ok: true, sessionId: null };
  const vivantes = await prisma.documentGenere.count({
    where: {
      sessionId,
      type,
      annuleeAt: null,
      ...(traineeId !== null ? { traineeId } : {}),
    },
  });
  if (vivantes === 0) return { ok: true, sessionId };
  return assertDossierOuvert(sessionId);
}
