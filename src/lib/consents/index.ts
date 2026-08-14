/**
 * REGISTRE DE PREUVE DES CONSENTEMENTS (lot L4, plan §2.8.1).
 *
 * ── Le problème que ce module résout ────────────────────────────────────────
 * Avant lui, « prouvez que cette personne a consenti, à quelle version du texte
 * et quand » n'avait pas de réponse uniforme : la version vivait dans un JSON
 * (`details.consentVersion`) pour les submissions, dans une colonne dédiée pour
 * les candidatures, et NULLE PART pour la lettre d'information — le double
 * opt-in prouvait le geste, mais rien ne disait quel texte avait été accepté.
 *
 * ── Trois partis pris ───────────────────────────────────────────────────────
 *  1. APPEND-ONLY. Un retrait n'efface pas l'accord : il ajoute une ligne
 *     `optout`. L'historique EST la preuve — le réécrire la détruirait.
 *  2. AUCUNE adresse en clair. Seulement `personKey` (= `hashEmailForLookup`),
 *     la clé qui traverse les deux systèmes. Un registre de preuve RGPD qui
 *     serait lui-même un annuaire d'emails serait une régression.
 *  3. BEST-EFFORT ABSOLU. Cette fonction ne lève JAMAIS et ne fait jamais
 *     échouer une capture de lead. Un registre indisponible est un problème de
 *     conformité à corriger ; un formulaire cassé est un client perdu. On
 *     journalise bruyamment et on continue.
 *
 * 🔴 Corollaire assumé de (3) : ce registre est une preuve BEST-EFFORT, pas une
 * garantie transactionnelle. Il n'est pas écrit dans la transaction métier —
 * l'y mettre ferait échouer la soumission quand le registre échoue, ce que la
 * doctrine « zéro perte de lead » du site interdit.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { hashIp } from "@/lib/security/ip-hash";

/** Sens de l'événement : accord donné, ou accord retiré. */
export type ConsentAction = "optin" | "optout";

/**
 * Références FERMES des points de capture. Sans elles, deux consentements de
 * finalités différentes (étudier une candidature / la conserver en vivier)
 * seraient indiscernables dans le registre.
 */
export const CONSENT_FORM_REFS = {
  jobApplication: "job-application-form",
  /** Accord OPTIONNEL de conservation en vivier — finalité DISTINCTE. */
  jobApplicationVivier: "job-application-vivier",
  commercialApplication: "commercial-tunnel",
  commercialApplicationVivier: "commercial-tunnel-vivier",
  newsletter: "newsletter-double-optin",
  unifiedContact: "unified-contact-form",
  /** Opposition à la conservation en vivier (un clic, sans login). */
  vivierOpposition: "vivier-opposition",
} as const;

export interface RecordConsentEventInput {
  /** Adresse en clair — hachée ici, jamais stockée telle quelle. */
  email: string;
  formRef: string;
  consentVersion: string;
  action: ConsentAction;
  /** Quand le consentement a été DONNÉ (défaut : maintenant). */
  occurredAt?: Date | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
}

/**
 * Consigne un événement de consentement. Ne lève jamais, ne bloque jamais.
 *
 * @returns `true` si la preuve a bien été écrite — permet à un appelant qui y
 *   tient (un test, une commande d'administration) de le vérifier, sans jamais
 *   l'imposer aux points de capture.
 */
export async function recordConsentEvent(input: RecordConsentEventInput): Promise<boolean> {
  try {
    // `hashEmailForLookup` LÈVE en production si `PII_ENCRYPTION_KEY` manque.
    // Un défaut de configuration ne doit pas casser une soumission : on renonce
    // à la preuve (bruyamment), on ne casse pas le parcours.
    const personKey = hashEmailForLookup(input.email);
    if (!personKey) return false;

    await prisma.consentEvent.create({
      data: {
        personKey,
        formRef: input.formRef,
        consentVersion: input.consentVersion,
        action: input.action,
        occurredAt: input.occurredAt ?? new Date(),
        ipHash: safeHashIp(input.ip),
        userAgent: input.userAgent ?? null,
      },
    });

    return true;
  } catch (error) {
    console.error("[consents] écriture du registre de preuve échouée:", error);
    return false;
  }
}

/**
 * `hashIp` lève en production quand `IP_HASH_SALT` manque. L'adresse IP n'est
 * qu'un élément de contexte du consentement : son absence ne doit jamais
 * empêcher d'enregistrer la preuve elle-même.
 */
function safeHashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  try {
    return hashIp(ip);
  } catch {
    return null;
  }
}
