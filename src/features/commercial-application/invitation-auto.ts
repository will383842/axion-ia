// INVITATION AUTOMATIQUE, 15 MINUTES APRÈS LA CANDIDATURE (2026-09-28).
//
// Décision de Will du 28/09 : toute candidature d'apporteur d'affaires, et
// toute candidature à une offre d'emploi COMMERCIALE (catégorie `commercial`
// des offres de /carrieres), reçoit 15 minutes après sa réception
// l'invitation du tunnel apporteurs — « Ta candidature est retenue », le kit,
// le lien Calendly de l'échange de 15 minutes — puis les rappels J+3 / J+7
// habituels. C'est la même invitation que le bouton de la console : elle passe
// par `envoyerInvitationApporteur`, donc par toutes ses gardes (une seule
// invitation par personne, fiche effacée, opposition, envoi à valider).
//
// ── Resserré le 2026-09-29 (décision de Will) : DOSSIER COMPLET seulement ──
// Côté site, l'invitation ne part plus que pour le DOSSIER COMPLET (les neuf
// écrans de `/devenir-commercial-ia/candidature`), 15 minutes après sa
// réception. Le premier contact du formulaire court (`/apporteur-affaires`)
// et le contact capturé à l'écran 1 du dossier ne la déclenchent plus : ils
// gardent leur propre suite — kit + « complète ton dossier » + rappels
// J+2 / J+7 (`relances-lead-apporteur.ts`), annulés à l'arrivée du dossier.
//
// Le critère est POSITIF (`details.source` = chemin du dossier, sans
// `etape`) : une nouvelle sorte de fiche n'entre pas dans le champ par défaut.
// 🔑 Le dossier complet est TOUJOURS une nouvelle ligne (`actions.ts` fait un
// `create`, jamais un `update` du premier contact) : son `submittedAt` est
// donc l'heure de réception du DOSSIER, et la fenêtre de 72 h se compte à
// partir de lui — un premier contact vieux d'un mois qui finit son dossier
// aujourd'hui est invité.
//
// Inchangé : la candidature à une offre COMMERCIALE (fiche créée
// automatiquement, `creationAutomatique`), décision du 28/09.
//
// Hors champ, volontairement :
//   · la SAISIE MANUELLE de la console : elle a sa propre case « Envoyer
//     l'invitation », c'est Will qui choisit ;
//   · une fiche créée à la main depuis une candidature (« Proposer le réseau ») :
//     même raison ;
//   · une fiche que Will a déjà rangée, archivée ou mise à la corbeille.
//
// ── Pourquoi un BALAYAGE toutes les 5 minutes, et pas un job retardé ──────
// Même doctrine que les rappels (`relances-invitation-apporteur.ts`) : l'état
// vit en base, un passage manqué (worker redémarré) est repris par le suivant,
// et rien n'est à retirer d'une file si la fiche est effacée entre-temps. Le
// délai réel est donc de 15 à 20 minutes.
//
// ── Ce qui empêche un doublon ─────────────────────────────────────────────
//   · `details.invitationAuto` est posé sur la fiche après chaque tentative
//     définitive : la fiche n'est plus jamais reprise ;
//   · `envoyerInvitationApporteur` refuse de toute façon une seconde
//     invitation à la même PERSONNE (toutes ses fiches, par empreinte) ;
//   · une candidature à une offre ne crée qu'une fiche (`jobApplicationId`).
//
// ⚠️ Tourne dans le worker (tsx, hors Next) : aucun `server-only` ici ni dans
// ce que ce module importe.

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { estLienCalendlyValide } from "@/lib/calendly/lien-valide";
import { FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { ORIGINE_CANDIDATURE_OFFRE } from "@/lib/contact/accuse-attendu";
import { DOSSIER_COMPLET_PATH } from "@/lib/commercial-application/lead-apporteur";
import { envoyerInvitationApporteur } from "./invitation-apporteur";
import { creerFicheApporteurDepuisCandidature } from "@/features/admin-job-applications/fiche-apporteur-depuis-candidature";
import { consignerEvenement } from "@/features/admin-job-applications/journal";

/** Délai entre la réception et l'invitation (décision Will). */
export const DELAI_INVITATION_AUTO_MS = 15 * 60_000;

/**
 * Rien de reçu avant cette date n'est repris : les candidatures plus
 * anciennes ont été traitées à la main (58 invitations le 27/09). Le 28/09 est
 * inclus — les candidatures arrivées ce jour-là attendaient encore.
 */
export const DEBUT_INVITATION_AUTO = new Date("2026-09-28T00:00:00+02:00");

/** Au-delà, une fiche non reprise est laissée à la console : on n'écrit pas « 15 minutes » trois jours après. */
export const FENETRE_INVITATION_AUTO_MS = 72 * 3600_000;

/** Catégorie des offres de /carrieres dont les candidats entrent dans le tunnel. */
export const CATEGORIE_OFFRE_COMMERCIALE = "commercial" as const;

/** Échecs PASSAGERS : la fiche n'est pas marquée, le passage suivant réessaie. */
const ERREURS_PASSAGERES = new Set(["file-indisponible", "historique-illisible"]);

const MAX_PAR_PASSAGE = 50;

export interface CompteRenduInvitationsAuto {
  readonly suspendu?: "lien-absent";
  readonly fichesCreees: number;
  readonly envoyees: number;
  readonly ecartees: Record<string, number>;
  readonly aReessayer: number;
}

export function lienReservationAuto(): string | null {
  const url = process.env["CALENDLY_APPORTEUR_URL"]?.trim();
  return url && estLienCalendlyValide(url) ? url : null;
}

/** Une fiche est-elle à inviter automatiquement ? Lecture défensive, pure. */
export function ficheEligible(details: unknown): boolean {
  const d =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : null;
  if (!d) return false;
  if (d["invitationAuto"] !== undefined) return false;
  // Candidature à une offre commerciale : seule la fiche créée par le passage
  // automatique est reprise (« Proposer le réseau » reste un geste de Will).
  if (d["origine"] === ORIGINE_CANDIDATURE_OFFRE) return d["creationAutomatique"] === true;
  // Fiche du site : le DOSSIER COMPLET, et lui seul (décision du 29/09). Le
  // premier contact et l'écran 1 portent `etape` ; la saisie manuelle et les
  // fiches importées n'ont pas cette source.
  return d["source"] === DOSSIER_COMPLET_PATH && d["etape"] === undefined;
}

type Issue = "envoyee" | "en-validation" | string;

/** Invite une fiche et la marque. Rend l'issue, ou `null` si l'échec est passager. */
async function inviter(submissionId: string, calendlyUrl: string): Promise<Issue | null> {
  const r = await envoyerInvitationApporteur({ submissionId, calendlyUrl, adminId: null });
  const issue: Issue = r.ok ? (r.enValidation ? "en-validation" : "envoyee") : r.erreur;
  if (!r.ok && ERREURS_PASSAGERES.has(r.erreur)) return null;
  // Relu juste avant d'écrire : l'envoi a pu toucher la fiche (statut).
  const fraiche = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { details: true },
  });
  const details =
    fraiche?.details && typeof fraiche.details === "object" && !Array.isArray(fraiche.details)
      ? (fraiche.details as Record<string, unknown>)
      : {};
  await prisma.submission.update({
    where: { id: submissionId },
    data: { details: { ...details, invitationAuto: { le: new Date().toISOString(), issue } } },
  });
  return issue;
}

export async function passerInvitationsAuto(
  maintenant: Date = new Date(),
): Promise<CompteRenduInvitationsAuto> {
  const ecartees: Record<string, number> = {};
  const calendlyUrl = lienReservationAuto();
  if (!calendlyUrl) {
    console.warn(
      "[invitation-auto] CALENDLY_APPORTEUR_URL absent ou invalide : aucune invitation automatique ne part.",
    );
    return { suspendu: "lien-absent", fichesCreees: 0, envoyees: 0, ecartees, aReessayer: 0 };
  }

  const jusqua = new Date(maintenant.getTime() - DELAI_INVITATION_AUTO_MS);
  const depuis = new Date(
    Math.max(DEBUT_INVITATION_AUTO.getTime(), maintenant.getTime() - FENETRE_INVITATION_AUTO_MS),
  );
  let fichesCreees = 0;
  let envoyees = 0;
  let aReessayer = 0;
  const compter = (issue: Issue) => {
    if (issue === "envoyee" || issue === "en-validation") envoyees++;
    else ecartees[issue] = (ecartees[issue] ?? 0) + 1;
  };

  // ── 1. Candidatures aux offres COMMERCIALES → fiche apporteur + invitation.
  const candidatures = await prisma.jobApplication.findMany({
    where: {
      submittedAt: { gte: depuis, lte: jusqua },
      status: { not: "rejected" },
      offer: { category: CATEGORIE_OFFRE_COMMERCIALE },
    },
    select: { id: true },
    orderBy: { submittedAt: "asc" },
    take: MAX_PAR_PASSAGE,
  });
  for (const c of candidatures) {
    try {
      const creation = await creerFicheApporteurDepuisCandidature({
        applicationId: c.id,
        acteurId: null,
        automatique: true,
        message:
          "Fiche créée automatiquement depuis une candidature à une offre d'emploi commerciale. Invitation à l'échange de 15 minutes envoyée automatiquement.",
      });
      if (!creation.ok) {
        // Doublon : la personne est déjà dans le tunnel, sa fiche suit son cours.
        ecartees[`candidature-${creation.erreur}`] =
          (ecartees[`candidature-${creation.erreur}`] ?? 0) + 1;
        continue;
      }
      if (creation.deja) continue; // traitée par un passage précédent
      fichesCreees++;
      const issue = await inviter(creation.submissionId, calendlyUrl);
      if (issue === null) {
        aReessayer++; // la fiche porte `creationAutomatique` : l'étape 2 la reprendra
        continue;
      }
      compter(issue);
      try {
        await consignerEvenement({
          applicationId: c.id,
          type: "note",
          authorId: null,
          authorName: "Envoi automatique",
          summary:
            issue === "envoyee" || issue === "en-validation"
              ? "Réseau d'apporteurs proposé automatiquement — invitation à l'échange de 15 minutes envoyée"
              : `Réseau d'apporteurs : fiche créée automatiquement, invitation non envoyée (${issue})`,
          body: "Fiche apporteur créée dans Contacts › Commercial.",
          meta: { geste: "reseau-apporteurs-auto", submissionId: creation.submissionId, issue },
        });
      } catch (err) {
        Sentry.captureException(err, { tags: { action: "invitation-auto", step: "journal" } });
      }
    } catch (err) {
      aReessayer++;
      Sentry.captureException(err, { tags: { action: "invitation-auto", step: "candidature" } });
    }
  }

  // ── 2. Dossiers complets reçus (et fiches d'offre à reprendre) → invitation.
  // Le filtre `source` / `creationAutomatique` est posé EN BASE aussi : sans
  // lui, les premiers contacts de la fenêtre occuperaient les places du `take`.
  const fiches = await prisma.submission.findMany({
    where: {
      AND: [
        ...FILTRE_APPORTEUR_PRISMA.AND,
        {
          OR: [
            { details: { path: ["source"], equals: DOSSIER_COMPLET_PATH } },
            { details: { path: ["creationAutomatique"], equals: true } },
          ],
        },
      ],
      submittedAt: { gte: depuis, lte: jusqua },
      deletedAt: null,
      archivedAt: null,
      status: { in: ["new", "in_progress"] },
    },
    select: { id: true, details: true },
    orderBy: { submittedAt: "asc" },
    take: MAX_PAR_PASSAGE * 2,
  });
  for (const f of fiches) {
    if (!ficheEligible(f.details)) continue;
    try {
      const issue = await inviter(f.id, calendlyUrl);
      if (issue === null) aReessayer++;
      else compter(issue);
    } catch (err) {
      aReessayer++;
      Sentry.captureException(err, { tags: { action: "invitation-auto", step: "fiche" } });
    }
  }

  return { fichesCreees, envoyees, ecartees, aReessayer };
}
