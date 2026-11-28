/**
 * Retrait en un clic et effacement RÉEL d'une fiche collaborateur (RGPD). ROUTE PUBLIQUE, SANS COMPTE
 * pour le lien ; l'effacement, lui, est réservé à l'administrateur (l'action revérifie le rôle).
 *
 * Garanties (la relecture données/RGPD + sécurité porte sur ce fichier) :
 *  - jeton de 32 octets aléatoires ; seul son sha256 est stocké (`withdrawTokenHash`) ; un jeton mal
 *    formé ne touche pas la base ;
 *  - UN SEUL message neutre pour inconnu, déjà utilisé, fiche déjà retirée ou en cours d'effacement ;
 *  - le retrait exige Turnstile, une limite par IP hachée et par jeton ;
 *  - retrait TOTAL : statut « retire », accord de publication retiré, hors carte, jeton consommé ;
 *    retrait PARTIEL (photo seule, LinkedIn seul) : le jeton reste valable pour la suite ;
 *  - IDOR impossible : la fiche est trouvée PAR l'empreinte du jeton, jamais par un identifiant fourni ;
 *  - effet immédiat : `revalidatePath` fiche + hub + sitemap ; alerte à l'administrateur sans donnée
 *    personnelle autre que le prénom ;
 *  - effacement réel : fichiers d'abord (si l'un résiste, rien n'est supprimé en base), puis UNE
 *    transaction qui supprime la fiche, ses réponses, ses invitations, son journal et la preuve de
 *    consentement liée, et ne laisse qu'une ligne d'effacement minimale (dates, aucun prénom/e-mail).
 */
import "server-only";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/client";
import { decryptPii } from "@/lib/pii-crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { hashIp } from "@/lib/security/ip-hash";
import { notify } from "@/server/notifications";
import { revaliderFicheEquipe } from "@/lib/equipe/revalider";
import { idSchema } from "@/lib/equipe/console/schemas";
import { purgerFichiers, retirerPhotoCollaborateur } from "../photo-collaborateur";
import { genererJetonQuestionnaire, hacherJetonQuestionnaire } from "../questionnaire/jeton";

const FORME_JETON = /^[A-Za-z0-9_-]{43}$/;
const IP_PAR_HEURE = 10;
const TENTATIVES_PAR_JETON = 5;
const HEURE = 3600;
const FORM_REF_TEAM = "team-profile-";

export const MESSAGE_NEUTRE_RETRAIT =
  "Ce lien n'est plus valable. Si vous voulez retirer votre page ou vos données, écrivez-nous et nous le ferons sans délai.";

export type PorteeRetrait = "total" | "photo" | "linkedin";

export function lienRetrait(jeton: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com").replace(/\/+$/, "");
  return `${base}/fr/equipe/retrait/${jeton}`;
}

const echapper = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Clé de personne des preuves de consentement : empreinte d'e-mail, ou celle de l'invitation. */
export function clePersonneInvitation(inviteId: string): string {
  return createHash("sha256").update(`team-invite:${inviteId}`).digest("hex");
}

// ───────────────────────── Remise du lien à la publication ─────────────────────────

/**
 * Pose un NOUVEAU jeton de retrait (l'ancien cesse de valoir) et l'envoie à l'adresse de la fiche.
 * Sans adresse : rien n'est posé (le retrait passe alors par la console). Jamais d'exception : la
 * publication est déjà faite.
 */
export async function remettreLienRetrait(
  memberId: string,
): Promise<{ ok: true } | { ok: false; raison: "sans_email" | "envoi" | "introuvable" }> {
  try {
    const m = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { id: true, firstName: true, contactEmailEnc: true },
    });
    if (!m) return { ok: false, raison: "introuvable" };
    if (!m.contactEmailEnc) return { ok: false, raison: "sans_email" };
    const adresse = decryptPii(m.contactEmailEnc);
    if (!adresse || !adresse.includes("@")) return { ok: false, raison: "sans_email" };
    const jeton = genererJetonQuestionnaire();
    await prisma.teamMember.update({
      where: { id: m.id },
      data: { withdrawTokenHash: hacherJetonQuestionnaire(jeton) },
    });
    const lien = lienRetrait(jeton);
    const salut = `Bonjour ${m.firstName},`;
    const corps =
      "Votre page est maintenant en ligne sur le site d'Axion-IA. Vous pouvez la retirer, ou ne retirer que votre photo ou votre lien LinkedIn, quand vous voulez, en un clic. Ce lien est personnel : ne le partagez pas.";
    try {
      await sendEmail({
        to: adresse,
        subject: "Votre page sur Axion-IA est en ligne",
        html: `<p>${echapper(salut)}</p><p>${echapper(corps)}</p><p><a href="${echapper(lien)}">Retirer ma page ou une partie</a></p><p>L'équipe Axion-IA</p>`,
        text: `${salut}\n\n${corps}\n\nRetirer ma page ou une partie : ${lien}\n\nL'équipe Axion-IA`,
      });
    } catch {
      await prisma.teamMember
        .updateMany({ where: { id: m.id }, data: { withdrawTokenHash: null } })
        .catch(() => undefined);
      return { ok: false, raison: "envoi" };
    }
    await prisma.teamMemberEvent
      .create({ data: { memberId: m.id, action: "lien_retrait_envoye", actor: "systeme" } })
      .catch(() => undefined);
    return { ok: true };
  } catch {
    return { ok: false, raison: "envoi" };
  }
}

// ───────────────────────── Page publique ─────────────────────────

export type LectureRetrait =
  | { readonly etat: "neutre" }
  | {
      readonly etat: "ok";
      readonly peutRetirerPhoto: boolean;
      readonly peutRetirerLinkedin: boolean;
    };

const NEUTRE = { etat: "neutre" } as const;

async function trouverParJeton(jeton: string) {
  if (!FORME_JETON.test(jeton)) return null;
  const m = await prisma.teamMember.findUnique({
    where: { withdrawTokenHash: hacherJetonQuestionnaire(jeton) },
  });
  if (!m || m.erasureRequestedAt !== null || m.status === "retire") return null;
  return m;
}

export async function lireLienRetrait(jeton: string): Promise<LectureRetrait> {
  const m = await trouverParJeton(jeton);
  if (!m) return NEUTRE;
  return {
    etat: "ok",
    peutRetirerPhoto:
      m.photoConsentAt !== null || m.photoKind === "reelle" || m.photoUrl256 !== null,
    peutRetirerLinkedin: m.linkedinConsentAt !== null || m.linkedinUrl !== null,
  };
}

export interface EntreeRetrait {
  readonly jeton: string;
  readonly portee: string;
  readonly turnstile: string | null;
  readonly ip: string;
}

export type ResultatRetrait =
  | { readonly ok: true; readonly portee: PorteeRetrait }
  | { readonly ok: false; readonly motif: "neutre" | "limite" | "turnstile" | "invalide" };

async function alerterAdministrateur(portee: PorteeRetrait): Promise<void> {
  try {
    await notify({
      category: "SECURITY_ALERT",
      payload: {
        kind: "equipe_retrait_par_lien",
        // Aucune donnée personnelle : cette alerte part aussi vers Sentry, hors de portée de l'effacement.
        details: { portee },
      },
      sync: true,
      force: true,
    } as Parameters<typeof notify>[0]);
  } catch {
    /* le retrait est fait ; l'alerte est un confort, le journal de la fiche en garde la trace */
  }
}

export async function retirerParLien(entree: EntreeRetrait): Promise<ResultatRetrait> {
  if (!FORME_JETON.test(entree.jeton)) return { ok: false, motif: "neutre" };
  const portee = entree.portee;
  if (portee !== "total" && portee !== "photo" && portee !== "linkedin") {
    return { ok: false, motif: "invalide" };
  }
  const tokenHash = hacherJetonQuestionnaire(entree.jeton);

  const parIp = await checkRateLimit(`equipe-retrait:ip:${hashIp(entree.ip) ?? "inconnue"}`, {
    limit: IP_PAR_HEURE,
    windowSec: HEURE,
  });
  if (!parIp.allowed) return { ok: false, motif: "limite" };
  const humain = await verifyTurnstile(entree.turnstile, entree.ip).catch(() => false);
  if (!humain) return { ok: false, motif: "turnstile" };
  const parJeton = await checkRateLimit(`equipe-retrait:jeton:${tokenHash}`, {
    limit: TENTATIVES_PAR_JETON,
    windowSec: HEURE,
  });
  if (!parJeton.allowed) return { ok: false, motif: "limite" };

  const m = await trouverParJeton(entree.jeton);
  if (!m) return { ok: false, motif: "neutre" };
  const maintenant = new Date();

  if (portee === "photo") {
    const r = await retirerPhotoCollaborateur({ memberId: m.id, acteur: "personne" });
    if (!r.ok) return { ok: false, motif: "invalide" };
    await journaliserRetrait(m.id, "photo");
  } else if (portee === "linkedin") {
    const ok = await prisma.$transaction(async (tx) => {
      const r = await tx.teamMember.updateMany({
        where: { id: m.id, withdrawTokenHash: tokenHash, erasureRequestedAt: null },
        data: { linkedinUrl: null, linkedinConsentAt: null, linkedinConsentVersion: null },
      });
      if (r.count !== 1) return false;
      await tx.teamMemberEvent.create({
        data: {
          memberId: m.id,
          action: "retrait_par_lien",
          actor: "personne",
          details: { portee },
        },
      });
      return true;
    });
    if (!ok) return { ok: false, motif: "neutre" };
  } else {
    const ok = await prisma.$transaction(async (tx) => {
      const r = await tx.teamMember.updateMany({
        where: {
          id: m.id,
          withdrawTokenHash: tokenHash,
          erasureRequestedAt: null,
          status: { not: "retire" },
        },
        data: {
          status: "retire",
          withdrawnAt: maintenant,
          withdrawnBy: "personne",
          // Republier exigera un NOUVEL accord de publication.
          publicationConsentAt: null,
          publicationConsentVersion: null,
          showOnMap: false,
          withdrawTokenHash: null,
        },
      });
      if (r.count !== 1) return false;
      await tx.teamMemberEvent.create({
        data: {
          memberId: m.id,
          action: "retrait_par_lien",
          actor: "personne",
          details: { portee },
        },
      });
      return true;
    });
    if (!ok) return { ok: false, motif: "neutre" };
  }
  await tracerRetraitConsentement(m, portee, maintenant);
  revaliderFicheEquipe(m.slug);
  await alerterAdministrateur(portee);
  return { ok: true, portee };
}

async function journaliserRetrait(memberId: string, portee: PorteeRetrait): Promise<void> {
  await prisma.teamMemberEvent
    .create({
      data: { memberId, action: "retrait_par_lien", actor: "personne", details: { portee } },
    })
    .catch(() => undefined);
}

/** Une ligne « optout » du registre de preuve, quand la personne a une clé (empreinte d'e-mail). */
async function tracerRetraitConsentement(
  m: { contactEmailHash: string | null },
  portee: PorteeRetrait,
  quand: Date,
  ip?: string,
): Promise<void> {
  if (!m.contactEmailHash) return;
  const refs: string[] =
    portee === "total"
      ? ["team-profile-publication"]
      : [portee === "photo" ? "team-profile-photo" : "team-profile-linkedin"];
  const versions: Record<string, string> = {
    "team-profile-publication": "team-publication-v1",
    "team-profile-photo": "team-photo-v1",
    "team-profile-linkedin": "team-linkedin-v1",
  };
  await prisma.consentEvent
    .createMany({
      data: refs.map((formRef) => ({
        personKey: m.contactEmailHash as string,
        formRef,
        consentVersion: versions[formRef] ?? "inconnue",
        action: "optout",
        occurredAt: quand,
        ipHash: ip ? hashIp(ip) : null,
        userAgent: null,
      })),
    })
    .catch(() => undefined);
}

// ───────────────────────── Console : un seul consentement ─────────────────────────

export type ResultatConsole<T extends object = object> =
  ({ ok: true } & T) | { ok: false; erreur: string };

/** Retire UN consentement (photo, LinkedIn) ou l'accord de publication (= retrait total). */
export async function retirerUnConsentement(entree: {
  memberId: string;
  consentement: PorteeRetrait;
  acteur: string;
}): Promise<ResultatConsole<{ slug: string }>> {
  const id = idSchema.safeParse(entree.memberId);
  if (!id.success) return { ok: false, erreur: "Identifiant invalide." };
  const m = await prisma.teamMember.findUnique({ where: { id: id.data } });
  if (!m) return { ok: false, erreur: "Fiche introuvable." };
  if (m.erasureRequestedAt) return { ok: false, erreur: "Fiche en cours d'effacement." };
  const maintenant = new Date();
  if (entree.consentement === "photo") {
    const r = await retirerPhotoCollaborateur({ memberId: m.id, acteur: entree.acteur });
    if (!r.ok) return r;
  } else {
    const donnees =
      entree.consentement === "linkedin"
        ? { linkedinUrl: null, linkedinConsentAt: null, linkedinConsentVersion: null }
        : {
            status: "retire",
            withdrawnAt: maintenant,
            withdrawnBy: "admin",
            publicationConsentAt: null,
            publicationConsentVersion: null,
            showOnMap: false,
            withdrawTokenHash: null,
          };
    const ok = await prisma.$transaction(async (tx) => {
      const r = await tx.teamMember.updateMany({
        where: { id: m.id, updatedAt: m.updatedAt },
        data: donnees,
      });
      if (r.count !== 1) return false;
      await tx.teamMemberEvent.create({
        data: {
          memberId: m.id,
          action: "consentement_retire",
          actor: entree.acteur,
          details: { consentement: entree.consentement },
        },
      });
      return true;
    });
    if (!ok) return { ok: false, erreur: "La fiche a changé entre-temps, rechargez la page." };
  }
  await tracerRetraitConsentement(m, entree.consentement, maintenant);
  revaliderFicheEquipe(m.slug);
  return { ok: true, slug: m.slug };
}

// ───────────────────────── Effacement réel ─────────────────────────

export const MOT_DE_CONFIRMATION = "EFFACER";

export async function effacerDefinitivement(entree: {
  memberId: string;
  /** Doit valoir `EFFACER` : la confirmation explicite est revérifiée côté serveur. */
  confirmation: string;
  acteur: string;
  /** Date de réception de la demande (ISO) ; à défaut, la date de la fiche ou aujourd'hui. */
  demandeLe?: string | null;
}): Promise<ResultatConsole> {
  if (entree.confirmation !== MOT_DE_CONFIRMATION) {
    return { ok: false, erreur: `Tapez « ${MOT_DE_CONFIRMATION} » pour confirmer.` };
  }
  const id = idSchema.safeParse(entree.memberId);
  if (!id.success) return { ok: false, erreur: "Identifiant invalide." };
  const m = await prisma.teamMember.findUnique({ where: { id: id.data } });
  if (!m) return { ok: false, erreur: "Fiche introuvable." };
  const maintenant = new Date();
  let demande = m.erasureRequestedAt ?? maintenant;
  if (entree.demandeLe) {
    const d = new Date(entree.demandeLe);
    if (Number.isNaN(d.getTime()) || d.getTime() > maintenant.getTime() + 24 * 3600 * 1000) {
      return { ok: false, erreur: "Date de la demande invalide." };
    }
    demande = d;
  }

  // `contactEmailHash` n'est pas unique : si une autre fiche porte la même adresse, on n'efface pas
  // à l'aveugle (ses invitations, réponses et preuves partageraient la même clé).
  if (m.contactEmailHash) {
    const autre = await prisma.teamMember.findFirst({
      where: { contactEmailHash: m.contactEmailHash, id: { not: m.id } },
      select: { id: true },
    });
    if (autre) {
      return {
        ok: false,
        erreur:
          "Une autre fiche porte la même adresse e-mail : effacement refusé, à traiter à la main.",
      };
    }
  }
  const [invites, soumissions] = await Promise.all([
    prisma.teamQuestionnaireInvite.findMany({
      where: {
        OR: [
          { memberId: m.id },
          ...(m.contactEmailHash ? [{ emailHash: m.contactEmailHash }] : []),
        ],
      },
      select: { id: true, emailHash: true },
    }),
    prisma.teamQuestionnaireSubmission.findMany({
      where: { memberId: m.id },
      select: { photoStoragePath: true },
    }),
  ]);

  // 1. Fichiers d'abord (idempotent) : si l'un résiste, la base n'est pas touchée et on peut réessayer.
  let echecs = await purgerFichiers(m);
  for (const s of soumissions) {
    echecs += await purgerFichiers({
      photoStoragePath: s.photoStoragePath,
      photoUrl256: null,
      photoUrl1024: null,
    });
  }
  if (echecs > 0) {
    return {
      ok: false,
      erreur: `${echecs} fichier(s) photo n'ont pas pu être supprimés : rien n'a été effacé en base, réessayez.`,
    };
  }

  // 2. UNE transaction : tout ou rien.
  const cles = new Set<string>();
  if (m.contactEmailHash) cles.add(m.contactEmailHash);
  for (const i of invites) {
    cles.add(clePersonneInvitation(i.id));
    if (i.emailHash) cles.add(i.emailHash);
  }
  try {
    await prisma.$transaction(async (tx) => {
      // Fiche modifiée depuis la lecture (photo déposée entre-temps) : on annule, fichiers à reprendre.
      const verrou = await tx.teamMember.updateMany({
        where: { id: m.id, updatedAt: m.updatedAt },
        data: { erasureRequestedAt: demande },
      });
      if (verrou.count !== 1) throw new Error("fiche-modifiee");
      await tx.consentEvent.deleteMany({
        where: { personKey: { in: [...cles] }, formRef: { startsWith: FORM_REF_TEAM } },
      });
      await tx.teamQuestionnaireSubmission.deleteMany({ where: { memberId: m.id } });
      await tx.teamQuestionnaireInvite.deleteMany({
        where: { id: { in: invites.map((i) => i.id) } },
      });
      await tx.teamMemberEvent.deleteMany({ where: { memberId: m.id } });
      await tx.teamMember.delete({ where: { id: m.id } });
      // Trace minimale : aucune référence à la personne (ni prénom, ni slug, ni e-mail, ni identifiant).
      await tx.teamMemberEvent.create({
        data: {
          memberId: null,
          action: "effacement",
          actor: entree.acteur,
          details: { demandeLe: demande.toISOString(), traiteLe: maintenant.toISOString() },
        },
      });
    });
  } catch {
    return {
      ok: false,
      erreur: "Effacement non terminé (fiche modifiée ou déjà effacée) : rechargez et réessayez.",
    };
  }
  revaliderFicheEquipe(m.slug);
  return { ok: true };
}
