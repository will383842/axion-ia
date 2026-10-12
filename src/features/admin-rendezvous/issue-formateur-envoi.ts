// L'ISSUE DE L'ÉCHANGE FORMATEUR — la logique serveur (lot F-CAL-2).
//
// Famille `formateur` du module commun (`issue-echange.ts`, FAC-7) : mêmes cinq issues,
// même rangement dans `rendez_vous_suivis`, mêmes règles « une fois par personne » et
// « deuxième absence : plus de nouveau créneau ». Ce qui lui est propre :
//   · la personne est une CANDIDATURE (`JobApplication`), reliée à ses autres
//     candidatures par l'empreinte d'adresse ;
//   · les e-mails partent par l'adaptateur des formateurs (`envois.ts`) : texte validé
//     par Will, sinon rien ;
//   · « Retenu » (F5) porte le lien du dossier en ligne : interrupteur `dossier_en_ligne`
//     coupé, F5 ne part pas, et l'écran le dit. Allumé, l'enregistrement OUVRE le dossier
//     de la fiche créée puis envoie F5 avec son lien (`ouverture-dossier.ts`, lot B) ;
//     l'aperçu montre le même e-mail, le lien personnel n'étant fabriqué qu'à l'ouverture.
//
// L'aperçu et l'enregistrement passent par `preparerIssueFormateur` : ce que Will a vu
// est, au caractère près, ce qui part.
//
// Ce module n'est PAS `"use server"`.

import { lienDuSite } from "@/lib/calendly/lien-du-site";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { estEchangeFormateur } from "@/server/calendly/echange-formateur";
import type { GabaritFormateur } from "@/server/qualiopi/formateurs-independants/envois";
import { lireDrapeauEnvoi } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { lireEtatsInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-etat";

import { GABARITS_ISSUE_PAR_FAMILLE, gabaritDeLIssue, type IssueEchange } from "./issue-echange";

export type GabaritIssueFormateur =
  (typeof GABARITS_ISSUE_PAR_FAMILLE.formateur)[keyof typeof GABARITS_ISSUE_PAR_FAMILLE.formateur];

export type PreparationIssueFormateur =
  | { ok: false; message: string }
  | {
      ok: true;
      calendlyEventId: string;
      /** La candidature rattachée à l'échange. */
      candidatureId: string;
      /** Les candidatures de la même personne (empreinte d'adresse). */
      lignes: string[];
      absencesAnterieures: number;
      envoi: {
        gabarit: GabaritIssueFormateur & GabaritFormateur;
        destinataire: string;
        payload: Record<string, unknown>;
        jobId: string;
        /** F5 : l'enregistrement ouvre d'abord le dossier, puis envoie avec son vrai lien. */
        ouvreDossier?: true;
      } | null;
      sansEmail: string | null;
    };

export const MESSAGE_SANS_DOSSIER =
  "Le dossier en ligne n'est pas encore ouvert : l'e-mail « la suite » partira quand il le sera.";

export const MESSAGE_DOSSIER_DEJA_OUVERT =
  "Le dossier de cette personne est déjà ouvert : renvoyez son lien depuis sa fiche formateur.";

/** Le lien montré par l'aperçu de F5 : le vrai, personnel, n'existe qu'à l'ouverture. */
export const LIEN_DOSSIER_APERCU = "https://axion-ia.com/formateur/dossier/…";

/** Le dernier envoi de ce gabarit à ces candidatures (parti, en file ou en validation). */
export async function dernierEnvoiIssueFormateur(
  gabarit: string,
  lignes: readonly string[],
): Promise<Date | null> {
  const [journal, corbeille] = await Promise.all([
    prisma.emailLog.findFirst({
      where: {
        template: gabarit,
        entityType: "JobApplication",
        entityId: { in: [...lignes] },
        status: { in: ["pending", "sent"] },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailOutbox.findFirst({
      where: {
        template: gabarit,
        entityType: "JobApplication",
        entityId: { in: [...lignes] },
        statut: "a_valider",
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const dates = [journal?.createdAt, corbeille?.createdAt].filter((d): d is Date => !!d);
  return dates.length === 0 ? null : new Date(Math.max(...dates.map((d) => d.getTime())));
}

function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

/**
 * Lit l'échange, sa candidature et l'historique de la personne, et dit quel e-mail
 * l'issue ferait partir. N'écrit rien. Lève si la base ne répond pas.
 */
export async function preparerIssueFormateur(input: {
  calendlyEventId: string;
  issue: IssueEchange;
}): Promise<PreparationIssueFormateur> {
  const rdv = await prisma.calendlyEvent.findUnique({
    where: { id: input.calendlyEventId },
    select: {
      id: true,
      eventTypeName: true,
      typeRendezVous: true,
      linkedJobApplicationId: true,
      status: true,
      startTime: true,
    },
  });
  if (!rdv) return { ok: false, message: "Rendez-vous introuvable." };
  if (!estEchangeFormateur(rdv)) {
    return { ok: false, message: "Ce rendez-vous n'est pas un échange formateur." };
  }
  // Le point se fait une fois l'échange commencé, jamais sur un échange annulé — relu ici,
  // pas seulement par la page : un formulaire forgé ne note pas « Absent » à l'avance.
  if (rdv.status === "canceled" || !rdv.startTime || rdv.startTime > new Date()) {
    return { ok: false, message: "L'issue se note après l'échange, jamais sur un échange annulé." };
  }
  if (!rdv.linkedJobApplicationId) {
    return {
      ok: false,
      message: "Rattachez d'abord cet échange à la candidature de la personne.",
    };
  }
  const candidature = await prisma.jobApplication.findUnique({
    where: { id: rdv.linkedJobApplicationId },
    select: { id: true, email: true, emailHash: true, firstName: true },
  });
  if (!candidature) return { ok: false, message: "Candidature introuvable." };

  let destinataire: string;
  let prenom: string;
  try {
    destinataire = decryptPii(candidature.email).trim();
    prenom = decryptPii(candidature.firstName).trim();
  } catch {
    return { ok: false, message: "Les coordonnées de la candidature ne se déchiffrent pas." };
  }
  const efface =
    !destinataire || destinataire.endsWith("@erased.local") || destinataire === ERASED_PLACEHOLDER;

  const empreinte = candidature.emailHash ?? hashEmailForLookup(destinataire);
  const autres = empreinte
    ? await prisma.jobApplication.findMany({
        where: { emailHash: empreinte },
        select: { id: true },
        take: 20,
      })
    : [];
  const lignes = [...new Set([candidature.id, ...autres.map((a) => a.id)])];

  const absencesAnterieures = await prisma.rendezVousSuivi.count({
    where: {
      issue: "absent",
      calendlyEventId: { not: rdv.id },
      calendlyEvent: { linkedJobApplicationId: { in: lignes } },
    },
  });

  const base = {
    ok: true as const,
    calendlyEventId: rdv.id,
    candidatureId: candidature.id,
    lignes,
    absencesAnterieures,
  };
  const gabarit = gabaritDeLIssue(
    GABARITS_ISSUE_PAR_FAMILLE.formateur,
    input.issue,
    absencesAnterieures,
  );
  if (!gabarit) {
    const sansEmail =
      input.issue === "absent" ? "Deuxième absence : aucun nouveau créneau n'est proposé." : null;
    return { ...base, envoi: null, sansEmail };
  }
  if (efface) return { ...base, envoi: null, sansEmail: "La candidature a été effacée." };
  // F5 porte le lien du dossier : aucun tant que le dossier en ligne est coupé.
  if (gabarit === GABARITS_ISSUE_PAR_FAMILLE.formateur.retenu) {
    if (!lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "dossier_en_ligne")) {
      return { ...base, envoi: null, sansEmail: MESSAGE_SANS_DOSSIER };
    }
    // Une fiche de cette personne au dossier déjà ouvert : jamais rouvert par ce geste.
    const ouvert = await prisma.trainer.findFirst({
      where: {
        dossierStatut: { not: null },
        OR: [{ candidatureId: { in: lignes } }, { candidatures: { some: { id: { in: lignes } } } }],
      },
      select: { id: true },
    });
    if (ouvert) return { ...base, envoi: null, sansEmail: MESSAGE_DOSSIER_DEJA_OUVERT };
    return {
      ...base,
      envoi: {
        gabarit,
        destinataire,
        payload: {
          ...(prenom && prenom !== ERASED_PLACEHOLDER ? { prenom } : {}),
          lien: LIEN_DOSSIER_APERCU,
        },
        // Indicatif : l'envoi réel porte la clé de la fiche (`fi-issue-retenu-<id>`).
        jobId: `formateur-issue-${gabarit}-${empreinte ?? candidature.id}`,
        ouvreDossier: true,
      },
      sansEmail: null,
    };
  }
  const deja = await dernierEnvoiIssueFormateur(gabarit, lignes);
  if (deja) {
    return { ...base, envoi: null, sansEmail: `Cet e-mail est déjà parti le ${jourMois(deja)}.` };
  }

  const payload: Record<string, unknown> = {
    ...(prenom && prenom !== ERASED_PLACEHOLDER ? { prenom } : {}),
    ...(gabarit === GABARITS_ISSUE_PAR_FAMILLE.formateur.absent
      ? { lien: lienDuSite("formateur", { depuis: `fa-${candidature.id}` }) }
      : {}),
  };
  return {
    ...base,
    envoi: {
      gabarit,
      destinataire,
      payload,
      // Une fois par personne : la même clé pour toutes ses candidatures.
      jobId: `formateur-issue-${gabarit}-${empreinte ?? candidature.id}`,
    },
    sansEmail: null,
  };
}
