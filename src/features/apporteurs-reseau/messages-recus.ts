// Messages REÇUS d'un apporteur, tracés sur sa fiche (2026-11-27).
//
// Deux sources, une seule table (`apporteur_messages_recus`) :
//   · `email`        — un e-mail relevé dans la boîte Zoho dont l'expéditeur a l'adresse d'une
//                      fiche apporteur, QUEL QUE SOIT l'état du dossier (le relevé des réponses à
//                      l'invitation, `reponses-entrantes-apporteur.ts`, l'appelle à chaque passage) ;
//   · `demande_aide` — une demande envoyée depuis l'espace de l'apporteur (`demande-aide.ts`).
//
// Idempotent par identifiant de message Zoho (index unique). Table absente (fenêtre app/worker) :
// le relevé le sait (`tableAbsente`) et ne fait pas avancer son curseur.

import { prisma } from "@/lib/prisma";
import { decryptPii, encryptPii, PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  adresseExpediteur,
  estReponseAutomatique,
  estTableAbsente,
  extraitCourt,
  objetEnregistre,
  type Entetes,
} from "@/lib/commercial-application/reponse-entrante";
import type { ClientZohoMail, MessageZoho } from "@/server/zoho-mail/client";

export const SOURCE_EMAIL = "email";
export const SOURCE_DEMANDE_AIDE = "demande_aide";
/** Nombre de messages montrés sur la fiche. */
export const MESSAGES_MAX = 50;

export interface CompteRenduMessagesApporteurs {
  readonly enregistres: number;
  readonly dejaConnus: number;
  readonly erreurs: number;
  readonly tableAbsente: boolean;
}

/**
 * Enregistre, pour chaque message dont l'expéditeur est un apporteur connu (adresse comparée par
 * empreinte, donc insensible à la casse), une ligne rattachée à sa fiche. Adresse inconnue : ignoré.
 * Ne lève jamais : une panne est comptée dans `erreurs`.
 */
export async function enregistrerMessagesApporteurs(
  messages: readonly MessageZoho[],
  client: Pick<ClientZohoMail, "lireEntetes">,
): Promise<CompteRenduMessagesApporteurs> {
  const compte = { enregistres: 0, dejaConnus: 0, erreurs: 0, tableAbsente: false };
  const parEmpreinte = new Map<string, MessageZoho[]>();
  for (const m of messages) {
    const adresse = adresseExpediteur(m.fromAddress);
    const empreinte = adresse ? hashEmailForLookup(adresse) : null;
    if (!empreinte) continue;
    parEmpreinte.set(empreinte, [...(parEmpreinte.get(empreinte) ?? []), m]);
  }
  if (parEmpreinte.size === 0) return compte;

  try {
    const apporteurs = await prisma.apporteurReseau.findMany({
      where: { emailHash: { in: [...parEmpreinte.keys()] } },
      select: { id: true, emailHash: true },
    });
    if (apporteurs.length === 0) return compte;
    const idParEmpreinte = new Map(apporteurs.map((a) => [a.emailHash, a.id]));
    const aTraiter = [...parEmpreinte].flatMap(([empreinte, liste]) =>
      idParEmpreinte.has(empreinte)
        ? liste.map((message) => ({ message, empreinte, apporteurId: idParEmpreinte.get(empreinte)! }))
        : [],
    );
    const deja = await prisma.apporteurMessageRecu.findMany({
      where: { zohoMessageId: { in: aTraiter.map((x) => x.message.messageId) } },
      select: { zohoMessageId: true },
    });
    const connus = new Set(deja.map((d) => d.zohoMessageId));

    for (const { message: m, empreinte, apporteurId } of aTraiter) {
      if (connus.has(m.messageId)) {
        compte.dejaConnus += 1;
        continue;
      }
      let entetes: Entetes | null = null;
      try {
        entetes = await client.lireEntetes(m.folderId, m.messageId);
      } catch {
        entetes = null; // l'objet seul décidera
      }
      const objet = objetEnregistre(m.subject);
      const extrait = extraitCourt(m.summary);
      try {
        await prisma.apporteurMessageRecu.create({
          data: {
            apporteurId,
            source: SOURCE_EMAIL,
            receivedAt: m.receivedAt,
            fromEmailHash: empreinte,
            subject: objet,
            excerpt: extrait ? encryptPii(extrait) : null,
            zohoMessageId: m.messageId,
            zohoFolderId: m.folderId || null,
            internetMessageId: entetes?.["message-id"]?.[0]?.trim().slice(0, 500) || null,
            auto: estReponseAutomatique({ entetes, objet }),
          },
        });
        compte.enregistres += 1;
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code === "P2002") {
          compte.dejaConnus += 1; // un autre passage l'a écrit entre-temps
          continue;
        }
        if (estTableAbsente(e)) throw e;
        compte.erreurs += 1;
        console.error(
          `[messages-apporteurs] message ${m.messageId} non enregistré :`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  } catch (e) {
    if (estTableAbsente(e)) {
      console.warn(
        "[messages-apporteurs] table absente (migration pas encore jouée par l'app) : passage reporté.",
      );
      return { ...compte, tableAbsente: true };
    }
    compte.erreurs += 1;
    console.error(
      "[messages-apporteurs] relevé impossible :",
      e instanceof Error ? e.message : String(e),
    );
  }
  return compte;
}

/**
 * Enregistre une demande d'aide de l'espace apporteur. `message` doit être DÉJÀ assaini (sans IBAN).
 * Ne lève jamais (la demande a déjà été transmise à l'équipe) : rend `false` en cas d'échec.
 */
export async function enregistrerDemandeAide(args: {
  apporteurId: string;
  sujet: string;
  message: string;
  maintenant?: Date;
}): Promise<boolean> {
  try {
    await prisma.apporteurMessageRecu.create({
      data: {
        apporteurId: args.apporteurId,
        source: SOURCE_DEMANDE_AIDE,
        receivedAt: args.maintenant ?? new Date(),
        subject: objetEnregistre(`Demande d'aide : ${args.sujet}`),
        excerpt: args.message ? encryptPii(args.message) : null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export interface MessageRecuApporteur {
  readonly id: string;
  readonly source: "email" | "demande_aide";
  readonly recuLe: Date;
  readonly objet: string;
  /** Extrait déchiffré ; `null` s'il n'y en a pas ou s'il est illisible. */
  readonly extrait: string | null;
  readonly automatique: boolean;
}

/** Les plus récents d'abord, `MESSAGES_MAX` au plus. Table absente : liste vide. */
export async function lireMessagesRecus(apporteurId: string): Promise<MessageRecuApporteur[]> {
  let lignes;
  try {
    lignes = await prisma.apporteurMessageRecu.findMany({
      where: { apporteurId },
      orderBy: { receivedAt: "desc" },
      take: MESSAGES_MAX,
      select: { id: true, source: true, receivedAt: true, subject: true, excerpt: true, auto: true },
    });
  } catch (e) {
    if (estTableAbsente(e)) return [];
    throw e;
  }
  return lignes.map((l) => {
    let extrait: string | null = null;
    try {
      extrait = l.excerpt ? decryptPii(l.excerpt) : null;
      if (extrait === PII_DECRYPT_PLACEHOLDER) extrait = null;
    } catch {
      extrait = null;
    }
    return {
      id: l.id,
      source: l.source === SOURCE_DEMANDE_AIDE ? SOURCE_DEMANDE_AIDE : SOURCE_EMAIL,
      recuLe: l.receivedAt,
      objet: l.subject,
      extrait,
      automatique: l.auto,
    };
  });
}
