/**
 * PREUVE DE L'ACCORD de la page « Recevoir le guide » — trois états (lot guide réseau 3).
 *
 * L'adresse saisie sur la page n'est qu'une SAISIE : n'importe qui peut taper l'adresse d'un tiers.
 * L'accord est donc écrit « en attente » (`page-confirmation.ts`), puis :
 *
 *   en_attente ── premier POST du bouton du lien du guide, APRÈS l'accord ──▶ confirmee
 *   en_attente ── N jours sans clic (mise à l'écart, JAMAIS une suppression) ─▶ non_verifiee
 *   non_verifiee ── clic tardif (le geste de la personne elle-même, décision D2) ─▶ confirmee
 *
 * `sans_objet` : MARQUE d'une adresse opposée (aucune donnée de personne) — jamais touchée.
 * Un statut NULL (ligne d'avant la migration) se lit « en_attente ».
 *
 * 🔴 RÈGLES. Aucune suppression (ni `delete`, ni `deleteMany`) : l'écart change un état, rien
 * d'autre. Le registre `consent_events` reste append-only (aucun UPDATE). Un « stop » n'est pas lu
 * ici et ne change pas l'état de preuve (c'est un fait passé) : il continue de tout bloquer
 * ailleurs (envois, CRM). Aucune transition ne déclenche jamais d'envoi. `merci_statut` n'est pas
 * touché. Rien de personnel dans les journaux : des compteurs.
 *
 * Les transitions sont des `updateMany` CONDITIONNELS : seul le passage qui change réellement
 * l'état écrit au registre (rejeu, double clic et concurrence n'écrivent rien de plus).
 */
import { FORM_REF_PAGE_GUIDE } from "@/content/guides-reseau";
import { recordConsentEvent } from "@/lib/consents";
import { prisma } from "@/lib/prisma";

export const PREUVE_EN_ATTENTE = "en_attente";
export const PREUVE_CONFIRMEE = "confirmee";
export const PREUVE_NON_VERIFIEE = "non_verifiee";
export const PREUVE_SANS_OBJET = "sans_objet";

/** Clé d'adresse d'une MARQUE (adresse opposée) : aucune donnée de personne. */
const CLE_MARQUE = "-";

/** Version écrite au registre : celle de la ligne elle-même (texte de la case + début de l'empreinte). */
function versionDeLaLigne(c: { versionConsentement: string; consentEmpreinte: string }): string {
  return `${c.versionConsentement}.${c.consentEmpreinte.slice(0, 32)}`;
}

function journal(transition: string, champs: Record<string, number>): void {
  console.warn(JSON.stringify({ event: "guides_reseau_preuve", transition, ...champs }));
}

/**
 * Premier clic (POST) sur le bouton du lien du guide : les accords « en attente » (ou NULL, ou
 * mis à l'écart) de CETTE demande, donnés AVANT le clic, passent « confirmée ». Traite TOUS les
 * contacts liés à la demande (la personne a pu utiliser la page deux fois pour le même guide).
 *
 * Ne lève jamais (même discipline que `recordConsentEvent`) : la personne a son PDF quoi qu'il
 * arrive ; si la base est en panne, la ligne reste « en attente » et se confirmera au clic suivant.
 */
export async function confirmerPreuvesAuClic(guideRequestId: string, clicLe: Date): Promise<void> {
  try {
    const passees = await prisma.contactGuideReseau.updateMany({
      where: {
        guideRequestId,
        OR: [
          { preuveStatut: PREUVE_EN_ATTENTE },
          { preuveStatut: null },
          { preuveStatut: PREUVE_NON_VERIFIEE },
        ],
        // Un clic antérieur à la case (ancien e-mail de la même demande) ne vérifie pas CET accord.
        consentiLe: { lte: clicLe },
      },
      data: { preuveStatut: PREUVE_CONFIRMEE, preuveConfirmeeLe: clicLe },
    });
    if (passees.count === 0) return;

    // Les lignes réellement passées par CE clic : même demande, même instant de confirmation.
    const lignes = await prisma.contactGuideReseau.findMany({
      where: { guideRequestId, preuveStatut: PREUVE_CONFIRMEE, preuveConfirmeeLe: clicLe },
      select: { emailKey: true, versionConsentement: true, consentEmpreinte: true },
    });
    // L'adresse vient de la demande, jamais d'un journal.
    const demande = await prisma.guideRequest.findUnique({
      where: { id: guideRequestId },
      select: { email: true },
    });
    let ecrites = 0;
    if (demande?.email) {
      for (const l of lignes) {
        if (l.emailKey === CLE_MARQUE) continue;
        const ok = await recordConsentEvent({
          email: demande.email,
          formRef: FORM_REF_PAGE_GUIDE,
          consentVersion: versionDeLaLigne(l),
          action: "consent_confirme",
          occurredAt: clicLe,
        }).catch(() => false);
        if (ok) ecrites += 1;
      }
    }
    journal(PREUVE_CONFIRMEE, { lignes: passees.count, registre: ecrites });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "guides_reseau_preuve_echec",
        transition: PREUVE_CONFIRMEE,
        erreur: err instanceof Error ? err.name : "erreur",
      }),
    );
  }
}
