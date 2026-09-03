/**
 * Convocation pratique J-7 et rappel J-1 du FORMATEUR (2026-09-03).
 *
 * ## Le défaut
 *
 * Le stagiaire recevait convocation, rappel J-7 et lien d'émargement ; le
 * formateur ne recevait RIEN. Son espace ne lui montrait que la ville et le
 * code postal — ni la salle, ni le contact sur place, ni la manière d'entrer
 * chez le client. Il arrivait en demandant à l'accueil.
 *
 * ## Un seul chargement, deux messages
 *
 * `chargerInfosPratiques` construit la charge utile UNE fois, à partir de la
 * session (lieu, contact, consignes, journées, effectif) et de l'affectation.
 * J-7 et J-1 la rendent avec le même bloc (`_infos-pratiques-formateur.tsx`).
 *
 * ## Traces d'état, pas balayage par date
 *
 * `SessionFormateur.convocationJ7EnvoyeeAt` / `rappelJ1EnvoyeAt` : écrites
 * SEULEMENT après mise en file réussie. Même patron que
 * `TrainingSession.rappelJ7EnvoyeAt` — une session dont l'envoi a échoué reste
 * candidate au passage suivant.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { MODALITE_LABELS } from "@/server/formateur/collectif-labels";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { formulerEffectif } from "./mission-formateur";

function isStub(): boolean {
  return Boolean(process.env["DATABASE_URL"]?.includes("stub.invalid"));
}

function fmtDateLongue(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtJourCourt(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/** « lun. 15/09 09:00–17:00 · mar. 16/09 09:00–12:30 » ; `undefined` sans journée saisie. */
export function formulerHoraires(
  jours: ReadonlyArray<{ date: Date; heureDebut: string; heureFin: string }>,
): string | undefined {
  if (jours.length === 0) return undefined;
  return jours.map((j) => `${fmtJourCourt(j.date)} ${j.heureDebut}–${j.heureFin}`).join(" · ");
}

/** « Prénom Nom — 06 … » ; l'un des deux suffit ; `undefined` si rien. */
export function formulerContactSurPlace(
  nom: string | null | undefined,
  telephone: string | null | undefined,
): string | undefined {
  const parts = [nom?.trim(), telephone?.trim()].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join(" — ") : undefined;
}

/** Adresse postale sur une ligne — `undefined` si aucune de ses parties n'est saisie. */
export function formulerAdresseComplete(l: {
  lieuAdresse: string | null;
  lieuCodePostal: string | null;
  lieuVille: string | null;
}): string | undefined {
  const cpVille = [l.lieuCodePostal?.trim(), l.lieuVille?.trim()].filter(Boolean).join(" ");
  const parts = [l.lieuAdresse?.trim(), cpVille].filter((v) => Boolean(v));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

interface InfosChargees {
  destinataire: string;
  payload: Record<string, unknown>;
}

async function chargerInfosPratiques(sessionFormateurId: string): Promise<InfosChargees | null> {
  const sf = await prisma.sessionFormateur.findUnique({
    where: { id: sessionFormateurId },
    select: {
      trainerId: true,
      trainer: { select: { email: true, prenom: true, nom: true } },
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          formationId: true,
          dateDebut: true,
          dateFin: true,
          modalite: true,
          nbParticipantsPrevus: true,
          lieuType: true,
          lieuIntitule: true,
          lieuAdresse: true,
          lieuCodePostal: true,
          lieuVille: true,
          lieuSalle: true,
          lieuVisioUrl: true,
          contactSurPlaceNom: true,
          contactSurPlaceTelephone: true,
          consignesAcces: true,
          jours: {
            orderBy: { date: "asc" },
            select: { date: true, heureDebut: true, heureFin: true },
          },
          _count: { select: { enrollments: { where: { ...inscriptionsActives() } } } },
        },
      },
    },
  });
  if (sf === null) return null;
  const s = sf.session;

  const [mission, kit] = await Promise.all([
    prisma.missionFormateur.findFirst({
      where: { sessionId: s.id, trainerId: sf.trainerId },
      orderBy: { solliciteAt: "desc" },
      select: { statut: true },
    }),
    prisma.supportFormation.findFirst({
      where: { formationId: s.formationId, type: "kit_formateur_imprime", pdfKey: { not: null } },
      select: { id: true },
    }),
  ]);

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const lieuFields = {
    ...s,
    lieuType: s.lieuType as "sur_site" | "nos_locaux" | "distanciel" | null,
  };
  const optionnel = (cle: string, v: string | undefined): Record<string, string> =>
    v !== undefined && v !== "" ? { [cle]: v } : {};

  return {
    destinataire: sf.trainer.email,
    payload: {
      formateurPrenomNom: `${sf.trainer.prenom} ${sf.trainer.nom}`,
      titreFormation: s.titreSession,
      numeroSession: s.numero,
      dateDebut: fmtDateLongue(s.dateDebut),
      dateFin: fmtDateLongue(s.dateFin),
      modalite: MODALITE_LABELS[s.modalite] ?? s.modalite,
      lieu: formatLieu(lieuFields) ?? "lieu à préciser — contactez-nous",
      ...optionnel("lieuAdresseComplete", formulerAdresseComplete(s)),
      ...optionnel("lieuSalle", s.lieuSalle?.trim()),
      ...optionnel("lieuVisioUrl", s.lieuVisioUrl?.trim()),
      ...optionnel(
        "contactSurPlace",
        formulerContactSurPlace(s.contactSurPlaceNom, s.contactSurPlaceTelephone),
      ),
      ...optionnel("consignesAcces", s.consignesAcces?.trim()),
      ...optionnel("horaires", formulerHoraires(s.jours)),
      ...optionnel("heureDebutJ1", s.jours[0]?.heureDebut),
      effectif: formulerEffectif(s._count.enrollments, s.nbParticipantsPrevus),
      lienEspace: `${base}${FORMATEUR_BASE_PATH}/sessions/${s.id}`,
      kitDisponible: kit !== null,
      missionEnAttente: mission?.statut === "en_attente",
    },
  };
}

async function envoyer(
  sessionFormateurId: string,
  quoi: "convocation-j7" | "rappel-j1",
): Promise<boolean> {
  if (isStub()) return false;
  const infos = await chargerInfosPratiques(sessionFormateurId);
  if (infos === null) return false;

  const envoi = await enqueueEmail(
    quoi === "convocation-j7" ? "formateur-convocation-j7" : "formateur-rappel-j1",
    infos.destinataire,
    "fr",
    infos.payload,
    {
      jobId: `formateur-${quoi}-${sessionFormateurId}`,
      entityType: "SessionFormateur",
      entityId: sessionFormateurId,
    },
  );
  if (!envoi.enqueued) {
    console.error(
      `[convocation-formateur] ${quoi} NON ENVOYÉ — affectation ${sessionFormateurId}, ` +
        "laissée candidate au rattrapage" +
        (envoi.garePourValidation === true
          ? " (e-mail garé en corbeille de validation)"
          : " (file de messages indisponible)"),
    );
    return false;
  }
  await prisma.sessionFormateur.update({
    where: { id: sessionFormateurId },
    data:
      quoi === "convocation-j7"
        ? { convocationJ7EnvoyeeAt: new Date() }
        : { rappelJ1EnvoyeAt: new Date() },
  });
  return true;
}

/** Convocation pratique J-7 au formateur d'une affectation. Vrai si mise en file. */
export function envoyerConvocationJ7Formateur(sessionFormateurId: string): Promise<boolean> {
  return envoyer(sessionFormateurId, "convocation-j7");
}

/** Rappel J-1 au formateur d'une affectation. Vrai si mise en file. */
export function envoyerRappelJ1Formateur(sessionFormateurId: string): Promise<boolean> {
  return envoyer(sessionFormateurId, "rappel-j1");
}

/**
 * Fenêtres des deux crons — nommées ici pour que le worker, l'alerte et l'écran
 * disent le même chiffre.
 */
export const FENETRE_CONVOCATION_J7_JOURS = 7.5;
export const FENETRE_RAPPEL_J1_HEURES = 36;
