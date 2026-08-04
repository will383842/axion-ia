/**
 * Qualiopi — Server Action de la page publique d'enquête ENTREPRISE.
 *
 * ⚠️ SURFACE NON AUTHENTIFIÉE. Le jeton (64 caractères non devinables, stocké
 * en base) est la seule barrière — même modèle de confiance que l'émargement
 * public. Deux gardes, dans cet ordre :
 *
 *   1. **Rate-limit par jeton haché** : un contact client répond une fois ;
 *      6 tentatives/minute laissent la place aux reprises après une erreur de
 *      saisie, et arrêtent un rejeu. Le hash, jamais le jeton en clair — Redis
 *      persiste, et `MONITOR` l'exposerait.
 *   2. **Le jeton doit désigner une enquête ENTREPRISE** : ce point n'est pas
 *      décoratif. `soumettreReponses` accepte n'importe quel type de
 *      questionnaire ; sans ce verrou, le jeton d'un questionnaire STAGIAIRE
 *      posté sur cette action écrirait une réponse « entreprise » au nom d'un
 *      stagiaire.
 *
 * Le versement au registre des appréciations (source « entreprise ») est fait
 * par `soumettreReponses` → `verserAuxRegistres` — pas ici.
 */

"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { soumettreReponses } from "@/server/qualiopi/satisfaction/satisfaction-service";

const LIMITE_PAR_JETON = { limit: 6, windowSec: 60 } as const;

const soumettreEnqueteSchema = z.object({
  token: z.string().min(1).max(64),
  noteGlobale: z.number().int().min(1).max(5),
  commentaire: z.string().trim().max(2000).optional(),
  repondantNom: z.string().trim().max(200).optional(),
  repondantFonction: z.string().trim().max(150).optional(),
});

type ActionResult<T> = { data: T } | { error: string };

export async function soumettreEnqueteEntrepriseAction(input: {
  token: string;
  noteGlobale: number;
  commentaire?: string;
  repondantNom?: string;
  repondantFonction?: string;
}): Promise<ActionResult<{ ok: true }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Service momentanément indisponible." };
  }

  const parsed = soumettreEnqueteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Merci de choisir une note entre 1 et 5." };
  }
  const v = parsed.data;

  const tokenHash = createHash("sha256").update(v.token).digest("hex").slice(0, 32);
  const rl = await checkRateLimit(`enquete-entreprise:${tokenHash}`, LIMITE_PAR_JETON);
  if (!rl.allowed) {
    return { error: "Trop de tentatives — réessayez dans une minute." };
  }

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { token: v.token },
    select: { type: true, reponduAt: true },
  });
  if (questionnaire === null) {
    return { error: "Ce lien n'est pas valide." };
  }
  if (questionnaire.type !== "satisfaction_entreprise") {
    // Cf. l'en-tête : sans ce verrou, un jeton STAGIAIRE posté ici écrirait
    // une réponse « entreprise ».
    return { error: "Ce lien n'est pas valide." };
  }
  if (questionnaire.reponduAt !== null) {
    return { error: "Cette enquête a déjà été renseignée — merci !" };
  }

  const result = await soumettreReponses({
    token: v.token,
    reponses: {
      ...(v.commentaire !== undefined && v.commentaire !== ""
        ? { commentaire: v.commentaire }
        : {}),
      ...(v.repondantNom !== undefined && v.repondantNom !== ""
        ? { repondantNom: v.repondantNom }
        : {}),
      ...(v.repondantFonction !== undefined && v.repondantFonction !== ""
        ? { repondantFonction: v.repondantFonction }
        : {}),
    },
    noteGlobale: v.noteGlobale,
  });

  if (result === null) {
    return { error: "Ce lien n'est pas valide." };
  }
  return { data: { ok: true } };
}
