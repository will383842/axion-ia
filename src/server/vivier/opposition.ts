/**
 * OPPOSITION À LA CONSERVATION EN VIVIER — effet immédiat, sans justification.
 *
 * Appelée par la route publique `/api/vivier-opposition?token=…` : un clic
 * depuis l'email d'information, sans login. Trois effets, dans cet ordre :
 *   1. `vivierOpposedAt` est posé sur TOUTES les candidatures de la personne —
 *      s'opposer, c'est s'opposer pour de bon, pas pour une seule des trois
 *      offres auxquelles on a postulé ;
 *   2. une ligne `optout` est ajoutée au registre de preuve ;
 *   3. l'opposition est propagée au CRM (univers vivier).
 *
 * IDEMPOTENTE : re-cliquer le même lien ne casse rien et ne ré-émet rien.
 *
 * DÉGRADÉE plutôt que muette (E31-010) : si l'adresse ne se déchiffre pas, le
 * drapeau (1) est posé quand même, mais (2) et (3) sautent — le résultat porte
 * alors `degraded: true` et le fait est journalisé en erreur. Une opposition à
 * moitié faite doit se voir ; elle ne doit pas se refuser.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { normalizeEmail } from "@/lib/security/email-hash";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { syncVivierOppositionToCrm } from "@/server/crm-sync";

export type VivierOppositionResult =
  // `degraded` n'est présent QUE lorsqu'il vaut `true` (E31-010) : l'ajouter
  // systématiquement casserait les égalités strictes des appelants et des
  // gardes, pour un champ qui ne dit rien dans le cas nominal.
  | { ok: true; alreadyOpposed: boolean; applications: number; degraded?: true }
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

    // 🔴 E31-010 — UNE ADRESSE ILLISIBLE FAISAIT DISPARAÎTRE LA MOITIÉ DE
    // L'OPPOSITION, EN SILENCE.
    //
    // Mesure du 2026-08-22 : `safeDecrypt()` rend `null` sur TOUTE exception
    // (clé tournée, chiffré corrompu). Le `if (email)` qui enveloppait ici À LA
    // FOIS le registre de preuve et la propagation au CRM était alors sauté —
    // et la fonction rendait quand même `ok: true`. La personne lisait « c'est
    // enregistré » ; il ne restait qu'un drapeau local, sans preuve consignée
    // et sans que le CRM apprenne jamais l'opposition.
    //
    // On NE fait PAS échouer la route pour autant : le drapeau vient d'être
    // posé au-dessus, et rendre `ok: false` transformerait une opposition
    // partielle en opposition REFUSÉE aux yeux du visiteur — un droit exercé
    // qu'on lui présenterait comme un échec. On rend donc un résultat DISTINCT
    // et on journalise en erreur : c'est ce qui fait cesser le silence, sans
    // rien retirer à la personne.
    if (!email) {
      console.error("[vivier] opposition DÉGRADÉE — adresse non déchiffrable", {
        applicationId: application.id,
        applications: siblings.length,
        manquant: "registre de preuve (optout) + propagation CRM",
        geste: "réparer le chiffré ou la clé, puis rejouer la propagation à la main",
      });

      return { ok: true, alreadyOpposed: false, applications: siblings.length, degraded: true };
    }

    await recordConsentEvent({
      email,
      formRef: CONSENT_FORM_REFS.vivierOpposition,
      consentVersion: application.consentVersion,
      action: "optout",
      occurredAt: now,
      ip: options.ip ?? null,
      userAgent: options.userAgent ?? null,
    });

    await syncVivierOppositionToCrm({
      subjectRef: `site:job_application:${application.id}`,
      occurredAt: now,
      person: { email },
      consent: { version: application.consentVersion, at: now },
    });

    return { ok: true, alreadyOpposed: false, applications: siblings.length };
  } catch (error) {
    console.error("[vivier] opposition non enregistrée:", error);
    return { ok: false, reason: "internal" };
  }
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
