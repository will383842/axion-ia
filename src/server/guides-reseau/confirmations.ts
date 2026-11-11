/**
 * CONFIRMATIONS DE LA PAGE « RECEVOIR LE GUIDE » — lot S4a : LECTURE-RÉSERVATION.
 *
 * Le Studio demande la liste des « merci » à envoyer : les contacts dont la personne a validé la page
 * (`page-confirmation.ts` pose `merci_statut = 'a_envoyer'`). Le merci part dès la validation de la
 * page (pas au clic du lien) : la fenêtre de messagerie du réseau est courte.
 *
 * `reserverConfirmations` fait, en UNE transaction :
 *   0. REPRISE : une ligne `reserve` dont la réservation (`updated_at`) date de plus de
 *      `DELAI_REPRISE_RESERVATION_MIN` minutes (réponse perdue côté Studio) repasse à `a_envoyer`
 *      si elle est encore dans la fenêtre de `FENETRE_MERCI_H` heures, sinon à `expire`.
 *      Jamais de suppression ; une ligne `envoye` ne bouge jamais ;
 *   1. passer à `expire` les lignes `a_envoyer` de plus de `FENETRE_MERCI_H` heures (elles restent en base) ;
 *   2. réserver atomiquement (`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED LIMIT n) RETURNING`) :
 *      deux appels simultanés ne reçoivent jamais la même ligne, un second appel reçoit une liste vide ;
 *   3. ne renvoyer que `{ ref, valideLe }`.
 *
 * Exclus de la réservation (la ligne n'est jamais supprimée ni réservée ; elle peut passer à
 *   `expire` après 48 h) :
 *   · la marque d'une adresse opposée (`email_key = '-'`) et les statuts `ecarte` / `ecartee`
 *     (seul `a_envoyer` est réservable) ;
 *   · toute adresse présente dans `email_oppositions` : `email_hash = email_key`. C'est la MÊME
 *     fonction des deux côtés (`hashEmailForLookup`, après `trim` + minuscules) : la page écrit
 *     `email_key = hashEmailForLookup(email)`, l'opposition écrit
 *     `email_hash = hashEmailForLookup(adresse)`.
 *
 * 🔴 AUCUN DELETE. Ni adresse, ni `email_key`, ni `conv_ref`, ni prénom ne sortent : `ref` est
 * l'empreinte SHA-256 du jeton du lien (`jeton_empreinte`), `valideLe` la date de validation.
 * Un seul journal, sans donnée de personne.
 *
 * ENGAGEMENT DU STUDIO (STU-Z4) : l'opposition n'est contrôlée qu'à la réservation. Le Studio DOIT
 * revérifier l'opposition juste avant l'envoi du « merci ».
 */
import { Prisma } from "../../../prisma/generated/client";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { EntreeSignee } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";
import { FENETRE_MERCI_H, LOT_MAX_CONFIRMATIONS } from "./config";
import { MERCI_STATUT_A_ENVOYER, MERCI_STATUT_EXPIRE, MERCI_STATUT_RESERVE } from "./merci-statut";

/** Une réservation plus vieille que ceci (réponse perdue côté Studio) est reprise. */
export const DELAI_REPRISE_RESERVATION_MIN = 10;

export interface ConfirmationReservee {
  /** Empreinte SHA-256 du jeton du lien (`jeton_empreinte`) : opaque, sans lien lisible avec la personne. */
  readonly ref: string;
  /** Date de validation de la page (ISO 8601). */
  readonly valideLe: string;
}

export const SchemaConfirmations = z
  .object({
    schemaVersion: z.literal(1),
    limite: z.number().int().min(1).max(LOT_MAX_CONFIRMATIONS).optional(),
  })
  .strict();

interface LigneReservee {
  jeton_empreinte: string;
  consenti_le: Date;
}

export async function reserverConfirmations(
  maintenant: Date,
  limite: number = LOT_MAX_CONFIRMATIONS,
): Promise<ConfirmationReservee[]> {
  const n = Math.min(Math.max(Math.trunc(limite), 1), LOT_MAX_CONFIRMATIONS);
  const debutFenetre = new Date(maintenant.getTime() - FENETRE_MERCI_H * 3_600_000);

  const seuilReprise = new Date(maintenant.getTime() - DELAI_REPRISE_RESERVATION_MIN * 60_000);

  const lignes = await prisma.$transaction(async (tx) => {
    // 0. Reprise des réservations perdues (jamais de DELETE ; `envoye` n'est pas visé).
    await tx.$executeRaw(Prisma.sql`
      UPDATE "contacts_guide_reseau"
         SET "merci_statut" = CASE WHEN "consenti_le" >= ${debutFenetre}
                                   THEN ${MERCI_STATUT_A_ENVOYER} ELSE ${MERCI_STATUT_EXPIRE} END,
             "updated_at" = ${maintenant}
       WHERE "merci_statut" = ${MERCI_STATUT_RESERVE}
         AND "updated_at" < ${seuilReprise}
    `);
    // 1. Hors fenêtre : la ligne passe à `expire` (jamais supprimée, jamais proposée).
    await tx.$executeRaw(Prisma.sql`
      UPDATE "contacts_guide_reseau"
         SET "merci_statut" = ${MERCI_STATUT_EXPIRE}, "updated_at" = ${maintenant}
       WHERE "merci_statut" = ${MERCI_STATUT_A_ENVOYER}
         AND "consenti_le" < ${debutFenetre}
    `);
    // 2. Réservation atomique. Seul `a_envoyer` est réservable : `ecarte`, `ecartee`, `reserve`,
    //    `envoye`… sont exclus par construction. `email_key <> '-'` écarte la marque d'opposition.
    return tx.$queryRaw<LigneReservee[]>(Prisma.sql`
      UPDATE "contacts_guide_reseau"
         SET "merci_statut" = ${MERCI_STATUT_RESERVE}, "updated_at" = ${maintenant}
       WHERE "id" IN (
         SELECT c."id"
           FROM "contacts_guide_reseau" c
          WHERE c."merci_statut" = ${MERCI_STATUT_A_ENVOYER}
            AND c."email_key" <> '-'
            AND c."consenti_le" >= ${debutFenetre}
            AND NOT EXISTS (
              SELECT 1 FROM "email_oppositions" o WHERE o."email_hash" = c."email_key"
            )
          ORDER BY c."consenti_le" ASC, c."id" ASC
          LIMIT ${n}
          FOR UPDATE OF c SKIP LOCKED
       )
       AND "merci_statut" = ${MERCI_STATUT_A_ENVOYER}
      RETURNING "jeton_empreinte", "consenti_le"
    `);
  });

  return lignes
    .map((l) => ({ ref: l.jeton_empreinte, valideLe: new Date(l.consenti_le).toISOString() }))
    .sort((a, b) => (a.valideLe < b.valideLe ? -1 : a.valideLe > b.valideLe ? 1 : 0));
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

export async function recevoirDemandeConfirmations(e: EntreeSignee): Promise<Response> {
  let brut: unknown;
  try {
    brut = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return reponseJson(400, { ok: false, erreur: "json_invalide", champs: [] });
  }
  const analyse = SchemaConfirmations.safeParse(brut);
  if (!analyse.success) {
    return reponseJson(400, {
      ok: false,
      erreur: "schema_invalide",
      champs: champsFautifs(analyse.error),
    });
  }

  let confirmations: ConfirmationReservee[];
  try {
    confirmations = await reserverConfirmations(new Date(), analyse.data.limite);
  } catch (err) {
    try {
      Sentry.captureException(
        { name: err instanceof Error ? err.name : "erreur" },
        { tags: { area: "guides-reseau", action: "reserverConfirmations" } },
      );
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error(
      "[guides-reseau] confirmations en échec :",
      err instanceof Error ? err.name : "erreur",
    );
    return reponseJson(500, { ok: false, erreur: "erreur_interne" });
  }

  console.warn(
    JSON.stringify({ event: "guides_reseau_confirmations", reservees: confirmations.length }),
  );
  return reponseJson(200, { ok: true, schemaVersion: 1, confirmations });
}
