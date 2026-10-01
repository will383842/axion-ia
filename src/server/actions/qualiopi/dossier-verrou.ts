/**
 * 🔴 ADR 0060 — rouvrir un dossier de session clos, et le clore à nouveau.
 *
 * Le verrou est DÉRIVÉ (`etatVerrouDossier`) : ces deux actions n'écrivent
 * aucun statut, elles ajoutent une ligne au journal APPEND-ONLY
 * `session_dossier_evenements` — que la base refuse de modifier ou d'effacer.
 * Le dernier événement prime : après une réouverture, le dossier est modifiable
 * quelles que soient ses pièces ; après un reverrouillage, il est de nouveau
 * clos.
 *
 * Ce que voit le certificateur : chaque réouverture, sa date et son heure, le
 * NOM de son auteur (figé au moment du geste), son motif intégral, les actions
 * menées pendant l'ouverture, et la date du reverrouillage — dans le dossier de
 * session (`dossier-session.ts`) et dans le manifeste global.
 *
 * Habilitation : `rouvrir_dossier` (direction seule), pour les deux gestes.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { requireAdminRead, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { peutEngager, MOTIF_REFUS } from "@/server/auth/habilitations";
import {
  chargerEtatVerrou,
  libelleManquant,
  manquantsPourClore,
  texteEtatVerrou,
} from "@/server/qualiopi/sessions/verrou-dossier";
import { verifierMotDePasseReouverture } from "@/server/qualiopi/sessions/mot-de-passe-reouverture";
import { checkRateLimit } from "@/lib/rate-limit";

type ActionResult<T> = { data: T } | { error: string };

/** Même seuil que le CHECK en base et que `annulee_motif`. */
const MOTIF_REOUVERTURE_MIN = 10;
/** Tentatives de réouverture (mot de passe) par compte et par heure. */
const ESSAIS_REOUVERTURE_PAR_HEURE = 5;

const rouvrirSchema = z.object({
  sessionId: z.string().uuid(),
  /** Mot de passe de sécurité (décision du dirigeant) — jamais journalisé. */
  motDePasse: z.string({ required_error: "Mot de passe de sécurité obligatoire" }).max(200),
  motif: z
    .string({ required_error: "Motif obligatoire" })
    .trim()
    .min(
      MOTIF_REOUVERTURE_MIN,
      `Motif obligatoire (${MOTIF_REOUVERTURE_MIN} caractères au moins) : il est lu par l'auditeur.`,
    )
    .max(2000),
});

const reverrouillerSchema = z.object({
  sessionId: z.string().uuid(),
  motif: z.string().trim().max(2000).optional(),
});

/** Nom lisible de l'auteur, FIGÉ dans l'événement (jamais un identifiant). */
async function nomAuteur(userId: string, role: string): Promise<string> {
  const auteur = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return typeof auteur?.name === "string" && auteur.name.trim() !== "" ? auteur.name.trim() : role;
}

function revaliderSession(sessionId: string): void {
  try {
    revalidatePath(adminPath("fr", `qualiopi/sessions/${sessionId}`));
  } catch {
    // Hors requête Next (tests, scripts) : rien à revalider.
  }
}

/**
 * Rouvre un dossier CLOS. Motif obligatoire (≥ 10 caractères), tracé en base
 * (append-only) et au journal d'activité, visible par l'auditeur.
 */
export async function rouvrirDossierSessionAction(input: {
  sessionId: string;
  motif: string;
  motDePasse: string;
}): Promise<ActionResult<{ sessionId: string; depuis: string }>> {
  const session = await requireAdminRead();
  if (!peutEngager(session.role, "rouvrir_dossier")) {
    return { error: MOTIF_REFUS.rouvrir_dossier };
  }
  const parsed = rouvrirSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const { sessionId, motif, motDePasse } = parsed.data;

  // Anti-essais (revue sécurité #1245) : 5 tentatives par heure et par compte,
  // AVANT le calcul scrypt (synchrone, coûteux). Compteur indisponible : on
  // laisse passer, le mot de passe reste exigé.
  const essais = await checkRateLimit(`qualiopi:reouverture:${session.userId}`, {
    limit: ESSAIS_REOUVERTURE_PAR_HEURE,
    windowSec: 3600,
  });
  if (!essais.allowed) {
    await logQualiopiActivity({
      action: "qualiopi.session.dossier.reouverture_refusee",
      targetType: "TrainingSession",
      targetId: sessionId,
      changes: { raison: "trop_d_essais" },
      session,
    });
    return {
      error:
        "Trop de tentatives de réouverture en une heure. Réessayez plus tard ; le dossier reste clos.",
    };
  }

  // Second facteur voulu par le dirigeant (2026-09-30) : même habilité, on ne
  // rouvre pas une preuve sans le mot de passe de sécurité. Le refus est TRACÉ
  // (tentative), le mot de passe jamais.
  const verification = verifierMotDePasseReouverture(motDePasse);
  if (!verification.ok) {
    await logQualiopiActivity({
      action: "qualiopi.session.dossier.reouverture_refusee",
      targetType: "TrainingSession",
      targetId: sessionId,
      changes: { raison: verification.raison },
      session,
    });
    return {
      error:
        verification.raison === "non_configure"
          ? "Réouverture impossible : le mot de passe de sécurité n'est pas configuré sur le serveur (QUALIOPI_REOUVERTURE_MDP)."
          : "Mot de passe de sécurité incorrect. Le dossier reste clos.",
    };
  }

  const auteurNom = await nomAuteur(session.userId, session.role);

  let resultat: { ok: true; depuis: Date } | { ok: false; error: string };
  try {
    resultat = await prisma.$transaction(async (tx) => {
      // L'état est RELU dans la transaction qui écrit : on ne rouvre qu'un
      // dossier réellement clos à cet instant.
      const lu = await chargerEtatVerrou(sessionId, tx);
      if (lu === null) return { ok: false as const, error: "Session introuvable" };
      if (lu.etat.etat !== "clos") {
        return {
          ok: false as const,
          error: `Ce dossier n'est pas clos — rien à rouvrir. ${texteEtatVerrou(lu.etat)}`,
        };
      }
      const ev = await tx.sessionDossierEvenement.create({
        data: {
          sessionId,
          type: "reouverture",
          motif,
          auteurId: session.userId,
          auteurNom,
        },
        select: { createdAt: true },
      });
      return { ok: true as const, depuis: ev.createdAt };
    });
  } catch (err) {
    return {
      error:
        "La réouverture n'a pas pu être enregistrée" +
        (err instanceof Error ? ` (${err.message.slice(0, 200)})` : "") +
        ". Le dossier reste clos.",
    };
  }
  if (!resultat.ok) return { error: resultat.error };

  // EN PLUS de l'événement (la preuve), pour la recherche transverse. Best-effort.
  await logQualiopiActivity({
    action: "qualiopi.session.dossier.rouvert",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { motif, auteurNom },
    session,
  });
  revaliderSession(sessionId);
  return { data: { sessionId, depuis: resultat.depuis.toISOString() } };
}

/**
 * Clôt à nouveau un dossier ROUVERT. Refusé tant que les conditions du verrou
 * (session réalisée, attestation vivante pour chaque inscription active, plus
 * d'émargement signable) ne sont pas réunies ; le refus liste ce qui manque.
 */
export async function reverrouillerDossierSessionAction(input: {
  sessionId: string;
  motif?: string;
}): Promise<ActionResult<{ sessionId: string; depuis: string }>> {
  const session = await requireAdminRead();
  if (!peutEngager(session.role, "rouvrir_dossier")) {
    return { error: MOTIF_REFUS.rouvrir_dossier };
  }
  const parsed = reverrouillerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId } = parsed.data;
  const motif =
    parsed.data.motif !== undefined && parsed.data.motif !== "" ? parsed.data.motif : null;
  const auteurNom = await nomAuteur(session.userId, session.role);

  let resultat: { ok: true; depuis: Date } | { ok: false; error: string };
  try {
    resultat = await prisma.$transaction(async (tx) => {
      const lu = await chargerEtatVerrou(sessionId, tx);
      if (lu === null) return { ok: false as const, error: "Session introuvable" };
      if (lu.etat.etat !== "rouvert") {
        return {
          ok: false as const,
          error: `Ce dossier n'est pas rouvert — rien à clore. ${texteEtatVerrou(lu.etat)}`,
        };
      }
      if (lu.statut !== "realisee") {
        return {
          ok: false as const,
          error: "Le dossier ne peut être clos que sur une session réalisée.",
        };
      }
      const manquants = manquantsPourClore(lu.entree);
      if (manquants.length > 0) {
        return {
          ok: false as const,
          error:
            `Le dossier ne peut pas être clos : ${manquants.length} élément${manquants.length > 1 ? "s" : ""} ` +
            `manque${manquants.length > 1 ? "nt" : ""} — ` +
            manquants.map(libelleManquant).join(" ; ") +
            ".",
        };
      }
      const ev = await tx.sessionDossierEvenement.create({
        data: {
          sessionId,
          type: "reverrouillage",
          motif,
          auteurId: session.userId,
          auteurNom,
        },
        select: { createdAt: true },
      });
      return { ok: true as const, depuis: ev.createdAt };
    });
  } catch (err) {
    return {
      error:
        "Le reverrouillage n'a pas pu être enregistré" +
        (err instanceof Error ? ` (${err.message.slice(0, 200)})` : "") +
        ".",
    };
  }
  if (!resultat.ok) return { error: resultat.error };

  await logQualiopiActivity({
    action: "qualiopi.session.dossier.reverrouille",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { auteurNom, ...(motif !== null ? { motif } : {}) },
    session,
  });
  revaliderSession(sessionId);
  return { data: { sessionId, depuis: resultat.depuis.toISOString() } };
}
