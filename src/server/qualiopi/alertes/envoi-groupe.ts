/**
 * Lot 14 (T3b) — L'ENVOI GROUPÉ des alertes, par guichet.
 *
 * Remplace la boucle du cron `handleAlertes`, qui appelait
 * `notifierAlerteInterne` une fois par alerte, vers une adresse unique. À
 * 400 alertes ouvertes, c'était 400 e-mails à la même boîte.
 *
 * ## Ce que cette fonction garantit, et comment
 *
 * - **un destinataire par guichet** (`resoudreDestinataires`) ;
 * - **un message par (guichet, code)** (`regrouperAlertes`) ;
 * - **aucune alerte notifiée deux fois** : le `claim` pose `notifiedAt` sur
 *   TOUT le lot en une requête, et ne retient que les lignes qu'il a
 *   réellement claimées. Deux instances concurrentes se partagent le lot au
 *   lieu de l'envoyer chacune.
 *
 * 🔴 Le claim est posé AVANT l'enqueue, et relâché si l'enqueue échoue — même
 * contrat que `notifierAlerteInterne`, pour la même raison : marquer
 * « notifiée » une alerte dont l'e-mail n'est jamais parti est la pire des deux
 * erreurs. Un doublon se voit ; un silence, non.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import {
  LIBELLE_GUICHET,
  cleIdempotenceLot,
  regrouperAlertes,
  type AlerteARouter,
} from "./routage";
import { resoudreDestinataires } from "./destinataires";

/**
 * Les codes notifiés en plus des `critique` — déblocages du parcours vente.
 * Inchangé depuis le cron : l'étape suivante attend une action admin, et
 * l'e-mail évite de camper l'écran d'alertes.
 */
export const CODES_DEBLOCAGE = ["devis_signe_convention", "moteur_assemble_a_publier"] as const;

export interface ResultatEnvoiGroupe {
  /** Nombre de MESSAGES partis (pas d'alertes). */
  readonly messages: number;
  /** Nombre d'alertes couvertes par ces messages. */
  readonly alertes: number;
  /** Alertes dont le code est absent du catalogue — jamais tues. */
  readonly sansGuichet: number;
  /** Guichets servis par repli, avec leur motif. */
  readonly replis: ReadonlyArray<string>;
}

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Clé de jour (YYYYMMDD) — l'idempotence d'un résumé est quotidienne. */
function jourDe(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function notifierAlertesGroupees(
  maintenant: Date = new Date(),
): Promise<ResultatEnvoiGroupe> {
  const vide: ResultatEnvoiGroupe = { messages: 0, alertes: 0, sansGuichet: 0, replis: [] };
  if (isStub()) return vide;

  const candidates = await prisma.alerteSysteme.findMany({
    where: {
      resolue: false,
      notifiedAt: null,
      OR: [{ niveau: "critique" }, { code: { in: [...CODES_DEBLOCAGE] } }],
    },
    select: {
      id: true,
      code: true,
      niveau: true,
      titre: true,
      message: true,
      cibleType: true,
      cibleId: true,
      createdAt: true,
    },
  });
  if (candidates.length === 0) return vide;

  const parId = new Map(candidates.map((a) => [a.id, a]));
  const { lots, sansGuichet } = regrouperAlertes(candidates as ReadonlyArray<AlerteARouter>);

  if (sansGuichet.length > 0) {
    // 🔴 Bruyant, jamais silencieux : un code hors catalogue n'a ni guichet ni
    // résolution automatique. Le taire à l'envoi referait, dans l'autre sens,
    // le défaut du 2026-08-05.
    console.error(
      `[alertes-envoi-groupe] ${sansGuichet.length} alerte(s) dont le code est absent du catalogue, ` +
        `donc sans destinataire : ${[...new Set(sansGuichet.map((a) => a.code))].join(", ")}`,
    );
  }

  const destinataires = await resoudreDestinataires();
  const jour = jourDe(maintenant);
  const replis = new Set<string>();
  let messages = 0;
  let alertes = 0;

  for (const lot of lots) {
    const cible = destinataires.get(lot.guichet);
    if (!cible || cible.adresses.length === 0) {
      // Ne peut pas arriver (`resoudreDestinataires` ne rend jamais de liste
      // vide) — mais on ne suppose pas : sans adresse, on n'efface surtout pas
      // le `notifiedAt`, l'alerte reste candidate au prochain tour.
      console.error(`[alertes-envoi-groupe] guichet « ${lot.guichet} » sans adresse — lot ignoré`);
      continue;
    }
    if (cible.repli != null) replis.add(`${lot.guichet} : ${cible.repli}`);

    const ids = lot.alertes.map((a) => a.id);

    // Claim atomique du LOT. `updateMany` ne touche que les lignes encore
    // `notifiedAt: null` ; on relit ensuite pour savoir lesquelles nous
    // appartiennent réellement — sans quoi deux instances enverraient chacune
    // le résumé complet.
    await prisma.alerteSysteme.updateMany({
      where: { id: { in: ids }, notifiedAt: null, resolue: false },
      data: { notifiedAt: maintenant },
    });
    const claimees = await prisma.alerteSysteme.findMany({
      where: { id: { in: ids }, notifiedAt: maintenant },
      select: { id: true },
    });
    if (claimees.length === 0) continue;

    const retenues = claimees.map((c) => parId.get(c.id)!).filter(Boolean);
    const lotClaime = { ...lot, alertes: retenues as ReadonlyArray<AlerteARouter> };

    const payload: Record<string, unknown> = {
      niveau: lot.niveau,
      code: lot.code,
      titre: lot.titre,
      guichet: LIBELLE_GUICHET[lot.guichet],
      occurrences: retenues.map((a) => ({
        message: a.message,
        ...(a.cibleType != null ? { cibleType: a.cibleType } : {}),
        ...(a.cibleId != null ? { cibleId: a.cibleId } : {}),
        createdAt: fmtDate(a.createdAt),
      })),
    };
    if (cible.repli != null) payload["repli"] = cible.repli;

    try {
      // Un envoi PAR ADRESSE : le `jobId` porte l'adresse, sinon la
      // déduplication BullMQ n'en servirait qu'une seule des trois.
      for (const adresse of cible.adresses) {
        await enqueueEmail("qualiopi-alerte-interne", adresse, "fr", payload, {
          jobId: `${cleIdempotenceLot(lotClaime, jour)}-${adresse}`,
          entityType: "AlerteSysteme",
          entityId: retenues[0]!.id,
        });
      }
      messages++;
      alertes += retenues.length;
    } catch (err) {
      // Relâche le claim : « notifiée » sans e-mail parti est le pire des deux
      // états. Le lot redevient candidat au prochain tour.
      await prisma.alerteSysteme.updateMany({
        where: { id: { in: retenues.map((a) => a.id) } },
        data: { notifiedAt: null },
      });
      console.error(
        `[alertes-envoi-groupe] échec d'envoi pour ${lot.guichet}/${lot.code} — claim relâché :`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { messages, alertes, sansGuichet: sansGuichet.length, replis: [...replis] };
}
