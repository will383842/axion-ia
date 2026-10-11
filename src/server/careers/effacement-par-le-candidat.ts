/**
 * EFFACEMENT D'UNE CANDIDATURE PAR LE CANDIDAT LUI-MÊME — décision de Will,
 * responsable de traitement, 2026-10-11.
 *
 * Le candidat clique « Supprimer ma candidature » au pied d'un de nos e-mails,
 * voit le poste concerné, confirme : son dossier est effacé, sans écrire à
 * contact@ et sans geste de l'équipe.
 *
 * ## 🔴 Lire n'efface jamais
 *
 * `lireDemandeEffacement` (appelée par la page, en GET) ne fait que lire. Les
 * antivirus de messagerie pré-chargent les liens : un effacement au GET
 * détruirait des dossiers sans que personne n'ait cliqué. Seule
 * `effacerCandidatureParLeCandidat`, appelée par l'action serveur après le
 * clic sur le bouton, efface — c'est le raisonnement de `appel/annuler`.
 *
 * ## L'ordre de l'effacement
 *
 * Le même que la console (`deleteApplicationAction`) et la purge à 24 mois :
 * les FICHIERS d'abord (CV, photo, vidéos), puis la ligne, dont la cascade
 * emporte le journal, les réponses, les entretiens et les liens. Effacer la
 * ligne d'abord laisserait des fichiers que plus rien ne désigne.
 *
 * ## Ce qui n'est pas effaçable par ce lien
 *
 * 🛑 Une personne RECRUTÉE (`hired`) : son dossier est une pièce du dossier du
 * personnel, la notice le dit. Le lien l'invite à écrire. Le contrôle est
 * refait DANS la suppression (`status: { not: "hired" }`), pas seulement à la
 * lecture.
 *
 * ## Ce que l'équipe en sait
 *
 * Une ligne au journal d'activité (`jobapplication.self_erased`, l'identifiant
 * de la candidature, rien d'autre) et une alerte Telegram au salon des
 * candidatures avec le seul intitulé du poste. Ni nom, ni adresse, ni IP.
 *
 * Hors périmètre, volontairement : le CRM, les dossiers d'apporteurs
 * (`Submission`) et le self-service RGPD par adresse e-mail.
 */

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { deleteCv } from "@/server/careers/cv-storage";
import { supprimerVideosCandidature } from "@/server/careers/videos-candidat";
import { verifyEffacementCandidatureToken } from "@/server/vivier/token";

/** Action consignée au journal d'activité. */
export const ACTION_JOURNAL = "jobapplication.self_erased";

/** Au plus 10 confirmations par heure et par adresse IP. */
const QUOTA = { limit: 10, windowSec: 3600, surPanne: "laisser-passer" } as const;

/**
 * Ce que la page peut afficher.
 *
 * `neutre` couvre ensemble le jeton absent, falsifié, expiré, d'une autre
 * finalité ET le dossier introuvable : la page ne doit jamais révéler si un
 * dossier existe.
 */
export type LectureEffacement =
  { etat: "neutre" } | { etat: "recrute" } | { etat: "pret"; poste: string };

export async function lireDemandeEffacement(
  jeton: string | null | undefined,
): Promise<LectureEffacement> {
  const verifie = await verifyEffacementCandidatureToken(jeton);
  if (!verifie.ok) return { etat: "neutre" };

  const dossier = await prisma.jobApplication.findUnique({
    where: { id: verifie.applicationId },
    select: { status: true, offerTitleSnap: true },
  });
  if (!dossier) return { etat: "neutre" };
  if (dossier.status === "hired") return { etat: "recrute" };
  return { etat: "pret", poste: dossier.offerTitleSnap };
}

/**
 * - `efface` : le dossier vient d'être effacé ;
 * - `deja` : jeton valide, dossier déjà absent (double clic, purge) ;
 * - `neutre` : jeton refusé ;
 * - `recrute` : personne recrutée, effacement refusé ;
 * - `trop_de_tentatives` : quota de l'adresse IP atteint.
 */
export type IssueEffacement = "efface" | "deja" | "neutre" | "recrute" | "trop_de_tentatives";

export async function effacerCandidatureParLeCandidat(
  jeton: string | null | undefined,
  contexte: { ip: string },
): Promise<IssueEffacement> {
  const quota = await checkRateLimit(`candidature-effacement:${contexte.ip}`, QUOTA);
  if (!quota.allowed) return "trop_de_tentatives";

  // 🔴 Le jeton est vérifié avant toute lecture et toute écriture.
  const verifie = await verifyEffacementCandidatureToken(jeton);
  if (!verifie.ok) return "neutre";
  const id = verifie.applicationId;

  const dossier = await prisma.jobApplication.findUnique({
    where: { id },
    select: {
      status: true,
      offerTitleSnap: true,
      cvStoragePath: true,
      photoStoragePath: true,
    },
  });
  if (!dossier) return "deja";
  if (dossier.status === "hired") return "recrute";

  // Fichiers d'abord, ligne ensuite — cf. en-tête.
  await deleteCv(dossier.cvStoragePath);
  await deleteCv(dossier.photoStoragePath);
  await supprimerVideosCandidature(id);

  // `deleteMany` et non `delete` : un double clic simultané ne lève pas
  // d'erreur (la seconde requête compte 0 ligne), et le statut est relu dans
  // la même instruction — un passage à `hired` entre-temps n'efface rien.
  const { count } = await prisma.jobApplication.deleteMany({
    where: { id, status: { not: "hired" } },
  });
  if (count === 0) return "deja";

  // La trace et l'alerte ne remettent pas l'effacement en cause : il a eu lieu.
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: ACTION_JOURNAL,
        targetType: "job_application",
        targetId: id,
      },
    });
  } catch (e) {
    console.warn(
      "[effacement-candidat] journal impossible :",
      e instanceof Error ? e.message : String(e),
    );
  }
  try {
    const { notify } = await import("@/server/notifications");
    await notify({
      category: "CANDIDAT_SELF_ERASED",
      payload: { offerTitle: dossier.offerTitleSnap, erasedAt: new Date().toISOString() },
    });
  } catch (e) {
    console.warn(
      "[effacement-candidat] notification impossible :",
      e instanceof Error ? e.message : String(e),
    );
  }

  return "efface";
}
