"use server";

// Questionnaire du Baromètre 2027 — envoi des réponses (consentement explicite).
// Ce qui est écrit : les réponses fermées, deux textes libres facultatifs, les versions du
// questionnaire et du consentement, l'empreinte du code de retrait, le jour (UTC, tronqué).
// Jamais : IP, empreinte d'IP, e-mail, agent navigateur, horodatage précis, identifiant.
// Les textes libres ne vont ni dans Sentry, ni dans les journaux.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";
import { verifyTurnstile } from "@/lib/turnstile";
import { reponsesSchema } from "@/lib/barometre-questionnaire/schema";
import {
  CAMPAGNE,
  CONSENT_VERSION,
  QUESTIONNAIRE_VERSION,
  RATE_LIMIT_PREFIX,
  estOuvert,
} from "@/lib/barometre-questionnaire/constantes";

export type EnvoiState = { ok: true } | { ok: false; error: string };

const MIN_FILL_MS = 3000;

/** Date tronquée au jour (00:00:00.000 UTC) : évite le recoupement avec les journaux d'accès. */
function auJour(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function envoyerReponsesBarometre(input: unknown): Promise<EnvoiState> {
  try {
    if (!estOuvert(new Date())) return { ok: false, error: "Le questionnaire est fermé." };

    const parsed = reponsesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Réponses invalides." };
    const d = parsed.data;

    // Pot de miel / délai trop court : succès silencieux, aucune écriture.
    if (d.website && d.website.trim().length > 0) return { ok: true };
    if (Date.now() - d.startedAt < MIN_FILL_MS) return { ok: true };

    // Limite de débit par EMPREINTE d'IP (jamais l'IP en clair dans la clé Redis).
    const ip = await getClientIp();
    // Sans IP lisible (getClientIp rend null), tout le monde partagerait un seau de 5 essais :
    // le seau « inconnu » a donc une limite plus large (filet global, pas une limite par personne).
    const empreinte = hashIp(ip);
    const rl = await checkRateLimit(`${RATE_LIMIT_PREFIX}:${empreinte ?? "inconnu"}`, {
      limit: empreinte ? 5 : 60,
      windowSec: 600,
    });
    if (!rl.allowed) {
      return { ok: false, error: "Trop de tentatives. Merci de réessayer plus tard." };
    }

    if (!(await verifyTurnstile(d.turnstileToken, ip))) {
      return { ok: false, error: "Vérification anti-robot refusée. Rien n'a été enregistré." };
    }

    const reponses = {
      q1: d.q1,
      q2: d.q2,
      q3: d.q3,
      q4: d.q4,
      ...(d.q5 ? { q5: d.q5 } : {}),
      ...(d.q6 ? { q6: d.q6 } : {}),
      ...(d.q7 ? { q7: d.q7 } : {}),
      ...(d.q8 ? { q8: d.q8 } : {}),
      ...(d.q9 ? { q9: d.q9 } : {}),
      q10: d.q10,
      q11: d.q11,
      q12: d.q12,
      q13: d.q13,
      ...(d.q14 ? { q14: d.q14 } : {}),
    };

    await prisma.barometreQuestionnaireReponse.create({
      data: {
        campagne: CAMPAGNE,
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        consentVersion: CONSENT_VERSION,
        codeRetraitHash: d.codeRetraitHash,
        jour: auJour(new Date()),
        reponses,
        texteUsage: d.q15 ?? null,
        texteQuestion: d.q16 ?? null,
      },
    });
    return { ok: true };
  } catch (e) {
    // Un tag seulement : aucun `extra`, aucun contexte de requête, jamais les réponses.
    Sentry.captureException(e, { tags: { area: "barometre-questionnaire" } });
    return { ok: false, error: "Une erreur est survenue. Rien n'a été enregistré." };
  }
}
