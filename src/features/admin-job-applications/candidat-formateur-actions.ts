"use server";

/**
 * « Ajouter un candidat formateur » — Server Action de la console (lot L0c-3).
 *
 * Calque de la saisie manuelle des apporteurs (`commercial-application/
 * saisie-manuelle-actions.ts`), avec ses trois règles :
 *   1. aucun envoi automatique : seule l'invitation F1 part, et seulement si
 *      la case est cochée — par le module d'envoi des formateurs, qui exige le
 *      texte validé et applique oppositions et liste de suppression ;
 *   2. le consentement n'est pas simulé : `consentVersion` dit « saisie en
 *      console, sans consentement », jamais une version de formulaire ;
 *   3. l'ajout est atomique (fiche + journal, une transaction) et idempotent :
 *      même adresse + même offre = on retrouve la fiche, sans rien écraser —
 *      par l'empreinte, sauf pour une adresse relais, qui n'identifie personne.
 *
 * Livré ÉTEINT : `formateurs.ajout_console` absent = refus, rien n'est écrit.
 * Réservé à l'administrateur (direction).
 */

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { adminPath } from "@/lib/admin-path";
import { lienDuSite } from "@/lib/calendly/lien-du-site";
import { SLUG_OFFRE_FORMATEUR_FREELANCE } from "@/lib/careers/formateur-freelance";
import { preparerSaisieCandidatFormateur } from "@/lib/careers/candidat-formateur-console";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { envoyer, texteValide } from "@/server/qualiopi/formateurs-independants/envois";
import { ORIGINES_CANDIDAT_FORMATEUR } from "@/lib/careers/candidat-formateur-console";

/** Marque de consentement d'une candidature saisie en console (≤ 40 caractères). */
const CONSENT_CONSOLE = "console-sans-consentement";
const ROLES_AJOUT: ReadonlyArray<string> = ["super_admin", "admin"];

export type EtatAjoutCandidatFormateur =
  { ok: true; id: string; message: string } | { ok: false; message: string };

export async function ajouterCandidatFormateurAction(
  payload: unknown,
): Promise<EtatAjoutCandidatFormateur> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const adminId = session?.user?.id;
  if (!adminId || !role || !ROLES_AJOUT.includes(role)) {
    return {
      ok: false,
      message: "Ajouter un candidat est réservé à la direction (administrateur).",
    };
  }
  if (!(await lireEtatsEntree()).ajout_console) {
    return { ok: false, message: "Cette fonction n'est pas encore ouverte." };
  }
  const p = preparerSaisieCandidatFormateur(payload);
  if (!p.ok) return { ok: false, message: p.message };
  const d = p.saisie;
  const emailHash = p.empreinteSur ? hashEmailForLookup(p.empreinteSur) : null;
  // L'invitation se vérifie AVANT d'écrire (comme le lien chez les apporteurs) :
  // une fiche créée sans son invitation ne se rattrape pas ici.
  if (d.envoyerInvitation && !(await texteValide("formateur-invitation-echange"))) {
    return {
      ok: false,
      message:
        "Le texte de l'invitation n'est pas encore validé : décochez « Envoyer l'invitation » pour ajouter le candidat sans message.",
    };
  }

  try {
    const offre = await prisma.jobOffer.findFirst({
      where: { slug: SLUG_OFFRE_FORMATEUR_FREELANCE },
      select: { id: true, titleFr: true },
    });
    const offerId = offre?.id ?? null;
    // Recherche du doublon, fiche et journal dans UNE transaction : une erreur
    // à mi-chemin n'écrit rien (pas de fiche sans son journal), et un second
    // envoi retrouve la fiche au lieu d'en créer une deuxième. Sérialisable :
    // deux envois simultanés ne créent pas deux fiches (l'un échoue, son
    // renvoi retrouve l'autre). Adresse relais : pas d'empreinte, donc pas
    // de recherche — elle n'identifie personne.
    const resultat = await prisma.$transaction(
      async (tx) => {
        if (emailHash) {
          const existant = await tx.jobApplication.findFirst({
            where: { emailHash },
            select: { id: true, offerId: true, origine: true, invitationFormateurAt: true },
          });
          if (existant) {
            return (existant.offerId ?? null) === offerId
              ? ({ genre: "retrouvee", fiche: existant } as const)
              : ({ genre: "autre-offre" } as const);
          }
        }
        const cree = await tx.jobApplication.create({
          data: {
            offerId,
            offerTitleSnap: (offre?.titleFr ?? "Formateur IA indépendant").slice(0, 160),
            firstName: encryptPii(d.prenom),
            lastName: encryptPii(d.nom),
            email: encryptPii(p.adresseEnvoi),
            emailHash,
            phone: encryptPii(d.telephone ?? ""),
            consentVersion: CONSENT_CONSOLE,
            locale: "fr",
            natureCollaboration: "freelance",
            origine: "console",
            // L'origine saisie n'est PAS une provenance mesurée : elle ne va pas dans
            // `utm*` (bilan de provenance), mais dans les réponses lisibles en console.
            answers: {
              "Origine (saisie en console)":
                ORIGINES_CANDIDAT_FORMATEUR.find((o) => o.id === d.origine)?.libelle ?? d.origine,
            },
          },
          select: { id: true },
        });
        await tx.activityLog.create({
          data: {
            adminUserId: adminId,
            action: "formateurs.candidat_ajoute",
            targetType: "job_application",
            targetId: cree.id,
            changes: {
              origine: d.origine,
              relais: p.relais,
              invitation: d.envoyerInvitation,
            } as never,
          },
        });
        return { genre: "creee", id: cree.id } as const;
      },
      { isolationLevel: "Serializable" },
    );

    if (resultat.genre === "autre-offre") {
      return {
        ok: false,
        message: "Une candidature existe déjà pour cette adresse : ouvrez-la plutôt.",
      };
    }

    // Fiche retrouvée : rien n'est écrit, ni écrasé, ni supprimé. Seule exception,
    // la reprise d'une invitation demandée mais jamais partie sur une fiche posée
    // par la console : l'envoi est gardé par sa clé (`fi-f1-<id>`), il ne part pas
    // deux fois.
    const retrouvee = resultat.genre === "retrouvee";
    const id = retrouvee ? resultat.fiche.id : resultat.id;
    const inviter =
      d.envoyerInvitation &&
      (!retrouvee ||
        (resultat.fiche.origine === "console" && resultat.fiche.invitationFormateurAt === null));

    let message = retrouvee
      ? "Ce candidat existe déjà (même adresse, même offre) : sa fiche est retrouvée, rien n'a été modifié."
      : "Candidat ajouté.";
    const debut = retrouvee ? "Fiche retrouvée" : "Candidat ajouté";
    if (inviter) {
      try {
        const r = await envoyer({
          gabarit: "formateur-invitation-echange",
          destinataire: p.adresseEnvoi,
          payload: {
            prenom: d.prenom,
            lien: lienDuSite("formateur", { depuis: `fa-${id}` }),
          },
          entityType: "JobApplication",
          entityId: id,
          jobId: `fi-f1-${id}`,
        });
        if (r === "envoye" || r === "en-validation") {
          await prisma.jobApplication.update({
            where: { id },
            data: { invitationFormateurAt: new Date() },
          });
          message = `${debut}, invitation envoyée.`;
        } else if (r === "texte-non-valide") {
          message = `${debut}. L'invitation n'est pas partie : son texte n'est pas encore validé.`;
        } else if (r === "retenu") {
          message = `${debut}. L'invitation n'est pas partie : cette adresse s'est opposée aux envois.`;
        } else {
          message = `${debut}. L'invitation n'est pas partie : réessayez plus tard.`;
        }
      } catch (err) {
        // La fiche est posée : une panne d'envoi ne la fait pas passer pour un échec.
        Sentry.captureException(err, { tags: { action: "ajouterCandidatFormateurAction.envoi" } });
        message = `${debut}. L'invitation n'est pas partie : réessayez plus tard.`;
      }
    }
    revalidatePath(adminPath("fr", "contacts/candidatures"));
    return { ok: true, id, message };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "ajouterCandidatFormateurAction" } });
    return { ok: false, message: "L'ajout n'a pas été enregistré (erreur technique). Réessayez." };
  }
}
