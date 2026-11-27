"use server";

// Questionnaire du Baromètre 2027 — retrait des réponses par code (RGPD art. 7.3).
// Le navigateur n'envoie que SHA-256(code). Suppression LIMITÉE à la campagne et à la ligne
// portant cette empreinte. Même message que l'empreinte existe ou non (aucun oracle).
// Le retrait reste possible après l'envoi, à tout moment.

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";
import { verifyTurnstile } from "@/lib/turnstile";
import { CAMPAGNE, RATE_LIMIT_PREFIX } from "@/lib/barometre-questionnaire/constantes";

export type RetraitState = { ok: true; message: string } | { ok: false; error: string };

const MESSAGE = "Si ce code correspond à une réponse, elle est retirée.";

const inputSchema = z
  .object({
    empreinte: z.string().regex(/^[0-9a-f]{64}$/),
    turnstileToken: z.string().min(1).max(4096),
  })
  .strict();

export async function retirerReponsesQuestionnaire(input: unknown): Promise<RetraitState> {
  try {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Demande invalide." };

    const ip = await getClientIp();
    // Sans IP lisible : seau « inconnu » à limite plus large (voir envoyer.ts).
    const empreinte = hashIp(ip);
    const rl = await checkRateLimit(`${RATE_LIMIT_PREFIX}-retrait:${empreinte ?? "inconnu"}`, {
      limit: empreinte ? 5 : 60,
      windowSec: 600,
    });
    if (!rl.allowed) {
      return { ok: false, error: "Trop de tentatives. Merci de réessayer plus tard." };
    }

    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
      return { ok: false, error: "Vérification anti-robot refusée." };
    }

    await prisma.barometreQuestionnaireReponse.deleteMany({
      where: { codeRetraitHash: parsed.data.empreinte, campagne: CAMPAGNE },
    });
    return { ok: true, message: MESSAGE };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "barometre-questionnaire-retrait" } });
    // Une panne doit être dite : la personne ne doit pas croire sa réponse retirée.
    return {
      ok: false,
      error:
        "Le retrait n'a pas pu être fait. Rien n'a changé : réessayez dans quelques minutes, avec le même code.",
    };
  }
}
