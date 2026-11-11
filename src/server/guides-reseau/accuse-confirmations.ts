/**
 * ACCUSÉ DES « MERCI » — lot S4b. Le Studio dit ce qu'il est advenu de chaque « merci » réservé
 * (`POST /api/interne/confirmations-page-guide/issue`). SANS accusé, un merci déjà envoyé serait repris
 * par la reprise des réservations (10 min) et repartirait pendant 48 h.
 *
 * Règles (UPDATE conditionnels, jamais de DELETE) :
 *   · `envoye` / `hors_fenetre` : `reserve` → statut demandé. Un accusé tardif, arrivé après une reprise
 *     (ligne revenue à `a_envoyer`), est aussi accepté : le merci est parti, il ne doit pas repartir.
 *   · `echec` : `reserve` → `a_envoyer` si la ligne est encore dans la fenêtre de 48 h, sinon `expire`,
 *     MAIS seulement si la réservation date de plus de `DELAI_REPRISE_RESERVATION_MIN` minutes. L'accusé ne
 *     porte pas d'identité de réservation : un `echec` retardé de la réservation R1 ne doit pas annuler la
 *     réservation R2 toute récente (deux « merci » partiraient). Une réservation plus vieille est de toute
 *     façon reprise par `reserverConfirmations` : l'`echec` n'avance que le moment de la reprise.
 *   · une ligne `envoye` (ou `hors_fenetre`, `expire`, `ecarte`…) ne change plus jamais : rejeu sans effet ;
 *   · une `ref` inconnue est ignorée sans erreur (aucune distinction visible : pas d'oracle d'existence).
 * Ni adresse, ni `ref`, ni référence de conversation dans la réponse ni dans le journal.
 */
import { Prisma } from "../../../prisma/generated/client";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { EntreeSignee } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";
import { FENETRE_MERCI_H, LOT_MAX_CONFIRMATIONS } from "./config";
import { DELAI_REPRISE_RESERVATION_MIN } from "./confirmations";
import {
  MERCI_STATUT_A_ENVOYER,
  MERCI_STATUT_ENVOYE,
  MERCI_STATUT_EXPIRE,
  MERCI_STATUT_HORS_FENETRE,
  MERCI_STATUT_RESERVE,
} from "./merci-statut";

export const SchemaAccuse = z
  .object({
    schemaVersion: z.literal(1),
    issues: z
      .array(
        z
          .object({
            ref: z.string().min(1).max(128),
            issue: z.enum(["envoye", "hors_fenetre", "echec"]),
          })
          .strict(),
      )
      .min(1)
      .max(LOT_MAX_CONFIRMATIONS),
  })
  .strict();

export type IssueAccusee = z.infer<typeof SchemaAccuse>["issues"][number];

export async function accuserConfirmations(
  issues: readonly IssueAccusee[],
  maintenant: Date,
): Promise<void> {
  const debut = new Date(maintenant.getTime() - FENETRE_MERCI_H * 3_600_000);
  const seuilReprise = new Date(maintenant.getTime() - DELAI_REPRISE_RESERVATION_MIN * 60_000);
  await prisma.$transaction(async (tx) => {
    for (const { ref, issue } of issues) {
      if (issue === "echec") {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "contacts_guide_reseau"
             SET "merci_statut" = ${MERCI_STATUT_A_ENVOYER}, "updated_at" = ${maintenant}
           WHERE "jeton_empreinte" = ${ref}
             AND "merci_statut" = ${MERCI_STATUT_RESERVE}
             AND "consenti_le" >= ${debut}
             AND "updated_at" < ${seuilReprise}
        `);
        await tx.$executeRaw(Prisma.sql`
          UPDATE "contacts_guide_reseau"
             SET "merci_statut" = ${MERCI_STATUT_EXPIRE}, "updated_at" = ${maintenant}
           WHERE "jeton_empreinte" = ${ref}
             AND "merci_statut" = ${MERCI_STATUT_RESERVE}
             AND "consenti_le" < ${debut}
             AND "updated_at" < ${seuilReprise}
        `);
      } else {
        const statut = issue === "envoye" ? MERCI_STATUT_ENVOYE : MERCI_STATUT_HORS_FENETRE;
        await tx.$executeRaw(Prisma.sql`
          UPDATE "contacts_guide_reseau"
             SET "merci_statut" = ${statut}, "updated_at" = ${maintenant}
           WHERE "jeton_empreinte" = ${ref}
             AND "merci_statut" IN (${MERCI_STATUT_RESERVE}, ${MERCI_STATUT_A_ENVOYER})
        `);
      }
    }
  });
}

/** NOMS des champs fautifs seulement — jamais une valeur. */
function champsFautifs(e: z.ZodError): string[] {
  const noms = new Set<string>();
  for (const i of e.issues) {
    if (i.code === "unrecognized_keys") i.keys.forEach((k) => noms.add(k));
    else noms.add(String(i.path[0] ?? "corps"));
  }
  return [...noms];
}

export async function recevoirAccuseConfirmations(e: EntreeSignee): Promise<Response> {
  let brut: unknown;
  try {
    brut = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return reponseJson(400, { ok: false, erreur: "json_invalide", champs: [] });
  }
  const analyse = SchemaAccuse.safeParse(brut);
  if (!analyse.success) {
    return reponseJson(400, {
      ok: false,
      erreur: "schema_invalide",
      champs: champsFautifs(analyse.error),
    });
  }
  try {
    await accuserConfirmations(analyse.data.issues, new Date());
  } catch (err) {
    try {
      Sentry.captureException(
        { name: err instanceof Error ? err.name : "erreur" },
        { tags: { area: "guides-reseau", action: "accuserConfirmations" } },
      );
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error("[guides-reseau] accusé en échec :", err instanceof Error ? err.name : "erreur");
    return reponseJson(500, { ok: false, erreur: "erreur_interne" });
  }
  const recus = analyse.data.issues.length;
  console.warn(JSON.stringify({ event: "guides_reseau_accuse_confirmations", recus }));
  return reponseJson(200, { ok: true, schemaVersion: 1, recus });
}
