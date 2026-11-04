/**
 * E-mail INTERNE « devis signé par le client » (plan devis complet, quick win b).
 *
 * Quand le client signe son devis par lien, Telegram prévenait déjà ; l'e-mail
 * double ce canal d'une trace qui se range : numéro du devis et lien vers sa
 * fiche dans la console. Destinataire : l'adresse interne de l'organisme
 * (`destinataireAlertesInternes`), JAMAIS le client.
 *
 * ⛔ Aucune donnée personnelle dans le message : ni nom, ni adresse du client.
 *
 * Classé AUTOMATIQUE (`outbox-policy.ts`) et enfilé SANS `clientId` : une règle
 * « validation » posée pour un client ne doit pas garer une notification interne.
 *
 * FAIL-SOFT : ne lève jamais. La signature est déjà scellée quand on arrive ici ;
 * une panne de file part chez Sentry et ne fait rien croire au signataire.
 * Une pièce d'ESSAI n'envoie rien (même coupure que Telegram), le refus est journalisé.
 */

import * as Sentry from "@sentry/nextjs";
import { adminPath } from "@/lib/admin-path";
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import { enqueueEmail } from "@/server/queue/queues";
import { sortieSaufEssai } from "@/server/qualiopi/essai/sorties";

export interface FicheDevis {
  readonly id: string;
  readonly numero: string;
}

/** Le devis porté par la pièce signable. `null` si absent ou lecture en panne. */
export async function ficheDevisDePiece(documentGenereId: string): Promise<FicheDevis | null> {
  try {
    return await prisma.devis.findFirst({
      where: { documentGenereId },
      select: { id: true, numero: true },
    });
  } catch {
    return null;
  }
}

export interface DemandeNotificationDevis {
  readonly documentGenereId: string;
  /** Numéro de la pièce (repli si le devis est introuvable). */
  readonly numeroPiece: string;
  /** `a_contresigner` : reste la contresignature ; `complete` : signé des deux parties. */
  readonly etape: "a_contresigner" | "complete";
  readonly essai: boolean;
}

export async function prevenirDevisSigne(demande: DemandeNotificationDevis): Promise<void> {
  try {
    await sortieSaufEssai(
      demande.essai,
      {
        canal: "email",
        cibleType: "DocumentGenere",
        cibleId: demande.documentGenereId,
        objet: "devis-signe-a-contresigner",
      },
      async () => {
        const fiche = await ficheDevisDePiece(demande.documentGenereId);
        const payload: Record<string, unknown> = {
          numeroDevis: fiche?.numero ?? demande.numeroPiece,
          etape: demande.etape,
        };
        if (fiche !== null) {
          payload["consoleUrl"] =
            `${SITE_URL.replace(/\/+$/, "")}${adminPath("fr", `qualiopi/devis/${fiche.id}`)}`;
        }
        await enqueueEmail(
          "devis-signe-a-contresigner",
          destinataireAlertesInternes(),
          "fr",
          payload,
          {
            jobId: `devis-signe-a-contresigner-${demande.etape}-${demande.documentGenereId}`,
            entityType: "DocumentGenere",
            entityId: demande.documentGenereId,
            clientId: null,
          },
        );
      },
    );
  } catch (e) {
    const nom = e instanceof Error ? e.name : "inconnue";
    Sentry.captureException(new Error(`devis signé : e-mail interne non enfilé (${nom})`), {
      tags: { action: "apresSignature:email-interne-devis" },
      extra: { documentGenereId: demande.documentGenereId, etape: demande.etape },
    });
  }
}
