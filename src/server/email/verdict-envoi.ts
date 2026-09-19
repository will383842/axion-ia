// Verdict d'envoi — la liste de suppression, en MODULE PUR (2026-09-19).
//
// 🔴 POURQUOI CE FICHIER EXISTE À CÔTÉ DE `suppression.ts`
//
// Le worker d'e-mails doit relire l'opposition AU MOMENT DU DÉPART : les
// relances J+2 / J+7, l'invitation à l'échange et le kit du dossier commencé
// sont des jobs retardés, vérifiés à l'enfilage puis endormis des heures ou des
// jours dans Redis. Une opposition exprimée entre-temps n'était relue par
// personne — la seule protection des jobs DÉJÀ en file, c'est le worker.
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
 * Gabarits marketing qui passent MALGRÉ un désabonnement : la confirmation de
 * double opt-in est la porte par laquelle on se réabonne. La retenir rendrait
 * le désabonnement irréversible.
 */
export const GABARITS_EXEMPTES_DU_DESABONNEMENT: ReadonlySet<string> = new Set([
  "newsletter-confirm-optin",
]);

/**
 * 🔴 2026-09-19 — Sollicitations du réseau d'apporteurs : non marketing, mais
 * soumises à l'OPPOSITION.
 *
 * Les relances « ton dossier t'attend » (J+2, J+7) et l'invitation à l'échange
 * de 15 minutes partent en famille B, sans le drapeau `marketing` : elles
 * répondent à une démarche de la personne, pas à une campagne. Or l'opposition
 * n'était lue QUE pour le marketing, alors que la page d'opposition promet de
 * ne plus solliciter.
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
   * L'envoi est une sollicitation soumise à l'opposition. Absent : déduit du
   * seul nom du gabarit (appelants antérieurs). Les deux chemins d'envoi — la
   * file et le worker — le calculent avec `estSollicitationSoumiseAOpposition`,
   * qui voit aussi la variante du payload.
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
      // e-mail, retient les envois marketing au même titre que le désabonnement.
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
        `[email-suppression] lecture du désabonnement impossible pour ${adresse} — envoi maintenu :`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return { retenu: false };
}
