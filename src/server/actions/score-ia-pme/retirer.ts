"use server";

// Score IA TPE-PME — retrait des réponses par code (RGPD art. 7.3).
// Le navigateur n'envoie que SHA-256(code). Suppression LIMITÉE à source = score-ia-pme
// et à la ligne portant cette empreinte : jamais d'autre donnée. Réponse identique que
// l'empreinte existe ou non (aucun oracle).

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";
import { verifyTurnstile } from "@/lib/turnstile";
import { RATE_LIMIT_PREFIX, SOURCE_SCORE } from "@/lib/score-ia-pme/constantes";

export type RetraitState = { ok: true; message: string } | { ok: false; error: string };

const MESSAGE = "Si ce code correspond à une réponse, elle est retirée.";

const inputSchema = z
  .object({
    empreinte: z.string().regex(/^[0-9a-f]{64}$/),
    turnstileToken: z.string().min(1).max(4096),
  })
  .strict();

export async function retirerReponsesScore(input: unknown): Promise<RetraitState> {
  try {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Demande invalide." };

    const ip = await getClientIp();
    const rl = await checkRateLimit(`${RATE_LIMIT_PREFIX}-retrait:${hashIp(ip) ?? "inconnu"}`, {
      limit: 5,
      windowSec: 600,
    });
    if (!rl.allowed)
      return { ok: false, error: "Trop de tentatives. Merci de réessayer plus tard." };

    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
      return { ok: false, error: "Vérification anti-robot refusée." };
    }

    await prisma.barometerResponse.deleteMany({
      where: { codeRetraitHash: parsed.data.empreinte, source: SOURCE_SCORE },
    });
    return { ok: true, message: MESSAGE };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "score-ia-pme", action: "retirer" } });
    // Une panne doit être dite (RGPD art. 7.3 / 17) : la personne ne doit pas croire sa réponse
    // retirée. Message identique pour tout code : l'échec ne dépend pas de son existence.
    return {
      ok: false,
      error:
        "Le retrait n'a pas pu être fait. Rien n'a changé : réessayez dans quelques minutes, avec le même code.",
    };
  }
}
