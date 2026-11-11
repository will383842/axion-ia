/**
 * OPPOSITION REÇUE DU STUDIO (« stop » écrit en message privé d'un réseau).
 *
 * 🔴 AUCUNE SUPPRESSION. Ce chemin met l'adresse À L'ÉCART des envois et rien d'autre
 * (`enregistrerOppositionPourAdresse` : empreinte, CRM, envois programmés retirés).
 * Il ne touche jamais au chemin d'effacement.
 *
 * Idempotence : une ligne par empreinte ; un second appel annule les envois programmés et réessaie
 * l'avertissement du CRM seulement s'il est resté en attente et que la personne n'a pas été effacée.
 * La clé d'idempotence n'est ni stockée ni journalisée.
 *
 * Le nonce est contrôlé en forme, pas mémorisé : un rejeu dans la fenêtre de 300 s reproduit la même opposition, sans nouvel effet ; décision du 07/11/2026.
 *
 * Réponse IDENTIQUE adresse nouvelle, déjà écartée ou inconnue ; jamais l'adresse.
 * Journal : un seul événement structuré, sans aucune donnée de personne.
 */
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { RESEAUX_GUIDE } from "@/content/guides-reseau";
import { enregistrerOppositionPourAdresse } from "@/server/email/opposition";
import type { EntreeSignee } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";
import { ORIGINE_OPPOSITION_RESEAU_STOP } from "./config";
import { mettreContactsAEcart } from "./mise-a-l-ecart";

export const SchemaOppositionReseau = z
  .object({
    schemaVersion: z.literal(1),
    cleIdempotence: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    email: z
      .string()
      .trim()
      .max(254)
      .email()
      .transform((e) => e.toLowerCase()),
    motif: z.literal("stop"),
    reseau: z.enum(RESEAUX_GUIDE),
    occurredAt: z.string().datetime().optional(),
  })
  .strict();

export type OppositionReseau = z.infer<typeof SchemaOppositionReseau>;

const REPONSE_OK = { ok: true, type: "opposition", recue: true } as const;

/** NOMS des champs fautifs seulement — jamais une valeur. */
function champsFautifs(e: z.ZodError): string[] {
  const noms = new Set<string>();
  for (const i of e.issues) {
    if (i.code === "unrecognized_keys") i.keys.forEach((k) => noms.add(k));
    else noms.add(String(i.path[0] ?? "corps"));
  }
  return [...noms];
}

export async function recevoirOpposition(e: EntreeSignee): Promise<Response> {
  let brut: unknown;
  try {
    brut = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return reponseJson(422, { ok: false, erreur: "json_invalide", champs: [] });
  }
  const analyse = SchemaOppositionReseau.safeParse(brut);
  if (!analyse.success) {
    const inconnu = analyse.error.issues.some((i) => i.code === "unrecognized_keys");
    return reponseJson(422, {
      ok: false,
      erreur: inconnu ? "unknown_field" : "schema_invalide",
      champs: champsFautifs(analyse.error),
    });
  }
  const d = analyse.data;

  try {
    const r = await enregistrerOppositionPourAdresse(d.email, {
      origine: ORIGINE_OPPOSITION_RESEAU_STOP,
    });
    // Écartée ET CRM prévenu, sinon 500 : le Studio renverra le stop (réessai idempotent).
    if (!r.ok || !r.crmAverti) {
      return reponseJson(500, { ok: false, erreur: "erreur_interne" });
    }
    // Contacts de la page guide : `merci_statut` → « ecarte » (jamais supprimés ; rejeu sans effet).
    await mettreContactsAEcart(d.email);
  } catch (err) {
    try {
      Sentry.captureException(
        { name: err instanceof Error ? err.name : "erreur" },
        {
          tags: { area: "guides-reseau", action: "recevoirOpposition" },
        },
      );
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error(
      "[guides-reseau] opposition en échec :",
      err instanceof Error ? err.name : "erreur",
    );
    return reponseJson(500, { ok: false, erreur: "erreur_interne" });
  }

  console.warn(
    JSON.stringify({ event: "guides_reseau_opposition", reseau: d.reseau, motif: "stop" }),
  );
  return reponseJson(200, REPONSE_OK);
}
