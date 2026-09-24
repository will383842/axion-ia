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
 * La référence d'une candidature de la personne DÉJÀ partie au CRM, ou `null`.
 *
 * Une ligne `application_submitted` compte si elle a été acquittée (`sent`) ou
 * si elle peut encore l'être (`pending`, `failed` : le rejeu la fera partir, et
 * l'opposition doit alors la suivre). Un refus définitif (`gave_up`) n'a créé
 * aucune fiche : il ne compte pas. Liste FERMÉE à dessein — un statut ajouté
 * plus tard ne fera rien partir tant qu'on ne l'a pas rangé ici.
 *
 * On renvoie la référence de la candidature TRANSMISE, pas celle du lien
 * cliqué : c'est celle que le CRM connaît.
 */
async function transmittedSubjectRef(applicationIds: string[]): Promise<string | null> {
  if (applicationIds.length === 0) return null;
  const row = await prisma.crmSyncOutbox.findFirst({
    where: {
      eventType: "application_submitted",
      status: { in: ["sent", "pending", "failed"] },
      subjectRef: { in: applicationIds.map((id) => `site:job_application:${id}`) },
    },
    orderBy: { createdAt: "asc" },
    select: { subjectRef: true },
  });
  return row?.subjectRef ?? null;
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
