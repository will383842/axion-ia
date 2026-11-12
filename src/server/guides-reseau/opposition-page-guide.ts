/**
 * OPPOSITION REÇUE DU STUDIO APRÈS LA PAGE DU GUIDE (« stop » écrit par une personne qui avait le lien).
 *
 * Le corps porte la référence de conversation `conv` (celle du lien, `c1_` + 22 caractères) et JAMAIS d'adresse.
 * Le site retrouve les contacts de la page par `conv_ref` (HMAC de `conv`), puis :
 *   1. met l'ADRESSE de chaque contact à l'écart des envois (`enregistrerOppositionPourAdresse` : même chemin que
 *      `/oppositions-reseau`, CRM prévenu) — l'opposition l'emporte sur tout accord ;
 *   2. passe les contacts à `merci_statut = 'ecarte'`.
 *
 * 🔴 AUCUNE SUPPRESSION de donnée de personne. Jamais le chemin d'effacement.
 * Si l'opposition ou l'avertissement du CRM échoue : 500 et le contact N'EST PAS écarté (le Studio renverra, réessai
 * idempotent). Référence inconnue (la personne n'a pas encore validé la page) : MÊME réponse 200, et la MARQUE de la
 * référence est écrite quand même (`oppositions_conv_ref`, avant tout le reste) : si la page est validée ensuite,
 * elle suit le déroulé neutre des opposées et le guide ne part pas.
 * Accusé identique à `/oppositions-reseau`. Journal : un événement, sans adresse ni référence.
 */
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { RESEAUX_GUIDE } from "@/content/guides-reseau";
import { prisma } from "@/lib/prisma";
import { enregistrerOppositionPourAdresse } from "@/server/email/opposition";
import type { EntreeSignee } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";
import { ORIGINE_OPPOSITION_RESEAU_STOP } from "./config";
import { MERCI_STATUT_ECARTE, MERCI_STATUTS_ECARTES_LUS } from "./merci-statut";
import { marquerConvRefOpposee } from "./conv-ref-opposee";
import { hmacConversationRef } from "./origines";

export const SchemaOppositionPage = z
  .object({
    schemaVersion: z.literal(1),
    cleIdempotence: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    conv: z.string().regex(/^c1_[A-Za-z0-9_-]{22}$/),
    reseau: z.enum(RESEAUX_GUIDE),
    occurredAt: z.string().datetime().optional(),
  })
  .strict();

const REPONSE_OK = { ok: true, type: "opposition", recue: true } as const;

function champsFautifs(e: z.ZodError): string[] {
  const noms = new Set<string>();
  for (const i of e.issues) {
    if (i.code === "unrecognized_keys") i.keys.forEach((k) => noms.add(k));
    else noms.add(String(i.path[0] ?? "corps"));
  }
  return [...noms];
}

export async function recevoirOppositionPage(e: EntreeSignee): Promise<Response> {
  let brut: unknown;
  try {
    brut = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return reponseJson(422, { ok: false, erreur: "json_invalide", champs: [] });
  }
  const analyse = SchemaOppositionPage.safeParse(brut);
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
    const convRef = hmacConversationRef(d.conv);
    // La marque d'abord, TOUJOURS (référence connue ou non) : si la suite échoue, le STOP est déjà gardé.
    await marquerConvRefOpposee(convRef);
    // La marque d'une adresse opposée porte `conv_ref = '-'` : jamais ciblée (convRef est un HMAC de 64 caractères).
    const contacts = await prisma.contactGuideReseau.findMany({
      where: { convRef },
      select: { id: true, emailKey: true, guideRequest: { select: { email: true } } },
    });
    const adresses = new Set<string>();
    for (const c of contacts) if (c.guideRequest?.email) adresses.add(c.guideRequest.email);
    // L'opposition d'abord, pour chaque adresse : écartée ET CRM prévenu, sinon 500 (le contact reste intact).
    for (const adresse of adresses) {
      const r = await enregistrerOppositionPourAdresse(adresse, {
        origine: ORIGINE_OPPOSITION_RESEAU_STOP,
      });
      if (!r.ok || !r.crmAverti) return reponseJson(500, { ok: false, erreur: "erreur_interne" });
    }
    if (contacts.length > 0) {
      // Mise à l'écart seulement ; les lignes déjà écartées (deux graphies) ne sont pas réécrites.
      await prisma.contactGuideReseau.updateMany({
        where: { convRef, merciStatut: { notIn: [...MERCI_STATUTS_ECARTES_LUS] } },
        data: { merciStatut: MERCI_STATUT_ECARTE },
      });
    }
  } catch (err) {
    try {
      Sentry.captureException(
        { name: err instanceof Error ? err.name : "erreur" },
        { tags: { area: "guides-reseau", action: "recevoirOppositionPage" } },
      );
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error(
      "[guides-reseau] opposition (page) en échec :",
      err instanceof Error ? err.name : "erreur",
    );
    return reponseJson(500, { ok: false, erreur: "erreur_interne" });
  }

  console.warn(
    JSON.stringify({ event: "guides_reseau_opposition_page", reseau: d.reseau, motif: "stop" }),
  );
  return reponseJson(200, REPONSE_OK);
}
