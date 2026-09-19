// SAISIE MANUELLE D'UN CONTACT APPORTEUR — Server Actions de la console.
//
// ── Le trou que ça bouche ─────────────────────────────────────────────────
// Six chemins créaient un contact, et TOUS SIX étaient des formulaires publics
// ou le chatbot. Aucun écran de la console ne permettait d'en saisir un.
//
// Conséquence : l'apporteur qui écrit par e-mail, celui rencontré sur un salon,
// celui qui a répondu à notre annonce — aucun ne pouvait entrer dans le
// système. On ne pouvait que lui envoyer un lien et espérer qu'il le remplisse.
//
// ── Trois règles, et elles ne sont pas négociables ────────────────────────
//
// 1. AUCUN ENVOI AUTOMATIQUE. Une personne saisie à la main n'a pas rempli nos
//    formulaires : ni e-mail de confirmation, ni rappels J+2 / J+7. Lui écrire
//    « ton dossier t'attend » serait un message non sollicité — et, pour un
//    apporteur, un rappel d'activité attendue
//    (`docs/partners/ANTI-REQUALIFICATION.md`, motif 4).
//
//    🟢 2026-09-19 — Will a validé le fonctionnement et ouvert UN envoi, et un
//    seul : l'INVITATION à l'échange de 15 minutes (lien Calendly + document de
//    présentation + catalogue), si l'administrateur coche la case. C'est une
//    réponse à quelqu'un qui s'est manifesté (e-mail, appel, salon), envoyée
//    par un geste humain explicite — jamais un effet de bord de la saisie.
//    Aucune relance ne la suit.
//
// 2. LE CONSENTEMENT N'EST PAS SIMULÉ. On n'écrit pas un `optin` : la personne
//    n'a rien coché. La ligne porte une origine explicite, et l'absence de
//    consentement est un FAIT enregistré, pas un trou. Fabriquer un
//    consentement qui n'a pas eu lieu serait pire que ne pas en avoir.
//
// 3. LE DOUBLON SE DÉTECTE AVANT D'ÉCRIRE. Après, il faut fusionner — ce qui
//    n'existe pas. Le moment le moins cher pour éviter deux lignes est celui
//    où la seconde n'est pas encore écrite.

"use server";

import { ORIGINE_SAISIE_MANUELLE } from "@/lib/contact/accuse-attendu";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SubmissionSource, SubmissionType } from "../../../prisma/generated/client";
import { encryptPii, decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { adminPath } from "@/lib/admin-path";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";
import { LEAD_APPORTEUR_ETAPE } from "@/lib/commercial-application/lead-apporteur";
import {
  ORIGINE_INTERDITE,
  ORIGINES_ACCORD_REQUIS,
  saisieManuelleSchema,
  type IssueInvitation,
  type SaisieState,
  type TraceExistante,
} from "@/lib/commercial-application/saisie-manuelle";
import { estLienCalendlyValide } from "@/lib/commercial-application/kit-apporteur";
import { envoyerInvitationApporteur } from "./invitation-apporteur";

/** Rôles autorisés à écrire dans la console. Même liste qu'`admin-submissions`. */
const ROLES_ECRITURE = ["super_admin", "admin", "editor"] as const;

async function exigerSessionEcriture(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (!ROLES_ECRITURE.includes(role as (typeof ROLES_ECRITURE)[number])) {
    throw new Error("forbidden");
  }
  return session.user.id;
}

/**
 * Cherche ce que le site sait déjà de cette adresse.
 *
 * 🔑 Par EMPREINTE, jamais par adresse en clair : `contactEmail` est chiffré
 * avec un IV aléatoire, une égalité SQL n'y est pas possible. Une recherche en
 * clair ne rendrait JAMAIS rien — et le doublon passerait, sans erreur.
 */
export async function chercherTracesExistantes(email: string): Promise<TraceExistante[]> {
  await exigerSessionEcriture();
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return [];

  const lignes = await prisma.submission.findMany({
    where: { contactEmailHash: empreinte },
    select: { id: true, type: true, details: true, submittedAt: true, contactName: true },
    orderBy: { submittedAt: "desc" },
    take: 10,
  });

  return lignes.map((l) => {
    const d = l.details as { etape?: string } | null;
    let nom: string | null = null;
    try {
      nom = decryptPii(l.contactName);
    } catch {
      nom = null;
    }
    return {
      id: l.id,
      type: String(l.type),
      etape: d?.etape ?? null,
      nom,
      recuLe: l.submittedAt.toISOString(),
    };
  });
}

/**
 * Crée un contact saisi à la main.
 *
 * ⛔ N'envoie ni confirmation ni rappels. Seule l'invitation part, et
 * seulement si `envoyerInvitation` est coché. Voir l'en-tête.
 */
export async function creerContactManuelAction(payload: unknown): Promise<SaisieState> {
  let adminId: string;
  try {
    adminId = await exigerSessionEcriture();
  } catch {
    return { ok: false, erreur: "non-autorise", message: "Session absente ou rôle insuffisant." };
  }

  const parsed = saisieManuelleSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      erreur: "champs-invalides",
      message: "Un prénom, une adresse e-mail valide et une origine sont nécessaires.",
    };
  }
  const d = parsed.data;

  // 🔴 2026-09-19 — art. 14 RGPD et L.34-5 CPCE. Une adresse relevée sur
  // l'annonce d'un TIERS n'a pas été donnée à Axion-IA : on ne l'enregistre pas
  // (l'option n'est plus proposée, mais un formulaire ancien ou forgé peut
  // encore l'envoyer). Rien n'est écrit.
  if (d.origine === ORIGINE_INTERDITE) {
    return {
      ok: false,
      erreur: "champs-invalides",
      message:
        "Une adresse relevée sur l'annonce d'un tiers ne s'enregistre pas : la personne ne nous l'a pas donnée.",
    };
  }
  // Adresse venue d'ailleurs (recommandation, autre) : l'invitation n'est
  // possible que si l'administrateur atteste que la personne a accepté d'être
  // contactée. Vérifié AVANT d'écrire, comme le lien.
  if (d.envoyerInvitation && ORIGINES_ACCORD_REQUIS.includes(d.origine) && !d.accordContact) {
    return {
      ok: false,
      erreur: "champs-invalides",
      message:
        "Pour inviter une personne dont l'adresse vient d'ailleurs, coche « La personne a accepté d'être contactée ».",
    };
  }

  // Le lien se vérifie AVANT d'écrire : une invitation demandée avec un lien
  // faux ne doit pas laisser une fiche créée et un envoi raté derrière elle.
  if (d.envoyerInvitation && !estLienCalendlyValide(d.calendlyUrl ?? "")) {
    return {
      ok: false,
      erreur: "champs-invalides",
      message: "Pour envoyer l'invitation, colle un lien https://calendly.com/… complet.",
    };
  }

  const empreinte = hashEmailForLookup(d.email);
  if (!empreinte) {
    return { ok: false, erreur: "echec", message: "Empreinte d'e-mail indisponible." };
  }

  // ── LE DOUBLON SE TRAITE AVANT L'ÉCRITURE. Après, il faudrait fusionner —
  // et la fusion n'existe pas.
  if (!d.confirmeMalgreDoublon) {
    const traces = await chercherTracesExistantes(d.email);
    if (traces.length > 0) return { ok: false, erreur: "doublon", traces };
  }

  try {
    const submission = await prisma.submission.create({
      data: {
        type: SubmissionType.contact,
        locale: "fr",
        companyName: "—",
        contactName: encryptPii(`${d.prenom}${d.nom ? ` ${d.nom}` : ""}`.trim()),
        contactEmail: encryptPii(d.email),
        contactEmailHash: empreinte,
        contactPhone: d.telephone ? encryptPii(d.telephone) : null,
        // `import` existait déjà dans l'énumération : une ligne saisie à la main
        // se distingue donc d'un formulaire sans rien ajouter au schéma.
        source: SubmissionSource.import,
        details: {
          unifiedType: "recrutement",
          subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
          etape: LEAD_APPORTEUR_ETAPE,
          origine: ORIGINE_SAISIE_MANUELLE,
          origineSaisie: d.origine,
          ...(d.ville ? { ville: d.ville } : {}),
          ...(d.note ? { note: d.note } : {}),
          // L'accord ATTESTÉ par l'administrateur, daté. Ce n'est pas un
          // consentement de la personne (voir la ligne suivante) : c'est la
          // trace que quelqu'un a affirmé qu'elle acceptait d'être contactée.
          ...(ORIGINES_ACCORD_REQUIS.includes(d.origine) && d.accordContact
            ? { accordContactAt: new Date().toISOString() }
            : {}),
          // 🔴 Le FAIT, écrit noir sur blanc : cette personne n'a rien accepté.
          // Fabriquer un `optin` qui n'a pas eu lieu serait pire que l'absence.
          consentement: "aucun — contact saisi par un administrateur",
          saisiPar: adminId,
          message: d.envoyerInvitation
            ? "Contact saisi manuellement depuis la console. Invitation à l'échange de 15 minutes demandée à la saisie."
            : "Contact saisi manuellement depuis la console. Aucun e-mail ne lui a été envoyé.",
        } as object,
      },
    });

    // Journal : qui, quand, sur quoi. L'adresse n'y est pas recopiée en clair.
    await prisma.activityLog.create({
      data: {
        adminUserId: adminId,
        action: "submission.saisie_manuelle",
        targetType: "submission",
        targetId: submission.id,
        changes: {
          origineSaisie: d.origine,
          contactEmailHash: empreinte,
          envoi: d.envoyerInvitation ? "invitation" : "aucun",
        },
      },
    });

    // L'invitation, si elle a été cochée. La fiche est déjà écrite : un échec
    // d'envoi ne la défait pas, il est RAPPORTÉ — l'écran dit que rien n'est
    // parti, et la fiche garde son bouton pour réessayer.
    let invitation: IssueInvitation | undefined;
    if (d.envoyerInvitation && d.calendlyUrl) {
      try {
        const r = await envoyerInvitationApporteur({
          submissionId: submission.id,
          calendlyUrl: d.calendlyUrl,
          adminId,
        });
        invitation = r.ok
          ? { envoyee: true, ...(r.enValidation ? { enValidation: true as const } : {}) }
          : { envoyee: false, message: r.message };
      } catch (err) {
        // La fiche EST écrite : ne pas laisser l'écran dire « l'enregistrement
        // a échoué » pour un envoi raté.
        Sentry.captureException(err, {
          tags: { action: "creerContactManuelAction", step: "invitation" },
        });
        invitation = {
          envoyee: false,
          message: "L'invitation n'est pas partie. Réessaie depuis la fiche du contact.",
        };
      }
    }

    revalidatePath(adminPath("fr", "contacts/commercial"));
    return { ok: true, submissionId: submission.id, ...(invitation ? { invitation } : {}) };
  } catch (err) {
    console.error("[saisie-manuelle] échec:", err);
    Sentry.captureException(err, { tags: { action: "creerContactManuelAction" } });
    return { ok: false, erreur: "echec", message: "L'enregistrement a échoué. Réessaie." };
  }
}
