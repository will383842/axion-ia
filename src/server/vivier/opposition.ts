/**
 * OPPOSITION À LA CONSERVATION EN VIVIER — effet immédiat, sans justification.
 *
 * Appelée par la route publique `/api/vivier-opposition?token=…` : un clic
 * depuis l'email d'information, sans login. Trois effets, dans cet ordre :
 *   1. `vivierOpposedAt` est posé sur TOUTES les candidatures de la personne —
 *      s'opposer, c'est s'opposer pour de bon, pas pour une seule des trois
 *      offres auxquelles on a postulé ;
 *   2. une ligne `optout` est ajoutée au registre de preuve ;
 *   3. l'opposition est propagée au CRM (univers vivier) — SEULEMENT si une
 *      candidature de la personne y est déjà partie (voir `transmittedSubjectRef`).
 *
 * IDEMPOTENTE : re-cliquer le même lien ne casse rien et ne ré-émet rien.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { normalizeEmail } from "@/lib/security/email-hash";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { syncVivierOppositionToCrm } from "@/server/crm-sync";

export type VivierOppositionResult =
  | { ok: true; alreadyOpposed: boolean; applications: number }
  | { ok: false; reason: "unknown_application" | "internal" };

export async function recordVivierOpposition(
  applicationId: string,
  options: { ip?: string | null; userAgent?: string | null } = {},
): Promise<VivierOppositionResult> {
  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, email: true, consentVersion: true, vivierOpposedAt: true },
    });

    if (!application) return { ok: false, reason: "unknown_application" };

    const alreadyOpposed = application.vivierOpposedAt !== null;
    const email = safeDecrypt(application.email);
    const now = new Date();

    // Toutes les candidatures de la MÊME adresse, pas seulement celle du lien.
    // Sans cela, une personne ayant postulé trois fois devrait cliquer trois
    // liens pour un droit qui s'exerce en une fois.
    const siblings = email ? await applicationIdsForEmail(email) : [application.id];

    const updated = await prisma.jobApplication.updateMany({
      where: { id: { in: siblings }, vivierOpposedAt: null },
      data: { vivierOpposedAt: now },
    });

    if (alreadyOpposed && updated.count === 0) {
      return { ok: true, alreadyOpposed: true, applications: siblings.length };
    }

    if (email) {
      await recordConsentEvent({
        email,
        formRef: CONSENT_FORM_REFS.vivierOpposition,
        consentVersion: application.consentVersion,
        action: "optout",
        occurredAt: now,
        ip: options.ip ?? null,
        userAgent: options.userAgent ?? null,
      });

      // 🔴 Pas de fiche au CRM, rien à y opposer — et surtout rien à y
      // ENVOYER : émettre l'opposition d'un candidat jamais transmis ferait
      // partir son adresse vers le CRM par la seule porte qui restait ouverte
      // (ADR 0047, révision « aucune candidature ne franchit la frontière »).
      // La vérité de l'opposition reste `vivierOpposedAt`, posé plus haut.
      const subjectRef = await transmittedSubjectRef(siblings);
      if (subjectRef) {
        await syncVivierOppositionToCrm({
          subjectRef,
          occurredAt: now,
          person: { email },
          consent: { version: application.consentVersion, at: now },
        });
      }
    }

    return { ok: true, alreadyOpposed: false, applications: siblings.length };
  } catch (error) {
    console.error("[vivier] opposition non enregistrée:", error);
    return { ok: false, reason: "internal" };
  }
}

/**
 * La référence d'une candidature de la personne qui a PU atteindre le CRM, ou `null`.
 *
 * Depuis la coupure (ADR 0047, révision § 4 ter), plus aucune ligne
 * `application_submitted` n'est émise : `emitOutboxRow` solde en `gave_up`,
 * sans appel réseau, celles qui étaient encore en file. Le statut seul ne dit
 * donc plus rien, et c'est l'HISTOIRE de la ligne qui compte :
 *   · `sent` : le CRM l'a acquittée, la fiche existe ;
 *   · au moins une tentative réelle (`attempts > 0`) dont la dernière réponse
 *     n'est pas un refus 4xx : un délai dépassé ou une erreur 5xx a pu créer
 *     la fiche sans que l'accusé revienne. Dans le doute, l'opposition suit ;
 *   · jamais tentée (`attempts = 0`), ou refusée par un 4xx (le 422 d'un
 *     consentement v1) : aucune fiche, rien à y opposer — et surtout rien à y
 *     envoyer.
 *
 * On renvoie la référence de la candidature TRANSMISE, pas celle du lien
 * cliqué : c'est celle que le CRM connaît.
 */
async function transmittedSubjectRef(applicationIds: string[]): Promise<string | null> {
  if (applicationIds.length === 0) return null;
  const rows = await prisma.crmSyncOutbox.findMany({
    where: {
      eventType: "application_submitted",
      subjectRef: { in: applicationIds.map((id) => `site:job_application:${id}`) },
    },
    orderBy: { createdAt: "asc" },
    select: { subjectRef: true, status: true, attempts: true, responseStatus: true },
  });
  return rows.find(aPuAtteindreLeCrm)?.subjectRef ?? null;
}

/**
 * Règle PURE, exportée pour être testée cas par cas (voir ci-dessus). Une
 * ligne compte si elle a été acquittée, ou si une tentative réelle a pu créer
 * la fiche sans que l'accusé revienne. Un refus 4xx n'a rien créé.
 */
export function aPuAtteindreLeCrm(row: {
  status: string;
  attempts: number;
  responseStatus: number | null;
}): boolean {
  if (row.status === "sent") return true;
  if (row.attempts <= 0) return false;
  const code = row.responseStatus;
  return code === null || code < 400 || code >= 500;
}

/**
 * Les candidatures partageant la même adresse. L'email étant chiffré at-rest
 * (donc non interrogeable en SQL), on déchiffre et on compare en mémoire — le
 * volume s'y prête (reprise ponctuelle d'un stock de dizaines de lignes).
 */
async function applicationIdsForEmail(email: string): Promise<string[]> {
  const target = normalizeEmail(email);
  const rows = await prisma.jobApplication.findMany({ select: { id: true, email: true } });

  return rows
    .filter((row) => {
      const value = safeDecrypt(row.email);
      return value !== null && normalizeEmail(value) === target;
    })
    .map((row) => row.id);
}

function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptPii(value) ?? null;
  } catch {
    return null;
  }
}
