/**
 * Qualiopi — Server Actions Portail stagiaire + RGPD (AGENT B — T14).
 *
 * Actions PORTAIL (authentification via cookie, PAS requireAdminWrite) :
 *   accederPortailAction          : vérifie le token URL → pose le cookie → { ok: true }
 *   quitterPortailAction          : supprime le cookie (déconnexion)
 *   soumettreSatisfactionPortailAction : réutilise soumettreReponses T10 via cookie
 *   declarerHandicapAction        : set situationHandicap + handicapDetailsChiffre (encryptPii)
 *   demanderExportRgpdAction      : crée demande RGPD type=export via cookie
 *   demanderSuppressionRgpdAction : crée demande RGPD type=suppression via cookie
 *
 * Actions ADMIN (requireAdminWrite + audit) :
 *   genererPortailAccesAction     : crée un accès portail pour un stagiaire
 *   revoquerPortailAccesAction    : révoque un accès portail existant
 *
 * Règles non négociables :
 * - Cookie via helpers cookie.ts (HttpOnly, Secure, SameSite=Lax).
 * - PII handicap chiffré via encryptPii (jamais en clair en DB).
 * - Authentification portail = getPortailToken() + verifierToken() — PAS requireAdminWrite.
 * - exactOptionalPropertyTypes.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  creerAcces,
  verifierToken,
  revoquerAcces,
  demanderAccesParEmail,
} from "@/server/qualiopi/portail/portail-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import {
  setPortailCookie,
  getPortailToken,
  clearPortailCookie,
} from "@/server/qualiopi/portail/cookie";
import { creerDemandeRgpd } from "@/server/qualiopi/portail/rgpd-service";
import { soumettreReponses } from "@/server/qualiopi/satisfaction/satisfaction-service";
import { encryptPii } from "@/lib/pii-crypto";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const accederPortailSchema = z.object({
  token: z.string().length(64),
});

const demanderAccesSchema = z.object({
  email: z.string().trim().email().max(254),
});

const genererPortailAccesSchema = z.object({
  traineeId: z.string().uuid(),
  joursValidite: z.number().int().min(1).max(365).optional(),
});

const revoquerPortailAccesSchema = z.object({
  id: z.string().uuid(),
});

const soumettreSatisfactionPortailSchema = z.object({
  token: z.string().min(1),
  reponses: z.record(z.unknown()),
  noteGlobale: z.number().int().min(1).max(5).optional(),
});

const declarerHandicapSchema = z.object({
  besoin: z.string().min(1).max(2000),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout le traineeId depuis le cookie portail.
 * Retourne { traineeId } ou { error }.
 */
async function resolveTraineeIdFromCookie(): Promise<{ traineeId: string } | { error: string }> {
  const cookieToken = await getPortailToken();
  if (!cookieToken) return { error: "Session portail absente — veuillez vous reconnecter" };

  const result = await verifierToken(cookieToken);
  if (!result) return { error: "Session portail expirée ou révoquée — veuillez vous reconnecter" };

  return { traineeId: result.traineeId };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — accederPortailAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie un token URL portail, pose le cookie de session et retourne { ok: true }.
 * La redirection vers /portail/mon-espace est effectuée côté page client.
 */
export async function accederPortailAction(input: {
  token: string;
}): Promise<ActionResult<{ ok: boolean }>> {
  const parsed = accederPortailSchema.safeParse(input);
  if (!parsed.success) return { error: "Lien invalide" };

  const result = await verifierToken(parsed.data.token);
  if (!result) return { error: "Lien invalide, expiré ou révoqué" };

  await setPortailCookie(parsed.data.token);
  return { data: { ok: true } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — demanderAccesPortailAction (self-service, public, sans cookie)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-demande self-service d'un lien d'accès à l'espace stagiaire par email.
 *
 * - PUBLIC (aucun cookie/admin requis).
 * - Anti-énumération : retourne TOUJOURS le même résultat, que l'email existe
 *   ou non (l'envoi éventuel se fait côté service, silencieusement).
 * - Rate-limité par IP (5 demandes / 15 min) pour éviter l'email-bombing.
 */
export async function demanderAccesPortailAction(input: {
  email: string;
}): Promise<ActionResult<{ ok: true }>> {
  const generic: ActionResult<{ ok: true }> = { data: { ok: true } };
  const parsed = demanderAccesSchema.safeParse(input);
  if (!parsed.success) return generic;

  try {
    const hdrs = await headers();
    const ip =
      hdrs.get("cf-connecting-ip") ??
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rl = await checkRateLimit(`portail:reacces:${ip}`, { limit: 5, windowSec: 900 });
    if (!rl.allowed) return generic; // silencieux
  } catch {
    // fail-open : un rate-limit indisponible ne doit pas bloquer la demande
  }

  try {
    await demanderAccesParEmail(parsed.data.email);
  } catch {
    // fail-soft : ne jamais révéler d'erreur interne au public
  }
  return generic;
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — quitterPortailAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Déconnecte le stagiaire en supprimant le cookie de session portail.
 */
export async function quitterPortailAction(): Promise<ActionResult<{ ok: boolean }>> {
  await clearPortailCookie();
  return { data: { ok: true } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — soumettreSatisfactionPortailAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soumet les réponses à un questionnaire de satisfaction depuis le portail stagiaire.
 * Réutilise `soumettreReponses` de T10 (satisfaction-service).
 * S'authentifie via le cookie portail (PAS requireAdminWrite).
 */
export async function soumettreSatisfactionPortailAction(input: {
  token: string;
  reponses: Record<string, unknown>;
  noteGlobale?: number;
}): Promise<ActionResult<{ id: string }>> {
  // Vérifier l'authentification portail
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const parsed = soumettreSatisfactionPortailSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // A-01 (IDOR) : vérifier que le questionnaire appartient bien au stagiaire authentifié.
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { token: v.token },
    select: { enrollment: { select: { traineeId: true } } },
  });
  if (!questionnaire || questionnaire.enrollment.traineeId !== authResult.traineeId) {
    return { error: "Questionnaire introuvable ou non autorisé" };
  }

  const result = await soumettreReponses({
    token: v.token,
    reponses: v.reponses,
    ...(v.noteGlobale !== undefined ? { noteGlobale: v.noteGlobale } : {}),
  });

  if (!result) return { error: "Questionnaire introuvable ou déjà soumis" };

  return { data: { id: result.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — declarerHandicapAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Déclare la situation de handicap depuis le portail stagiaire.
 * Chiffre le détail via encryptPii (jamais en clair en DB).
 * S'authentifie via le cookie portail.
 */
export async function declarerHandicapAction(input: {
  besoin: string;
}): Promise<ActionResult<{ ok: boolean }>> {
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const parsed = declarerHandicapSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const handicapDetailsChiffre = encryptPii(parsed.data.besoin);

  await prisma.trainee.update({
    where: { id: authResult.traineeId },
    data: {
      situationHandicap: true,
      handicapDetailsChiffre,
    },
  });

  return { data: { ok: true } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — demanderExportRgpdAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une demande de droit d'accès RGPD (export) pour le stagiaire connecté.
 */
export async function demanderExportRgpdAction(): Promise<ActionResult<{ id: string }>> {
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const demande = await creerDemandeRgpd(authResult.traineeId, "export");
  return { data: { id: demande.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAIL — demanderSuppressionRgpdAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une demande de droit à l'effacement RGPD (suppression) pour le stagiaire connecté.
 */
export async function demanderSuppressionRgpdAction(): Promise<ActionResult<{ id: string }>> {
  const authResult = await resolveTraineeIdFromCookie();
  if ("error" in authResult) return { error: authResult.error };

  const demande = await creerDemandeRgpd(authResult.traineeId, "suppression");
  return { data: { id: demande.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — genererPortailAccesAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un accès portail pour un stagiaire (ADMIN).
 * Retourne le token et l'URL de connexion à transmettre au stagiaire.
 */
export async function genererPortailAccesAction(input: {
  traineeId: string;
  joursValidite?: number;
}): Promise<ActionResult<{ id: string; token: string; url: string; expiresAt: Date }>> {
  const session = await requireAdminWrite();

  const parsed = genererPortailAccesSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const acces = await creerAcces(
    v.traineeId,
    v.joursValidite !== undefined ? v.joursValidite : undefined,
  );

  // URL à transmettre au stagiaire (remplace localhost par le domaine en prod)
  const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com";
  const url = `${baseUrl}/fr/portail/acces/${acces.token}`;

  await logQualiopiActivity({
    action: "qualiopi.portail.generer_acces",
    targetType: "PortailAcces",
    targetId: acces.id,
    changes: { traineeId: v.traineeId, expiresAt: acces.expiresAt },
    session,
  });

  return { data: { id: acces.id, token: acces.token, url, expiresAt: acces.expiresAt } };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — revoquerPortailAccesAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Révoque un accès portail (ADMIN).
 */
export async function revoquerPortailAccesAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();

  const parsed = revoquerPortailAccesSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id } = parsed.data;

  await revoquerAcces(id);

  await logQualiopiActivity({
    action: "qualiopi.portail.revoquer_acces",
    targetType: "PortailAcces",
    targetId: id,
    changes: { revoked: true },
    session,
  });

  return { data: { id } };
}
