/**
 * Qualiopi — Service d'envoi d'emails transactionnels lifecycle (T15).
 *
 * Fonctions exportées :
 *   envoyerConvocation        : cron J-5 (off.9) → qualiopi-convocation
 *                               ⚠️ PAS appelé à la confirmation d'inscription —
 *                               cf. le commentaire de la fonction.
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
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
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
 * Envoie la convocation officielle au stagiaire. Idempotent : jobId fixe par
 * enrollmentId.
 *
 * ── Ce que cet e-mail transmet, exactement ───────────────────────────────────
 *
 * AUCUNE pièce jointe : il porte le lien personnel vers l'espace stagiaire,
 * qui délivre programme, règlement intérieur, livret d'accueil et questionnaire
 * de positionnement. Le PDF de convocation
 * (documents/templates/convocation.tsx) dit désormais exactement cela — il
 * annonçait auparavant des documents « transmis avec cette convocation », ce
 * qui était faux. Les deux textes sont solidaires : si l'on retire un jour
 * `lienPortail` du payload, ou si l'on attache réellement les fichiers, il faut
 * rectifier le gabarit PDF dans le même geste.
 *
 * ── 🔴 Pourquoi ce gabarit n'a JAMAIS été déclenché (audit blanc 2026-08-15) ──
 *
 * Zéro envoi sur 98 e-mails et 11 gabarits utilisés, tous dossiers confondus.
 * Le seul appelant est le cron `formation-crons.convocation-j5`
 * (queue/workers/qualiopi-formation-crons-worker.ts), qui ne retient que les
 * sessions `planifiee` dont `dateDebut` tombe dans [now+4,5 j ; now+5,5 j] au
 * passage quotidien de 08:00 UTC. Deux conséquences :
 *
 *   1. `enrollTraineeAction` (actions/qualiopi/enrollments.ts) N'APPELLE PAS
 *      cette fonction — contrairement à ce qu'annonçait l'en-tête du fichier.
 *      Rien ne part à la confirmation de l'inscription.
 *   2. Le cron ne rattrape RIEN : une inscription enregistrée à moins de 5
 *      jours de la session — le cas d'un premier dossier réel — n'a plus aucune
 *      fenêtre, et le stagiaire ne reçoit jamais de convocation.
 *
 * Le chaînon manquant est donc un appel au point de confirmation d'inscription,
 * et/ou un rattrapage dans le cron pour les enrollments créés après J-5. Les
 * deux fichiers concernés sont hors du périmètre de ce correctif : ne pas
 * câbler à l'aveugle depuis ici.
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

  // La convocation ATTESTE que les documents sont accessibles « par le lien
  // personnel qui vous est adressé par courriel avec cette convocation ». Si la
  // création du jeton échoue, `getOrCreatePortailLien` retombe EN SILENCE sur la
  // route nue /portail/mon-espace, qui refuse l'accès faute de session : la
  // pièce affirmerait alors ce que l'e-mail ne tient pas.
  //
  // On laisse malgré tout PARTIR la convocation — la retenir romprait
  // l'obligation d'information (indicateur 9) alors que la page de refus offre
  // une demande d'accès — mais le défaut est journalisé, jamais deviné.
  if (lienPortail === `${baseUrl}/fr/portail/mon-espace`) {
    console.error(
      `[notifications] convocation: aucun lien portail personnel pour le stagiaire ${trainee.id} ` +
        `(inscription ${enrollmentId}) — la convocation part avec un lien d'accès NON personnalisé, ` +
        `alors que le PDF annonce un accès direct aux documents`,
    );
  }

  const envoi = await enqueueEmail(
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
    // 🔴 Clé de DATE, comme rappel-j7 / satisfaction-j1 / suivi-j30. La
    // convocation etait le seul envoi a ne pas en porter, alors qu'elle est le
    // seul a porter une obligation reglementaire (ind. 9). Sans elle, la
    // deduplication BullMQ expire au min(7 jours, 1 000 jobs) et un second
    // envoi redevient possible sans que rien ne le dise.
    { jobId: `qualiopi-convocation-${enrollmentId}-${dateKey(session.dateDebut)}` },
  );

  // 🔴 ÉTAT, et non fenêtre de date. C'est cette colonne qui rend le cron
  // rattrapant : tant qu'elle est nulle, l'inscription reste candidate.
  //
  // 🔴 2026-08-19 (constat `D5-3-01`) — la valeur de retour d'`enqueueEmail`
  // N'ÉTAIT PAS LUE, et la date était posée quoi qu'il arrive.
  //
  // Le commentaire d'origine disait l'intention juste — « posée APRÈS l'enqueue,
  // poser avant ferait mentir la colonne si la file est indisponible » — et se
  // trompait sur le MÉCANISME : il supposait que l'échec lèverait. Or
  // `enqueueEmail` ne lève pas, elle RETOURNE `{ enqueued: false }`
  // (`queues.ts:742`) quand la file est absente, et
  // `{ enqueued: false, garePourValidation: true }` (`:768`) quand une règle
  // `EmailAutomationSetting` gare l'envoi en corbeille.
  //
  // Dans les deux cas, poser la date écarte l'inscription DÉFINITIVEMENT du
  // rattrapage : le stagiaire ne reçoit rien, la base affirme le contraire, et
  // l'indicateur 9 repose sur un horodatage qui atteste d'un geste jamais
  // accompli. C'est la reconstitution littérale de l'incident « aucune
  // convocation jamais envoyée en production ».
  //
  // ⚠️ `garePourValidation` compte comme NON ENVOYÉ. L'e-mail partira peut-être,
  // après approbation humaine — mais il n'est pas parti. Le cron doit rester en
  // mesure de le reprendre.
  if (!envoi.enqueued) {
    console.error(
      `[convocation] NON ENVOYÉE — inscription ${enrollmentId} laissée candidate au rattrapage` +
        (envoi.garePourValidation === true
          ? " (e-mail garé en corbeille de validation)"
          : " (file de messages indisponible)"),
    );
    return;
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { convocationEnvoyeeAt: new Date() },
  });
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

  // 🔴 Le moment de l'attestation est celui où le stagiaire est le PLUS enclin
  // à répondre : on glisse un rappel du questionnaire resté sans réponse DANS
  // cet email. ⚠️ L'attestation, elle, part QUOI QU'IL ARRIVE — c'est un droit
  // du stagiaire (L.6353-1) : la conditionner à la réponse serait une faute.
  const questionnairesEnAttente = await prisma.questionnaire.count({
    where: {
      enrollmentId,
      reponduAt: null,
      type: { in: ["satisfaction_chaud", "satisfaction_froid", "positionnement"] },
    },
  });

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
      questionnaireEnAttente: questionnairesEnAttente > 0,
    },
    { jobId: `qualiopi-attestation-disponible-${enrollmentId}` },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// envoyerRelanceQuestionnaire
// ─────────────────────────────────────────────────────────────────────────────

/** Libellés humains des questionnaires — pour le corps des relances. */
const LIBELLE_QUESTIONNAIRE: Record<string, string> = {
  positionnement: "questionnaire de positionnement",
  satisfaction_chaud: "questionnaire de satisfaction",
  satisfaction_froid: "questionnaire de suivi à 30 jours",
  satisfaction_entreprise: "enquête de satisfaction entreprise",
};

/**
 * Relance un questionnaire ENVOYÉ resté sans réponse.
 *
 * 🔴 Constaté sur le premier dossier réel : les questionnaires partaient, puis
 * plus rien. La relance est la moitié MANQUANTE du recueil — et sa trace
 * (`relanceCount`, `derniereRelanceAt`) est la preuve, devant l'auditeur, que
 * le processus existe. Une non-réponse d'un tiers n'est pas une faute de
 * l'organisme ; l'absence de tentative tracée, si.
 *
 * - Types stagiaire → email au stagiaire, lien portail.
 * - `satisfaction_entreprise` → email au CONTACT CLIENT, lien enquête publique.
 *
 * Ne décide PAS du calendrier : l'appelant (cron J+3/J+10, ou bouton console)
 * choisit quand. Incrémente la trace ici, dans le même geste que l'envoi.
 * Idempotence : le jobId inclut le numéro de relance — la relance N ne part
 * qu'une fois, la relance N+1 reste possible.
 */
/**
 * Envoie le questionnaire de POSITIONNEMENT au stagiaire (indicateur 8).
 *
 * 🔴 Remplace le repli sur `demanderAccesParEmail()`, qui envoyait le template
 * de RE-DEMANDE d'accès portail — un email affirmant une demande que le
 * stagiaire n'avait pas faite, et se terminant par « vous pouvez ignorer cet
 * email ». Constaté sur le premier dossier réel, la veille de la formation :
 * l'indicateur 8 reposait sur un message qui demandait qu'on l'ignore.
 *
 * ⚠️ Volontairement SANS garde sur `envoyeAt` : renvoyer le positionnement est
 * légitime (le stagiaire a perdu le mail, l'adresse a changé). La garde qui
 * compte — « déjà répondu » — est posée en amont dans `envoyerQuestionnaireAction`.
 */
export async function envoyerPositionnement(questionnaireId: string): Promise<void> {
  if (isStub()) return;

  const q = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      id: true,
      reponduAt: true,
      enrollment: {
        select: {
          trainee: { select: { id: true, email: true, nom: true, prenom: true } },
          session: { select: { numero: true, titreSession: true, dateDebut: true } },
        },
      },
    },
  });

  // Un positionnement déjà répondu n'a plus de destinataire : le renvoyer
  // laisserait croire au stagiaire que sa réponse s'est perdue.
  if (!q || q.reponduAt !== null) return;

  const { trainee, session } = q.enrollment;
  if (!trainee.email) return;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const lienQuestionnaire = await getOrCreatePortailLien(trainee.id, baseUrl);

  await enqueueEmail(
    "qualiopi-positionnement",
    trainee.email,
    "fr",
    {
      stagiairePrenomNom: `${trainee.prenom} ${trainee.nom}`.trim(),
      titreFormation: session.titreSession,
      dateDebutFormation: fmtDate(session.dateDebut),
      lienQuestionnaire,
      numeroSession: session.numero,
    },
    // 🔴 `jobId` horodaté, PAS `qualiopi-positionnement-${q.id}` : la
    // déduplication BullMQ rendrait tout renvoi silencieusement inopérant, et
    // c'est exactement le renvoi qu'on vient de rendre nécessaire.
    { jobId: `qualiopi-positionnement-${q.id}-${Date.now()}` },
  );
}

export async function envoyerRelanceQuestionnaire(questionnaireId: string): Promise<void> {
  if (isStub()) return;

  const q = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      id: true,
      type: true,
      token: true,
      envoyeAt: true,
      reponduAt: true,
      relanceCount: true,
      enrollment: {
        select: {
          trainee: { select: { id: true, email: true, nom: true, prenom: true } },
          session: {
            select: {
              numero: true,
              titreSession: true,
              dateFin: true,
              client: { select: { contactNom: true, contactEmail: true, raisonSociale: true } },
            },
          },
        },
      },
    },
  });

  // Jamais de relance sur un questionnaire non envoyé ou déjà répondu.
  if (!q || q.envoyeAt === null || q.reponduAt !== null) return;

  const { trainee, session } = q.enrollment;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const numeroRelance = q.relanceCount + 1;
  const libelle = LIBELLE_QUESTIONNAIRE[q.type] ?? "questionnaire";

  if (q.type === "satisfaction_entreprise") {
    const client = session.client;
    // Sans email de contact, la relance n'a pas de destinataire — on sort SANS
    // toucher la trace : le compteur ne compte que de VRAIS envois.
    if (!client?.contactEmail) return;
    await enqueueEmail(
      "qualiopi-enquete-entreprise",
      client.contactEmail,
      "fr",
      {
        contactNom: client.contactNom ?? client.raisonSociale,
        raisonSociale: client.raisonSociale,
        titreFormation: session.titreSession,
        dateFinFormation: fmtDate(session.dateFin),
        lienEnquete: `${baseUrl}/fr/portail/enquete/${q.token}`,
        numeroSession: session.numero,
      },
      { jobId: `qualiopi-enquete-entreprise-relance-${q.id}-${numeroRelance}` },
    );
  } else if (q.type === "positionnement") {
    // 🔴 2026-08-15 — MÊME DÉFAUT que l'envoi initial, trouvé en auditant les
    // autres e-mails à la demande de Will.
    //
    // Le cron `relance-questionnaires` ne filtre PAS sur le type : un
    // positionnement sans réponse à J+3 était relancé avec
    // `qualiopi-questionnaire-relance`, dont le corps affirme « Vous avez suivi
    // la formation X » et dont l'objet annonce « votre avis sur X ».
    //
    // Un positionnement se recueille AVANT la formation. Les deux phrases
    // étaient donc fausses, et la seconde transformait un questionnaire
    // préparatoire en enquête de satisfaction — sur une formation que le
    // stagiaire n'avait pas encore suivie.
    //
    // On relance avec le template de positionnement, qui dit « avant le début
    // de la formation » — la phrase juste dans les deux cas.
    await envoyerPositionnement(q.id);
  } else {
    const lienQuestionnaire = await getOrCreatePortailLien(trainee.id, baseUrl);
    await enqueueEmail(
      "qualiopi-questionnaire-relance",
      trainee.email,
      "fr",
      {
        stagiairePrenomNom: `${trainee.prenom} ${trainee.nom}`,
        titreFormation: session.titreSession,
        libelleQuestionnaire: libelle,
        lienQuestionnaire,
        numeroSession: session.numero,
      },
      { jobId: `qualiopi-questionnaire-relance-${q.id}-${numeroRelance}` },
    );
  }

  await prisma.questionnaire.update({
    where: { id: q.id },
    data: { relanceCount: numeroRelance, derniereRelanceAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// envoyerEnqueteEntreprise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie l'enquête ENTREPRISE au contact client d'une session réalisée.
 *
 * 🔴 L'indicateur 30 exige ≥ 2 sources distinctes. Le retour stagiaire est
 * automatisé ; celui de l'entreprise n'avait AUCUN canal — il se tapait à la
 * main dans la console. Le contact client reçoit une page publique à jeton ;
 * sa réponse est versée automatiquement en appréciation « entreprise ».
 *
 * Le questionnaire est ancré sur la PREMIÈRE inscription active de la session
 * (le schéma ancre tout questionnaire sur une inscription) — mais le
 * destinataire est le CONTACT CLIENT, jamais le stagiaire.
 *
 * Idempotent : `creerQuestionnaire` est un upsert, et le jobId est stable.
 * L'appelant marque `envoyeAt` après succès (même contrat que satisfaction-j1).
 */
export async function envoyerEnqueteEntreprise(sessionId: string): Promise<void> {
  if (isStub()) return;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateFin: true,
      client: { select: { contactNom: true, contactEmail: true, raisonSociale: true } },
      enrollments: {
        where: { statut: { in: ["planifiee", "presente"] } },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!session) return;
  const enrollment = session.enrollments[0];
  const client = session.client;
  // Pas de contact email ou pas d'inscrit : rien à envoyer — throw pour que
  // l'appelant (cron fail-soft) le journalise au lieu de croire l'envoi fait.
  if (!enrollment || !client?.contactEmail) {
    throw new Error(
      `enquête entreprise: session ${sessionId} sans ${!enrollment ? "inscription active" : "email de contact client"}`,
    );
  }

  const { token } = await creerQuestionnaire({
    enrollmentId: enrollment.id,
    type: "satisfaction_entreprise",
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const dk = dateKey(session.dateFin);

  await enqueueEmail(
    "qualiopi-enquete-entreprise",
    client.contactEmail,
    "fr",
    {
      contactNom: client.contactNom ?? client.raisonSociale,
      raisonSociale: client.raisonSociale,
      titreFormation: session.titreSession,
      dateFinFormation: fmtDate(session.dateFin),
      lienEnquete: `${baseUrl}/fr/portail/enquete/${token}`,
      numeroSession: session.numero,
    },
    { jobId: `qualiopi-enquete-entreprise-${sessionId}-${dk}` },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// notifierAlerteInterne
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie une alerte interne à l'équipe Axion-IA (destinataire résolu par
 * `destinataireAlertesInternes()` : QUALIOPI_ALERTE_EMAIL, sinon
 * WEEKLY_REPORT_EMAIL, sinon l'adresse de l'organisme).
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

  // Destinataire interne — SSOT `lib/destinataires-internes.ts`.
  //
  // 🔴 Le repli en dur était une adresse Gmail PERSONNELLE, et il était recopié
  // à la main dans un second fichier (celui des candidatures commerciales, qui
  // envoie le CV complet d'un candidat). Trois valeurs coexistaient pour la
  // même question : la troisième était juste, les deux autres fausses.
  // Décision de Will le 16/08 : `contact@axion-ia.com`, résolue en UN endroit.
  const destinataire = destinataireAlertesInternes();

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
