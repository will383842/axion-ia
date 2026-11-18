/**
 * LECTURE « ces conversations sont-elles opposées ? » (STOP-T2). Le Studio envoie des références de conversation
 * (`conv`, jamais d'adresse) ; le site répond, pour chacune, `opposee: true|false`, dans l'ordre de la requête.
 *
 * `opposee` est vrai si, pour `convRef = hmacConversationRef(conv)` :
 *   (a) une ligne `oppositions_conv_ref` existe ; OU
 *   (b) un contact de ce convRef a un `merci_statut` écarté (toutes graphies lues) ; OU
 *   (c) une ligne `email_oppositions` existe pour l'`emailKey` d'un contact de ce convRef (effacement compris).
 * Le désabonnement de la lettre ne compte pas.
 *
 * 🔴 FERMÉ : toute erreur de lecture ou de HMAC => 500, jamais de résultat partiel ni de `false` par défaut.
 * 🔴 AUCUNE ÉCRITURE. Journal : un événement avec le nombre de conversations, sans conv ni adresse.
 */
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { EntreeSignee } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";
import { LOT_MAX_OPPOSITIONS_PAR_CONV } from "./config";
import { MERCI_STATUTS_ECARTES_LUS } from "./merci-statut";
import { hmacConversationRef } from "./origines";

export const SchemaOppositionsParConv = z
  .object({
    schemaVersion: z.literal(1),
    convs: z
      .array(z.string().regex(/^c1_[A-Za-z0-9_-]{22}$/))
      .min(1)
      .max(LOT_MAX_OPPOSITIONS_PAR_CONV)
      .refine((l) => new Set(l).size === l.length, { message: "doublon" }),
  })
  .strict();

function champsFautifs(e: z.ZodError): string[] {
  const noms = new Set<string>();
  for (const i of e.issues) {
    if (i.code === "unrecognized_keys") i.keys.forEach((k) => noms.add(k));
    else noms.add(String(i.path[0] ?? "corps"));
  }
  return [...noms];
}

export async function repondreOppositionsParConv(e: EntreeSignee): Promise<Response> {
  let brut: unknown;
  try {
    brut = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return reponseJson(422, { ok: false, erreur: "json_invalide", champs: [] });
  }
  const analyse = SchemaOppositionsParConv.safeParse(brut);
  if (!analyse.success) {
    const inconnu = analyse.error.issues.some((i) => i.code === "unrecognized_keys");
    return reponseJson(422, {
      ok: false,
      erreur: inconnu ? "unknown_field" : "schema_invalide",
      champs: champsFautifs(analyse.error),
    });
  }
  const { convs } = analyse.data;

  try {
    const refs = convs.map((c) => hmacConversationRef(c));
    const [marques, contacts] = await Promise.all([
      prisma.oppositionConvRef.findMany({
        where: { convRef: { in: refs } },
        select: { convRef: true },
      }),
      prisma.contactGuideReseau.findMany({
        where: { convRef: { in: refs } },
        select: { convRef: true, emailKey: true, merciStatut: true },
      }),
    ]);
    const cles = [...new Set(contacts.map((c) => c.emailKey))];
    const adressesOpposees = await prisma.emailOpposition.findMany({
      where: { emailHash: { in: cles } },
      select: { emailHash: true },
    });

    const refsOpposees = new Set<string>(marques.map((m) => m.convRef));
    const ecartes: readonly string[] = MERCI_STATUTS_ECARTES_LUS;
    const clesOpposees = new Set<string>(adressesOpposees.map((o) => o.emailHash));
    for (const c of contacts) {
      if (ecartes.includes(c.merciStatut) || clesOpposees.has(c.emailKey)) {
        refsOpposees.add(c.convRef);
      }
    }
    const resultats = convs.map((conv, i) => ({ conv, opposee: refsOpposees.has(refs[i]!) }));
    console.warn(JSON.stringify({ event: "guides_reseau_oppositions_par_conv", n: convs.length }));
    return reponseJson(200, { ok: true, schemaVersion: 1, resultats });
  } catch (err) {
    try {
      Sentry.captureException(
        { name: err instanceof Error ? err.name : "erreur" },
        { tags: { area: "guides-reseau", action: "repondreOppositionsParConv" } },
      );
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error(
      "[guides-reseau] oppositions par conv en échec :",
      err instanceof Error ? err.name : "erreur",
    );
    return reponseJson(500, { ok: false, erreur: "erreur_interne" });
  }
}
