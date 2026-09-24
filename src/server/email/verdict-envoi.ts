// Verdict d'envoi — la liste de suppression, en MODULE PUR (2026-09-19).
//
// 🔴 POURQUOI CE FICHIER EXISTE À CÔTÉ DE `suppression.ts`
//
// Le worker d'e-mails relit l'opposition AU MOMENT DU DÉPART, parce que c'est la
// SEULE protection d'un job DÉJÀ en file. Les relances J+2 / J+7 et le kit du
// dossier commencé sont des jobs retardés : vérifiés à l'enfilage, puis endormis
// des heures ou des jours dans Redis. L'invitation à l'échange, elle, part tout
// de suite — mais elle peut séjourner en file de validation, et une opposition
// exprimée pendant ce séjour doit la retenir comme les autres. Dans les deux cas,
// l'enfilage seul ne voit que l'état du moment ; le départ voit l'état réel.
//
// Or le worker ne peut pas importer `suppression.ts` : son `signalerRetenue`
// importe paresseusement `alertes-service`, qui tire une garde `next/headers`,
// un fichier `"use server"` et `next-auth`. Sous `tsx`, hors de Next, le worker
// démarrerait, se déclarerait `ready`, puis CHAQUE e-mail du site échouerait —
// convocations et factures comprises. Le verdict descend donc ici, avec pour
// SEULS imports la base et l'empreinte ; `suppression.ts` le réexporte, et
// aucun appelant existant ne change. Gardé par
// `workers/__tests__/email-worker.opposition.graphe-worker.spec.ts`.
//
// Deux motifs, deux portées (arbitrage Will, 2026-09-02) — détail en tête de
// `suppression.ts` : un rebond DUR retient tout ; un désabonnement newsletter
// ne retient que le marketing ; une opposition retient le marketing ET les
// sollicitations du réseau d'apporteurs.
//
// ⚠️ Repli assumé : si la base ne répond pas, on N'ARRÊTE PAS l'envoi, et on
// le dit en erreur. Retenir toute la chaîne sur un hoquet Postgres serait pire
// que le rebond qu'on cherche à éviter.

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

export type MotifRetenue = "rebond_dur" | "desabonne" | "oppose";

export type VerdictEnvoi =
  | { readonly retenu: false }
  | { readonly retenu: true; readonly motif: MotifRetenue; readonly depuis: Date | null };

/**
 * Gabarits qui passent MALGRÉ un désabonnement.
 *
 * 🔑 Lot L2 (amendement de Will du 24/09) — `newsletter-confirm-optin` en est
 * SORTI : il est dormant (plus aucun double opt-in), et c'est désormais
 * l'e-mail « Votre guide » qui porte la porte de réinscription (un bouton,
 * puis un POST). S'il repart un jour, l'y remettre : sans exemption, une
 * confirmation adressée à un désabonné serait retenue.
 */
export const GABARITS_EXEMPTES_DU_DESABONNEMENT: ReadonlySet<string> = new Set([
  // Lot L2 (2026-09-24) — « Votre guide » répond à une DEMANDE (6.1.b) : une
  // personne désabonnée de la lettre qui redemande le guide doit le recevoir.
  // Il ne porte pas le drapeau `marketing`, donc le désabonnement ne le
  // retiendrait déjà pas ; l'exemption le rend EXPLICITE, pour qu'un futur
  // passage en `marketing` ne le fasse pas taire en silence. Le rebond DUR,
  // lui, le retient toujours : il est lu avant cette liste.
  "guide-ia-envoi",
]);

/**
 * 🔴 2026-09-19 — Sollicitations du réseau d'apporteurs : non marketing, mais
 * soumises à l'OPPOSITION.
 *
 * Les relances « ton dossier t'attend » (J+2, J+7) et l'invitation à l'échange
 * de 15 minutes partent en famille B, sans le drapeau `marketing` : elles
 * répondent à une démarche de la personne, pas à une campagne. Mais la page
 * d'opposition promet de ne plus SOLLICITER, pas seulement de ne plus faire de
 * marketing : sa portée est donc plus large que le drapeau `marketing`.
 *
 * Ces gabarits honorent donc l'opposition (et seulement elle : un
 * désabonnement de la NEWSLETTER n'est pas un refus d'être recontacté au sujet
 * d'une candidature). L'accusé immédiat d'une démarche (`lead-apporteur-recu`
 * sans variante, `candidature-commercial-confirmee`) n'y est pas : une personne
 * qui dépose un nouveau dossier après s'être opposée reprend elle-même contact.
 */
export const GABARITS_SOLLICITATION_SOUMIS_A_OPPOSITION: ReadonlySet<string> = new Set([
  "lead-apporteur-relance",
  "apporteur-invitation-appel",
]);

/**
 * Variante du kit envoyé 30 minutes après l'écran 1 d'un dossier non terminé.
 *
 * ⚠️ Copie LOCALE de `VARIANTE_DOSSIER_COMMENCE` (`kit-apporteur.ts`), et c'est
 * voulu : ce module est chargé par le worker, et le kit tire des chemins de
 * page et de document qui n'ont rien à faire sur ce trajet. L'égalité des deux
 * valeurs est vérifiée par `verdict-envoi.spec.ts` — si l'une bouge seule, le
 * test rougit.
 */
export const VARIANTE_KIT_DIFFERE = "dossier-commence";

/**
 * Cet envoi est-il une SOLLICITATION, que l'opposition doit retenir ?
 *
 * Le kit du dossier commencé partage son gabarit avec l'accusé immédiat
 * (`lead-apporteur-recu`) : seul le payload les distingue. Le kit part 30
 * minutes APRÈS, sans nouvelle démarche de la personne — c'est une
 * sollicitation ; l'accusé répond à la démarche qu'elle vient de faire — ce
 * n'en est pas une.
 */
export function estSollicitationSoumiseAOpposition(
  template: string,
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (GABARITS_SOLLICITATION_SOUMIS_A_OPPOSITION.has(template)) return true;
  if (template !== "lead-apporteur-recu") return false;
  return (payload as { variante?: unknown } | null | undefined)?.variante === VARIANTE_KIT_DIFFERE;
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

export interface ContexteEnvoi {
  readonly template: string;
  readonly marketing: boolean;
  /**
   * L'envoi est une sollicitation soumise à l'opposition.
   *
   * Les DEUX chemins d'envoi — l'enfilage (`queues.ts`) et le départ
   * (`email-worker.ts`) — le passent désormais explicitement, calculé par
   * `estSollicitationSoumiseAOpposition`, qui voit aussi la VARIANTE du payload
   * (le kit du dossier commencé partage son gabarit avec l'accusé immédiat).
   *
   * Absent : repli sur le seul nom du gabarit. Code de REPLI, plus atteint par
   * aucun appelant du dépôt — gardé pour ne pas rendre le contrat dépendant de
   * l'ordre des arguments d'un appelant tiers, et parce que perdre le drapeau
   * doit retenir quand même, pas laisser passer.
   */
  readonly sollicitation?: boolean;
}

export async function verdictAvantEnvoi(
  destinataire: string,
  contexte: ContexteEnvoi,
): Promise<VerdictEnvoi> {
  if (estStub()) return { retenu: false };
  const adresse = destinataire.trim();
  if (adresse === "") return { retenu: false };

  try {
    // `recipient` est en citext : l'égalité est insensible à la casse.
    const rebond = await prisma.emailLog.findFirst({
      where: { recipient: adresse, status: "bounced", bounceType: "hard" },
      orderBy: { bouncedAt: "desc" },
      select: { bouncedAt: true },
    });
    if (rebond !== null) {
      return { retenu: true, motif: "rebond_dur", depuis: rebond.bouncedAt };
    }
  } catch (e) {
    console.error(
      `[email-suppression] lecture des rebonds impossible pour ${adresse} — envoi maintenu :`,
      e instanceof Error ? e.message : String(e),
    );
  }

  const marketing =
    contexte.marketing && !GABARITS_EXEMPTES_DU_DESABONNEMENT.has(contexte.template);
  const sollicitation =
    contexte.sollicitation ?? GABARITS_SOLLICITATION_SOUMIS_A_OPPOSITION.has(contexte.template);
  if (marketing || sollicitation) {
    try {
      // Le désabonnement newsletter ne vaut que pour le marketing.
      if (marketing) {
        const abonne = await prisma.newsletterSubscriber.findUnique({
          where: { email: adresse },
          select: { status: true, unsubscribedAt: true },
        });
        if (abonne?.status === "unsubscribed") {
          return { retenu: true, motif: "desabonne", depuis: abonne.unsubscribedAt };
        }
      }
      // Lot 1b : l'opposition à la prospection, exprimée depuis n'importe quel
      // e-mail, retient les envois marketing au même titre que le désabonnement
      // — ET, depuis le 2026-09-19, les SOLLICITATIONS du réseau d'apporteurs,
      // qui ne portent pas le drapeau `marketing`. Sa portée est donc plus large
      // que celle du désabonnement : c'est ce que la page d'opposition promet.
      // Lecture DIRECTE : `opposition.ts` tire la synchronisation CRM, qui tire
      // les files, qui tirent ce module — un cycle, et une chaîne d'imports qui
      // n'a rien à faire sur le chemin d'enfilage. La table ne porte que
      // l'empreinte de recherche : aucune adresse lisible n'y dort.
      const empreinte = hashEmailForLookup(adresse);
      const opposition =
        empreinte === null
          ? null
          : await prisma.emailOpposition.findUnique({
              where: { emailHash: empreinte },
              select: { id: true },
            });
      if (opposition !== null) {
        return { retenu: true, motif: "oppose", depuis: null };
      }
    } catch (e) {
      console.error(
        // Le `try` couvre les DEUX lectures — désabonnement newsletter et
        // opposition. Nommer la seule première laisserait chercher du côté de la
        // newsletter un incident qui peut venir de `email_opposition`.
        `[email-suppression] lecture du désabonnement ou de l'opposition impossible pour ${adresse} — envoi maintenu :`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return { retenu: false };
}
