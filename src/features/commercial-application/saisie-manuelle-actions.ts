// SAISIE MANUELLE D'UN CONTACT APPORTEUR — Server Actions de la console.
//
// ── Le trou que ça bouche ─────────────────────────────────────────────────
// Six chemins créaient un contact, et TOUS SIX étaient des formulaires publics
// ou le chatbot. Aucun écran de la console ne permettait d'en saisir un.
//
// Conséquence : l'apporteur qui écrit par e-mail, celui rencontré sur un salon,
// celui repéré sur un site d'annonces — aucun ne pouvait entrer dans le
// système. On ne pouvait que lui envoyer un lien et espérer qu'il le remplisse.
//
// ── Trois règles, et elles ne sont pas négociables ────────────────────────
//
// 1. AUCUN ENVOI. Une personne saisie à la main n'a RIEN demandé : ni e-mail de
//    confirmation, ni rappels J+2 / J+7. Lui écrire « ton dossier t'attend »
//    serait un message non sollicité — et, pour un apporteur, un rappel
//    d'activité attendue (`docs/partners/ANTI-REQUALIFICATION.md`, motif 4).
//    Décision de Will du 2026-09-04 : rien ne part tant qu'il n'a pas validé
//    le fonctionnement.
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
  saisieManuelleSchema,
  type SaisieState,
  type TraceExistante,
} from "@/lib/commercial-application/saisie-manuelle";

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
 * ⛔ N'ENVOIE RIEN. Ni e-mail de confirmation, ni rappels. Voir l'en-tête.
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
          origine: "saisie-manuelle",
          origineSaisie: d.origine,
          ...(d.ville ? { ville: d.ville } : {}),
          ...(d.note ? { note: d.note } : {}),
          // 🔴 Le FAIT, écrit noir sur blanc : cette personne n'a rien accepté.
          // Fabriquer un `optin` qui n'a pas eu lieu serait pire que l'absence.
          consentement: "aucun — contact saisi par un administrateur",
          saisiPar: adminId,
          message:
            "Contact saisi manuellement depuis la console. Aucun e-mail ne lui a été envoyé.",
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
        changes: { origineSaisie: d.origine, contactEmailHash: empreinte, envoi: "aucun" },
      },
    });

    revalidatePath(adminPath("fr", "contacts/commercial"));
    return { ok: true, submissionId: submission.id };
  } catch (err) {
    console.error("[saisie-manuelle] échec:", err);
    Sentry.captureException(err, { tags: { action: "creerContactManuelAction" } });
    return { ok: false, erreur: "echec", message: "L'enregistrement a échoué. Réessaie." };
  }
}
