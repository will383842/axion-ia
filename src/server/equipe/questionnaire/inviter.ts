import "server-only";

/**
 * Point d'entrée serveur UNIQUE pour inviter une personne à remplir le questionnaire privé.
 *
 * Appelé aujourd'hui par la console (bouton « Envoyer le questionnaire »). À brancher PLUS TARD, au
 * même endroit et sans autre code, à la contresignature du contrat d'un apporteur :
 * `inviterCollaborateur({ categorie: "apporteur", email, prenom, source: "contrat_apporteur" })`.
 * Ce déclencheur n'est PAS branché ici.
 *
 * Règles :
 *  - le jeton (32 octets, base64url) n'est jamais stocké : seul son sha256 l'est ;
 *  - expiration à 14 jours, version du questionnaire figée à l'envoi ;
 *  - idempotent : une fois le message parti, les invitations actives plus anciennes (ni utilisées, ni
 *    révoquées) pour la même adresse et la même catégorie sont révoquées ; si l'envoi échoue, le lien
 *    précédent reste valable ;
 *  - l'e-mail part en envoi DIRECT (aucun job BullMQ), une seule fois par invitation ;
 *  - l'adresse est chiffrée (`encryptPii`) pour pouvoir « Renvoyer » ; l'empreinte sert aux recherches ;
 *  - si l'adresse correspond déjà à une fiche, l'envoi est journalisé dans `TeamMemberEvent`
 *    (sans adresse ni jeton) ; sinon la ligne d'invitation elle-même est la trace.
 */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/client";
import { encryptPii, decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  QUESTIONNAIRE_VERSION_COURANTE,
  estCategorieEquipe,
  type TeamCategory,
} from "@/lib/equipe/donnees";
import { genererJetonQuestionnaire, hacherJetonQuestionnaire } from "./jeton";

export const VALIDITE_INVITATION_JOURS = 14;
const JOUR_MS = 24 * 3600 * 1000;

export type SourceInvitation = "console" | "contrat_apporteur" | (string & {});

export interface DemandeInvitation {
  categorie: TeamCategory;
  email: string;
  prenom?: string;
  source: SourceInvitation;
  /** Identifiant de l'administrateur ; `systeme` pour un déclencheur automatique. */
  acteur?: string;
}

export type ResultatInvitation =
  | { ok: true; inviteId: string; remplacees: number }
  | { ok: false; raison: "categorie" | "email" | "envoi" };

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function lienQuestionnaire(jeton: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com").replace(/\/+$/, "");
  return `${base}/fr/equipe/questionnaire/${jeton}`;
}

export function composerEmailInvitation(opts: {
  prenom?: string | null;
  lien: string;
  expireLe: Date;
}) {
  const prenom = opts.prenom?.trim();
  const date = opts.expireLe.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const salut = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const lignes = [
    salut,
    "Nous préparons la page qui vous présentera sur le site d'Axion-IA, avec votre accord. Pour cela, nous avons besoin de quelques réponses simples, qui prennent une dizaine de minutes.",
    `Voici votre lien personnel : ${opts.lien}`,
    `Il est valable jusqu'au ${date} et ne sert qu'une fois. Vous pourrez relire votre page avant sa mise en ligne, et la retirer quand vous voulez.`,
    "Merci d'avance, et à très vite.",
    "L'équipe Axion-IA",
  ];
  const html =
    `<p>${echapper(salut)}</p>` +
    `<p>${echapper(lignes[1] ?? "")}</p>` +
    `<p><a href="${echapper(opts.lien)}">Répondre au questionnaire</a></p>` +
    `<p>${echapper(`Ce lien est personnel, valable jusqu'au ${date}, et ne sert qu'une fois. Vous pourrez relire votre page avant sa mise en ligne, et la retirer quand vous voulez.`)}</p>` +
    `<p>${echapper(lignes[4] ?? "")}<br>${echapper(lignes[5] ?? "")}</p>`;
  return {
    subject: "Votre page sur Axion-IA : quelques questions",
    html,
    text: lignes.join("\n\n"),
  };
}

export async function inviterCollaborateur(
  demande: DemandeInvitation,
): Promise<ResultatInvitation> {
  if (!estCategorieEquipe(demande.categorie)) return { ok: false, raison: "categorie" };
  const email = demande.email.trim().toLowerCase();
  const empreinte = EMAIL_RE.test(email) && email.length <= 254 ? hashEmailForLookup(email) : null;
  if (!empreinte) return { ok: false, raison: "email" };
  const prenom = demande.prenom?.trim().slice(0, 80) || null;
  const acteur = demande.acteur ?? "systeme";

  const jeton = genererJetonQuestionnaire();
  const maintenant = new Date();
  const expireLe = new Date(maintenant.getTime() + VALIDITE_INVITATION_JOURS * JOUR_MS);

  const { inviteId, creeLe, membreId } = await prisma.$transaction(async (tx) => {
    const membre = await tx.teamMember.findFirst({
      where: { contactEmailHash: empreinte, category: demande.categorie },
      select: { id: true },
    });
    const invite = await tx.teamQuestionnaireInvite.create({
      data: {
        memberId: membre?.id ?? null,
        category: demande.categorie,
        questionnaireVersion: QUESTIONNAIRE_VERSION_COURANTE,
        tokenHash: hacherJetonQuestionnaire(jeton),
        emailHash: empreinte,
        contactEmailEnc: encryptPii(email),
        firstName: prenom,
        source: demande.source.slice(0, 30),
        expiresAt: expireLe,
        createdByAdminId: acteur,
      },
      select: { id: true, createdAt: true },
    });
    return { inviteId: invite.id, creeLe: invite.createdAt, membreId: membre?.id ?? null };
  });

  const mail = composerEmailInvitation({ prenom, lien: lienQuestionnaire(jeton), expireLe });
  try {
    await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  } catch {
    // Rien n'est parti : on retire la nouvelle ligne, et le lien précédent (s'il existe) reste valable.
    await prisma.teamQuestionnaireInvite
      .update({ where: { id: inviteId }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    return { ok: false, raison: "envoi" };
  }

  // Le message est parti : tout ce qui suit ne doit plus faire échouer l'appel (sinon un nouvel essai
  // enverrait un second e-mail). On remplace les invitations actives PLUS ANCIENNES ; avec deux envois
  // simultanés, seule la plus récente reste active.
  let remplacees = 0;
  try {
    await prisma.teamQuestionnaireInvite.update({
      where: { id: inviteId },
      data: { sentAt: new Date() },
    });
    const anciennes = await prisma.teamQuestionnaireInvite.updateMany({
      where: {
        emailHash: empreinte,
        category: demande.categorie,
        id: { not: inviteId },
        createdAt: { lt: creeLe },
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    remplacees = anciennes.count;
    if (membreId) {
      await prisma.teamMemberEvent.create({
        data: {
          memberId: membreId,
          action: "invitation_envoyee",
          actor: acteur,
          details: { categorie: demande.categorie, source: demande.source, remplacees },
        },
      });
    }
  } catch {
    console.error("[equipe] invitation envoyée, écritures de suivi en échec");
  }
  return { ok: true, inviteId, remplacees };
}

/** Révoque une invitation encore active (ni utilisée, ni déjà révoquée). */
export async function revoquerInvitation(inviteId: string): Promise<boolean> {
  const r = await prisma.teamQuestionnaireInvite.updateMany({
    where: { id: inviteId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r.count === 1;
}

/** Renvoie : le lien précédent n'est jamais relisible (seul son hash existe), on en émet un neuf. */
export async function renvoyerInvitation(
  inviteId: string,
  acteur: string,
): Promise<ResultatInvitation> {
  const ancienne = await prisma.teamQuestionnaireInvite.findUnique({
    where: { id: inviteId },
    select: { category: true, contactEmailEnc: true, firstName: true, usedAt: true, source: true },
  });
  if (!ancienne || ancienne.usedAt || !ancienne.contactEmailEnc)
    return { ok: false, raison: "email" };
  let email: string | null;
  try {
    email = decryptPii(ancienne.contactEmailEnc);
  } catch {
    return { ok: false, raison: "email" };
  }
  if (!email || !isDecryptedEmailUsable(email) || !estCategorieEquipe(ancienne.category))
    return { ok: false, raison: "email" };
  return inviterCollaborateur({
    categorie: ancienne.category,
    email,
    ...(ancienne.firstName ? { prenom: ancienne.firstName } : {}),
    source: ancienne.source ?? "console",
    acteur,
  });
}
