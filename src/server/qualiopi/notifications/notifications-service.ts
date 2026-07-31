/**
 * Qualiopi — Service d'envoi d'emails transactionnels lifecycle (T15).
 *
 * Fonctions exportées :
 *   envoyerConvocation        : enrollment confirmé → qualiopi-convocation
 *   envoyerRappelJ7           : session J-7 → qualiopi-rappel-j7 (par enrollment)
 *   envoyerSatisfactionJ1     : session réalisée J+1 → qualiopi-satisfaction-j1
 *   envoyerSuiviJ30           : session réalisée J+30 → qualiopi-suivi-j30
 *   envoyerAttestationDisponible : attestation générée → qualiopi-attestation-disponible
 *   notifierAlerteInterne     : alerte système → qualiopi-alerte-interne (équipe interne)
 *
 * Idempotence : clé jobId = `qualiopi-{type}-{entityId}-{dateKey}` pour éviter
 * les doublons en cas de re-scan cron. BullMQ accepte un `jobId` fixe → un seul
 * job en attente par clé (le second add est ignoré si le premier est toujours
 * en pending/active).
 *
 * Stub-aware : si DATABASE_URL inclut "stub.invalid", toute lecture Prisma est
 * short-circuitée par le proxy (renvoie null) → early-exit propre.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { creerTokenInscription } from "@/server/qualiopi/emargement/token-service";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import { creerAcces } from "@/server/qualiopi/portail/portail-service";
import { creerQuestionnaire } from "@/server/qualiopi/satisfaction/satisfaction-service";
import { AttestationResultat } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isStub(): boolean {
  return Boolean(process.env["DATABASE_URL"]?.includes("stub.invalid"));
}

/** Formate une Date en "DD/MM/YYYY" (affichage email). */
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Clé de date quotidienne pour l'idempotence (format YYYYMMDD). */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Retourne un lien portail tokenisé pour le stagiaire.
 *
 * - Réutilise un accès non-révoqué et non-expiré si disponible (idempotent).
 * - Sinon crée un nouvel accès (90 j) via creerAcces.
 * - Fail-soft : si la création échoue, retombe sur la route directe /portail/mon-espace.
 *
 * Format retourné : `${baseUrl}/fr/portail/acces/${token}`
 */
/**
 * Lien d'émargement personnel pour le rappel J-7 — créé SEULEMENT si aucun
 * jeton vivant n'existe pour cette inscription.
 *
 * 🔴 Pourquoi cette prudence : un jeton d'émargement ne se relit jamais (seul
 * son hash est en base) et toute création RÉVOQUE le précédent (index unique
 * partiel). Créer aveuglément ici tuerait donc un lien déjà distribué — par la
 * console (« Émettre les liens ») ou par un envoi précédent — et le stagiaire
 * cliquerait un lien mort le jour de la session. La règle : l'e-mail n'inclut
 * un lien QUE s'il est le premier à en mettre un en circulation ; sinon il
 * n'en parle pas (le lien existant reste le seul valide).
 *
 * Fail-soft assumé : si la session n'a pas ses journées confirmées
 * (`TokenEmargementError`), le rappel part SANS lien plutôt que de ne pas
 * partir — retenir un rappel J-7 casserait l'obligation d'information, et la
 * console signale déjà les journées non confirmées à l'admin.
 */
async function getLienEmargementSiPremier(
  enrollmentId: string,
  dateFinSession: Date,
  baseUrl: string,
): Promise<string | null> {
  try {
    const actif = await prisma.emargementToken.findFirst({
      where: { enrollmentId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (actif) return null;
    const { token } = await creerTokenInscription({ enrollmentId, dateFinSession });
    return `${baseUrl}/fr/portail/emarger/${token}`;
  } catch {
    return null;
  }
}

async function getOrCreatePortailLien(traineeId: string, baseUrl: string): Promise<string> {
  const fallback = `${baseUrl}/fr/portail/mon-espace`;
  try {
    // Recherche un accès valide existant (non-révoqué, non-expiré)
    const acces = await prisma.portailAcces.findFirst({
      where: {
        traineeId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: "desc" },
      select: { token: true },
    });
    const token = acces?.token ?? (await creerAcces(traineeId)).token;
    return `${baseUrl}/fr/portail/acces/${token}`;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// envoyerConvocation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie la convocation officielle au stagiaire lors de la confirmation
 * de son inscription (enrollment). Idempotent : jobId fixe par enrollmentId.
 */
export async function envoyerConvocation(enrollmentId: string): Promise<void> {
  if (isStub()) return;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, email: true, nom: true, prenom: true } },
      session: {
        select: {
          numero: true,
          titreSession: true,
          dateDebut: true,
          dateFin: true,
          modalite: true,
          lieuType: true,
          lieuIntitule: true,
          lieuAdresse: true,
          lieuCodePostal: true,
          lieuVille: true,
          lieuSalle: true,
          lieuVisioUrl: true,
        },
      },
    },
  });

  if (!enrollment) return;

  const { trainee, session } = enrollment;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const lienPortail = await getOrCreatePortailLien(trainee.id, baseUrl);

  await enqueueEmail(
    "qualiopi-convocation",
    trainee.email,
    "fr",
    {
      stagiairePrenomNom: `${trainee.prenom} ${trainee.nom}`,
      titreFormation: session.titreSession,
      dateDebut: fmtDate(session.dateDebut),
      dateFin: fmtDate(session.dateFin),
      lieu: formatLieu(session) ?? "Voir convocation",
      modalite: session.modalite,
      numeroSession: session.numero,
      lienPortail,
    },
    { jobId: `qualiopi-convocation-${enrollmentId}` },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// envoyerRappelJ7
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie un rappel J-7 à tous les stagiaires inscrits à une session.
 * Idempotent : jobId = qualiopi-rappel-j7-{enrollmentId}-{dateKey(dateDebut)}.
 */
export async function envoyerRappelJ7(sessionId: string): Promise<void> {
  if (isStub()) return;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      modalite: true,
      lieuType: true,
      lieuIntitule: true,
      lieuAdresse: true,
      lieuCodePostal: true,
      lieuVille: true,
      lieuSalle: true,
      lieuVisioUrl: true,
      enrollments: {
        where: { statut: { in: ["planifiee", "presente"] } },
        select: {
          id: true,
          trainee: { select: { id: true, email: true, nom: true, prenom: true } },
        },
      },
    },
  });

  if (!session) return;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const dk = dateKey(session.dateDebut);

  for (const enrollment of session.enrollments) {
    const { trainee } = enrollment;
    try {
      const lienPortail = await getOrCreatePortailLien(trainee.id, baseUrl);
      // Lien de signature de présence — demandé par Will (2026-07-31) : compter
      // sur le formateur pour distribuer les liens en salle, c'est un oubli
      // garanti à l'échelle. Chaque stagiaire reçoit le sien D'AVANCE ; le mode
      // groupe de l'espace formateur reste le filet en salle.
      const lienEmargement = await getLienEmargementSiPremier(
        enrollment.id,
        session.dateFin,
        baseUrl,
      );
      await enqueueEmail(
        "qualiopi-rappel-j7",
        trainee.email,
        "fr",
        {
          stagiairePrenomNom: `${trainee.prenom} ${trainee.nom}`,
          titreFormation: session.titreSession,
          dateDebut: fmtDate(session.dateDebut),
          dateFin: fmtDate(session.dateFin),
          lieu: formatLieu(session) ?? "Voir convocation",
          modalite: session.modalite,
          numeroSession: session.numero,
          lienPortail,
          ...(lienEmargement !== null ? { lienEmargement } : {}),
        },
        { jobId: `qualiopi-rappel-j7-${enrollment.id}-${dk}` },
      );
    } catch (err) {
      // Fail-soft : une erreur d'enqueue ne bloque pas les autres stagiaires
      console.error(
        `[notifications] rappel-j7: erreur enrollment ${enrollment.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// envoyerSatisfactionJ1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie le questionnaire de satisfaction J+1 à un stagiaire.
 * Idempotent : jobId = qualiopi-satisfaction-j1-{enrollmentId}-{dateKey(dateFin)}.
 */
export async function envoyerSatisfactionJ1(enrollmentId: string): Promise<void> {
  if (isStub()) return;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, email: true, nom: true, prenom: true } },
      session: {
        select: {
          numero: true,
          titreSession: true,
          dateFin: true,
        },
      },
    },
  });

  if (!enrollment) return;

  // Garantit le questionnaire AVANT l'email (idempotent) : sans lui, le stagiaire
  // arriverait sur un portail vide. Échec → throw : le cron fail-soft par
  // enrollment loggera et re-tentera au scan suivant (pas d'email orphelin).
  await creerQuestionnaire({ enrollmentId, type: "satisfaction_chaud" });

  const { trainee, session } = enrollment;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  // Le stagiaire arrive authentifié dans mon-espace où le questionnaire est listé.
  const lienQuestionnaire = await getOrCreatePortailLien(trainee.id, baseUrl);
  const dk = dateKey(session.dateFin);

  await enqueueEmail(
    "qualiopi-satisfaction-j1",
    trainee.email,
    "fr",
    {
      stagiairePrenomNom: `${trainee.prenom} ${trainee.nom}`,
      titreFormation: session.titreSession,
      dateFinFormation: fmtDate(session.dateFin),
      lienQuestionnaire,
      numeroSession: session.numero,
    },
    { jobId: `qualiopi-satisfaction-j1-${enrollmentId}-${dk}` },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// envoyerSuiviJ30
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie le suivi post-formation J+30 à un stagiaire.
 * Idempotent : jobId = qualiopi-suivi-j30-{enrollmentId}-{dateKey(dateFin)}.
 */
export async function envoyerSuiviJ30(enrollmentId: string): Promise<void> {
  if (isStub()) return;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      trainee: { select: { id: true, email: true, nom: true, prenom: true } },
      session: {
        select: {
          numero: true,
          titreSession: true,
          dateFin: true,
        },
      },
    },
  });

  if (!enrollment) return;

  // Même garantie que J+1 : le questionnaire à froid doit exister avant l'email.
  await creerQuestionnaire({ enrollmentId, type: "satisfaction_froid" });

  const { trainee, session } = enrollment;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const dk = dateKey(session.dateFin);
  const lienPortail = await getOrCreatePortailLien(trainee.id, baseUrl);

  await enqueueEmail(
    "qualiopi-suivi-j30",
    trainee.email,
    "fr",
    {
      stagiairePrenomNom: `${trainee.prenom} ${trainee.nom}`,
      titreFormation: session.titreSession,
      dateFinFormation: fmtDate(session.dateFin),
      lienPortail,
      numeroSession: session.numero,
    },
    { jobId: `qualiopi-suivi-j30-${enrollmentId}-${dk}` },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// envoyerAttestationDisponible
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notifie le stagiaire que son attestation/certificat est disponible.
 * Idempotent : jobId = qualiopi-attestation-disponible-{enrollmentId}.
 */
export async function envoyerAttestationDisponible(enrollmentId: string): Promise<void> {
  if (isStub()) return;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      attestationResultat: true,
      trainee: { select: { id: true, email: true, nom: true, prenom: true } },
      session: {
        select: {
          numero: true,
          titreSession: true,
        },
      },
    },
  });

  if (!enrollment) return;

  const { trainee, session } = enrollment;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const lienPortail = await getOrCreatePortailLien(trainee.id, baseUrl);

  // Détermine le libellé du document selon le résultat d'attestation
  // Enum AttestationResultat : complete | partielle | aucune
  const typeDocument: string =
    enrollment.attestationResultat === AttestationResultat.complete
      ? "attestation de formation"
      : enrollment.attestationResultat === AttestationResultat.partielle
        ? "attestation de formation partielle"
        : "certificat de réalisation";

  await enqueueEmail(
    "qualiopi-attestation-disponible",
    trainee.email,
    "fr",
    {
      stagiairePrenomNom: `${trainee.prenom} ${trainee.nom}`,
      titreFormation: session.titreSession,
      typeDocument,
      lienPortail,
      numeroSession: session.numero,
    },
    { jobId: `qualiopi-attestation-disponible-${enrollmentId}` },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// notifierAlerteInterne
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie une alerte interne à l'équipe Axion-IA (destinataire = env var
 * QUALIOPI_ALERTE_EMAIL ou WEEKLY_REPORT_EMAIL ou noreply admin).
 * NE PAS utiliser pour notifier des stagiaires.
 * Idempotent : jobId = qualiopi-alerte-interne-{alerteId}.
 */
export async function notifierAlerteInterne(alerteId: string): Promise<void> {
  if (isStub()) return;

  // Claim atomique : pose notifiedAt AVANT l'enqueue. Un second appel (ou une
  // instance concurrente en HA) voit count=0 → skip (anti-spam, verrou persistant
  // qui survit à la purge Redis contrairement au jobId BullMQ).
  const claim = await prisma.alerteSysteme.updateMany({
    where: { id: alerteId, notifiedAt: null, resolue: false },
    data: { notifiedAt: new Date() },
  });
  if (claim.count === 0) return;

  const alerte = await prisma.alerteSysteme.findUnique({
    where: { id: alerteId },
    select: {
      id: true,
      code: true,
      niveau: true,
      titre: true,
      message: true,
      cibleType: true,
      cibleId: true,
      createdAt: true,
    },
  });

  if (!alerte) return;

  // Destinataire interne : priorité QUALIOPI_ALERTE_EMAIL, sinon WEEKLY_REPORT_EMAIL
  const destinataire =
    process.env["QUALIOPI_ALERTE_EMAIL"] ??
    process.env["WEEKLY_REPORT_EMAIL"] ??
    "williamsjullin@gmail.com";

  const payload: Record<string, unknown> = {
    niveau: alerte.niveau,
    code: alerte.code,
    titre: alerte.titre,
    message: alerte.message,
    createdAt: fmtDate(alerte.createdAt),
  };
  if (alerte.cibleType != null) payload["cibleType"] = alerte.cibleType;
  if (alerte.cibleId != null) payload["cibleId"] = alerte.cibleId;

  let enqueued = false;
  try {
    ({ enqueued } = await enqueueEmail("qualiopi-alerte-interne", destinataire, "fr", payload, {
      jobId: `qualiopi-alerte-interne-${alerteId}`,
      entityType: "AlerteSysteme",
      entityId: alerteId,
    }));
  } catch (err) {
    // Redis existe mais add() throw (coupure transitoire) : libère le verrou pour
    // re-tenter au prochain cron, puis propage (sinon "notifiée" sans email parti).
    await prisma.alerteSysteme.update({
      where: { id: alerteId },
      data: { notifiedAt: null },
    });
    throw err;
  }

  // Fail-soft : pas de connexion Redis → on libère le verrou pour re-tenter au
  // prochain cron (sinon "notifiée" sans email réellement parti).
  if (!enqueued) {
    await prisma.alerteSysteme.update({
      where: { id: alerteId },
      data: { notifiedAt: null },
    });
  }
}
