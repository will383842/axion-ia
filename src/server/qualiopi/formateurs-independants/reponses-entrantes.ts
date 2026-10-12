/**
 * CAMP-4 — les réponses par e-mail des FORMATEURS INDÉPENDANTS, rapprochées DANS le relevé
 * des candidatures (#1342, `reponses-entrantes-candidature.ts`) : même liste de messages,
 * même curseur — aucun troisième relevé, aucun second curseur.
 *
 * Un message dont l'expéditeur est l'adresse d'une fiche formateur OUVERTE (sans fin de
 * collaboration) devient une ligne `reponses_entrantes_formateurs` : la fiche et l'heure,
 * jamais l'objet ni le corps. Une réponse automatique est gardée, sans effet ; une réponse
 * humaine récente lève UNE alerte (`FORMATEUR_REPLIED`), à la création de la ligne seulement :
 * un message relu au passage suivant n'alerte plus (clé unique `zoho_message_id`).
 *
 * 🔴 Interrupteur `formateurs.reponses_formateurs` coupé : rien, pas une requête de plus que
 * la lecture de l'interrupteur.
 */

import {
  adresseExpediteur,
  estReponseAutomatique,
  type Entetes,
} from "@/lib/commercial-application/reponse-entrante";
import { prisma } from "@/lib/prisma";
import type { ClientZohoMail, MessageZoho } from "@/server/zoho-mail/client";

import { lireEtatsEntree } from "./etats-entree";

/** Une réponse plus ancienne n'alerte plus (même règle que le relevé des candidatures). */
export const RECENT_FORMATEUR_MS = 24 * 60 * 60 * 1000;

export interface BilanReponsesFormateurs {
  readonly rangees: number;
  readonly automatiques: number;
  readonly alertes: number;
  /** Écritures en échec : le relevé ne fait pas avancer son curseur. */
  readonly erreurs: number;
}

const VIDE: BilanReponsesFormateurs = { rangees: 0, automatiques: 0, alertes: 0, erreurs: 0 };

async function alerter(trainerId: string, recuLe: Date): Promise<boolean> {
  try {
    const { notify } = await import("@/server/notifications");
    await notify({
      category: "FORMATEUR_REPLIED",
      payload: { trainerId, receivedAt: recuLe.toISOString() },
    });
    return true;
  } catch {
    return false;
  }
}

export async function rapprocherReponsesFormateurs(
  messages: readonly MessageZoho[],
  client: Pick<ClientZohoMail, "lireEntetes">,
  maintenant: Date,
  deps: { allume?: () => Promise<boolean> } = {},
): Promise<BilanReponsesFormateurs> {
  if (messages.length === 0) return VIDE;
  const allume = deps.allume ?? (async () => (await lireEtatsEntree()).reponses_formateurs);
  if (!(await allume())) return VIDE;

  const parAdresse = new Map<string, MessageZoho[]>();
  for (const m of messages) {
    const a = adresseExpediteur(m.fromAddress)?.toLowerCase();
    if (!a) continue;
    parAdresse.set(a, [...(parAdresse.get(a) ?? []), m]);
  }
  if (parAdresse.size === 0) return VIDE;

  let fiches: Array<{ id: string; email: string }>;
  let connus: Set<string>;
  try {
    fiches = await prisma.trainer.findMany({
      // `email` est citext : l'égalité ignore la casse.
      where: { email: { in: [...parAdresse.keys()] }, finCollaborationAt: null },
      select: { id: true, email: true },
    });
    if (fiches.length === 0) return VIDE;
    const deja = await prisma.reponseEntranteFormateur.findMany({
      where: { zohoMessageId: { in: messages.map((m) => m.messageId) } },
      select: { zohoMessageId: true },
    });
    connus = new Set(deja.map((d) => d.zohoMessageId).filter((x): x is string => x !== null));
  } catch {
    return { ...VIDE, erreurs: 1 };
  }

  let rangees = 0;
  let automatiques = 0;
  let alertes = 0;
  let erreurs = 0;
  for (const fiche of fiches) {
    const adresse = fiche.email.toLowerCase();
    for (const m of parAdresse.get(adresse) ?? []) {
      if (connus.has(m.messageId)) continue;
      let entetes: Entetes | null = null;
      try {
        entetes = await client.lireEntetes(m.folderId, m.messageId);
      } catch {
        entetes = null; // l'objet seul décidera
      }
      const auto = estReponseAutomatique({ entetes, objet: m.subject });
      try {
        await prisma.reponseEntranteFormateur.create({
          data: {
            trainerId: fiche.id,
            source: "zoho",
            recuLe: m.receivedAt,
            zohoMessageId: m.messageId,
            auto,
          },
          select: { id: true },
        });
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code === "P2002") continue; // déjà rangée
        erreurs += 1;
        continue;
      }
      connus.add(m.messageId);
      if (auto) {
        automatiques += 1;
        continue;
      }
      rangees += 1;
      if (maintenant.getTime() - m.receivedAt.getTime() < RECENT_FORMATEUR_MS) {
        if (await alerter(fiche.id, m.receivedAt)) alertes += 1;
      }
    }
  }
  return { rangees, automatiques, alertes, erreurs };
}
