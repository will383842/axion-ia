// Liste de suppression — consultée AVANT tout enfilage d'e-mail.
//
// 🔴 Audit e-mails du 2026-09-02 — RIEN ne retenait un envoi vers une adresse
// morte ou désabonnée.
//
// Le webhook ZeptoMail écrit `bounced` + `bounceType: "hard"` dans le journal
// depuis le 2026-08-20, et l'écran de santé compte ces rebonds. Mais personne ne
// les RELISAIT sur le chemin d'envoi : un stagiaire dont l'adresse avait rebondi
// dur recevait encore convocation, rappel J-7, satisfaction J+1, suivi J+30 et
// attestation — cinq rebonds en trente jours sur un domaine en DMARC
// `p=reject`. Chaque rebond dur répété abîme la réputation d'envoi pour TOUS
// les flux, factures comprises. Symétriquement, une personne désabonnée de la
// newsletter n'était consultée par aucun envoi marketing.
//
// Deux motifs, deux portées (arbitrage Will, 2026-09-02) :
//
//   - `rebond_dur` : l'adresse a été refusée DÉFINITIVEMENT par le serveur
//     destinataire. Tout envoi est retenu, réglementaire compris — une
//     convocation vers une adresse morte n'arrive pas, elle rebondit. Le rebond
//     MOU (boîte pleine, serveur indisponible) ne retient rien : c'est
//     temporaire, et retenir une convocation sur une boîte pleine un mardi
//     exposerait le stagiaire à ne jamais la recevoir.
//   - `desabonne` : la personne a retiré son consentement newsletter. Seuls les
//     envois marqués `marketing` sont retenus — un désabonnement newsletter
//     n'est pas un refus de recevoir la facture qu'on a signée ni le rapport
//     qu'on vient de demander. La confirmation de double opt-in est exemptée :
//     une personne désabonnée qui se réinscrit doit pouvoir confirmer.
//
// ⚠️ Repli assumé : si la base ne répond pas, on N'ARRÊTE PAS l'envoi. Le
// contraire (retenir toute la chaîne, convocations comprises, sur un hoquet
// Postgres) serait pire que le rebond qu'on cherche à éviter. Le repli est
// journalisé en erreur pour ne pas être silencieux — c'est la seule chose qu'on
// puisse honnêtement faire ici.

import { prisma } from "@/lib/prisma";

export type MotifRetenue = "rebond_dur" | "desabonne";

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

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

export interface ContexteEnvoi {
  readonly template: string;
  readonly marketing: boolean;
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

  if (contexte.marketing && !GABARITS_EXEMPTES_DU_DESABONNEMENT.has(contexte.template)) {
    try {
      const abonne = await prisma.newsletterSubscriber.findUnique({
        where: { email: adresse },
        select: { status: true, unsubscribedAt: true },
      });
      if (abonne?.status === "unsubscribed") {
        return { retenu: true, motif: "desabonne", depuis: abonne.unsubscribedAt };
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

/**
 * Trace visible d'un envoi retenu. Deux canaux, aucun des deux n'échoue
 * l'appelant : le journal du worker, et une alerte console dédoublonnée PAR
 * ADRESSE — dix envois retenus vers la même adresse morte font UNE alerte, qui
 * dit quoi faire, pas dix.
 */
export async function signalerRetenue(
  destinataire: string,
  template: string,
  verdict: Extract<VerdictEnvoi, { retenu: true }>,
): Promise<void> {
  const quand = verdict.depuis ? ` (depuis le ${verdict.depuis.toISOString().slice(0, 10)})` : "";
  console.error(
    `[email-suppression] envoi « ${template} » RETENU vers ${destinataire} : ${verdict.motif}${quand}.`,
  );
  const titre =
    verdict.motif === "rebond_dur"
      ? "Un envoi a été retenu : l'adresse a déjà rebondi définitivement"
      : "Un envoi marketing a été retenu : la personne s'est désabonnée";
  const message =
    verdict.motif === "rebond_dur"
      ? `« ${template} » n'est pas parti vers ${destinataire}${quand} : le serveur destinataire a déjà refusé ` +
        `cette adresse pour de bon, et chaque nouvel envoi rebondirait en abîmant la réputation du domaine. ` +
        `Corriger l'adresse dans la fiche concernée (client, stagiaire, candidat), puis ré-émettre l'envoi ` +
        `depuis son écran d'origine. Tant que l'adresse n'est pas corrigée, cette personne ne recevra ` +
        `ni convocation, ni attestation, ni facture.`
      : `« ${template} » n'est pas parti vers ${destinataire}${quand} : cette personne a retiré son ` +
        `consentement newsletter. Un envoi marketing vers un désabonné est une plainte pour spam en ` +
        `puissance, et la plainte abîme le domaine pour tous les flux. Aucune action : le retrait est honoré.`;
  try {
    // 🔴 Import DYNAMIQUE, jamais statique : `alertes-service` tire son
    // évaluateur, qui tire `next-auth` → `next/server`. Ce module est importé par
    // `enqueueEmail`, donc par tout ce qui enfile un e-mail (workers, outils du
    // chatbot, portail, routes internes) : en import statique, sept suites de
    // tests tombaient à la collecte sur « Cannot find module next/server » —
    // sur le runner comme en local — et j'ai d'abord cru à un artefact
    // d'environnement. Un module qui enfile ne charge rien qui authentifie.
    const { creerOuDedup } = await import("@/server/qualiopi/alertes/alertes-service");
    await creerOuDedup({
      code: `email_retenu_${verdict.motif}`,
      niveau: "important",
      titre,
      message,
      cibleType: "EmailLog",
      cibleId: destinataire,
    });
  } catch (e) {
    console.error(
      `[email-suppression] alerte console impossible pour ${destinataire} :`,
      e instanceof Error ? e.message : String(e),
    );
  }
}
