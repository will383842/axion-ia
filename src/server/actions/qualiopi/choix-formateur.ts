"use server";

/**
 * Actions — choisir le formateur en cartes (L11b) et se désister depuis
 * l'espace (L11h).
 *
 * Deux côtés, deux gardes :
 *   - la CONSOLE choisit (`requireAdminWrite`, dossier ouvert) : toujours une
 *     personne de l'équipe, jamais un choix automatique ;
 *   - le FORMATEUR se désiste de SA mission (`requireFormateurAction` ; la
 *     mission d'un autre répond comme une mission inconnue).
 *
 * La logique vit dans `formateurs-independants/choix-formateur*.ts`.
 */

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireFormateurAction } from "@/server/formateur/guard";
import { assertDossierOuvert } from "@/server/qualiopi/sessions/verrou-dossier-garde";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import {
  FORFAIT_MAX_HT_CENTS,
  figerChoix,
} from "@/server/qualiopi/formateurs-independants/choix-formateur";
import { sessionPayeeParMission } from "@/server/qualiopi/formateurs-independants/conditions-figees";
import {
  abandonnerChoix,
  enregistrerChoix,
  lireCartesChoix,
  seDesister,
} from "@/server/qualiopi/formateurs-independants/choix-formateur-service";
import { prisma } from "@/lib/prisma";
import { FORMATEUR_BASE_PATH, FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
import { STATUTS_ACCORD_DONNE } from "@/server/qualiopi/trainers/mission-formateur";

import { logQualiopiActivity, requireAdminWrite } from "./_guards";
import { repondreMissionFormateurAction } from "./mission-formateur";
import { assignTrainerToSessionAction } from "./trainers";

type ActionResult<T> = { data: T } | { error: string };

const choixSchema = z.object({
  sessionId: z.string().uuid(),
  choix: z
    .array(
      z.object({
        trainerId: z.string().uuid(),
        rang: z.number().int().min(1).max(3),
        forfaitDeplacementParJourHtCents: z
          .number()
          .int()
          .min(0)
          .max(FORFAIT_MAX_HT_CENTS)
          .nullable(),
      }),
    )
    .min(1)
    .max(3),
});

const FONCTION_FERMEE = "Le choix en cartes n'est pas ouvert.";

/**
 * Enregistre le choix (rangs 1 à 3, conditions figées) puis propose la
 * mission au 1er choix par la porte d'affectation habituelle (garde,
 * habilitation, double emploi, archive, proposition).
 */
export async function choisirFormateursSessionAction(
  input: z.infer<typeof choixSchema>,
): Promise<ActionResult<{ missionProposee: boolean; avertissements: string[] }>> {
  const admin = await requireAdminWrite();
  const parsed = choixSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  if (!(await interrupteurAllume("choix_cartes"))) return { error: FONCTION_FERMEE };
  const { sessionId } = parsed.data;
  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) return verrou;

  const maintenant = new Date();
  const cartes = await lireCartesChoix(sessionId, maintenant);
  if (cartes === null) return { error: "Session introuvable" };
  if (!cartes.ouverte) return { error: "La session n'est plus à venir : rien à proposer." };
  // T3 — la même évaluation que les cartes affichées, relue ICI.
  const fige = figerChoix(parsed.data.choix, [...cartes.disponibles, ...cartes.indisponibles]);
  if (!fige.ok) return { error: fige.erreur };
  const premier = fige.choix[0]!;
  // ARGENT — le montant figé au choix n'est payé que par le paiement par mission.
  // Une session réglée par le relevé mensuel (pas de date de passage, ou première
  // journée avant elle) paierait le tarif de la fiche : on ne l'annonce pas.
  if (
    fige.choix.some((c) => c.tarifHtCents !== null) &&
    !(await sessionPayeeParMission(sessionId))
  ) {
    return {
      error:
        "Cette session est réglée par le relevé mensuel : les honoraires figés au choix ne seraient pas ceux payés. Choisissez un formateur indépendant par « Affecter ou retirer directement », ou une session réglée par mission.",
    };
  }

  // Le 1er choix tient déjà la place avec une proposition vivante : ses
  // conditions sont figées sur elle, on ne les change pas en silence.
  let dejaPropose = false;
  try {
    const [session, vivante] = await Promise.all([
      prisma.trainingSession.findUnique({
        where: { id: sessionId },
        select: { formateurPrincipalId: true },
      }),
      prisma.missionFormateur.findFirst({
        where: {
          sessionId,
          trainerId: premier.trainerId,
          statut: { in: ["en_attente", ...STATUTS_ACCORD_DONNE] },
        },
        select: { tarifHtCents: true, forfaitDeplacementParJourHtCents: true },
      }),
    ]);
    dejaPropose = session?.formateurPrincipalId === premier.trainerId && vivante !== null;
    // Faite avant les cartes, la proposition ne porte AUCUN honoraire figé : la
    // garder laisserait la lettre retomber sur le tarif de la fiche, et le
    // paiement en anomalie. Le choix en cartes exige de la retirer d'abord.
    if (dejaPropose && premier.tarifHtCents !== null && vivante?.tarifHtCents === null) {
      return {
        error:
          "Le 1er choix a déjà reçu une proposition sans honoraires figés : retirez-la d'abord, puis choisissez à nouveau.",
      };
    }
    // Une proposition déjà faite porte ses conditions : on ne les change pas en
    // silence. Faite avant les cartes (aucun forfait sur la mission), elle ne
    // vaut que « déplacement compris » : un autre forfait exige de la retirer.
    const forfaitMission = vivante?.forfaitDeplacementParJourHtCents ?? 0;
    const forfaitChoisi = premier.forfaitDeplacementParJourHtCents ?? 0;
    if (dejaPropose && forfaitMission !== forfaitChoisi) {
      return {
        error:
          "Le 1er choix a déjà reçu la proposition avec un autre forfait : retirez-la d'abord pour en changer.",
      };
    }
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }

  try {
    await enregistrerChoix(sessionId, fige.choix, maintenant);
  } catch {
    return { error: "Erreur lors de l'enregistrement du choix" };
  }
  await logQualiopiActivity({
    action: "qualiopi.session.choix_formateurs",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: {
      choix: fige.choix.map((c) => ({
        rang: c.rang,
        trainerId: c.trainerId,
        tarifHtCents: c.tarifHtCents,
        forfaitDeplacementParJourHtCents: c.forfaitDeplacementParJourHtCents,
        regimeTvaFige: c.regimeTvaFige,
      })),
    },
    session: admin,
  });
  if (dejaPropose) return { data: { missionProposee: false, avertissements: [] } };

  const r = await assignTrainerToSessionAction({ sessionId, trainerId: premier.trainerId });
  if ("error" in r) {
    // Le choix vient d'être écrit (la proposition y lit ses conditions) : il
    // n'est pas retenu, et le passage du rang suivant ne le proposera jamais.
    await abandonnerChoix(sessionId, maintenant);
    return { error: `${r.error} Le choix n'est pas retenu : refaites-le une fois ce point levé.` };
  }
  return {
    data: { missionProposee: r.data.missionProposee, avertissements: r.data.avertissements },
  };
}

const desistementSchema = z.object({
  missionId: z.string().uuid(),
  motif: z.string().max(1400).optional(),
  remplacant: z.string().max(500).optional(),
});

/**
 * Formulaire HTML : une session expirée (`unauthorized`, levée par la garde) renvoie vers la
 * connexion avec « reconnectez-vous », pas vers l'erreur générique. Aucune lecture en plus.
 */
async function sansSessionExpiree<T>(appel: () => Promise<T>): Promise<T> {
  try {
    return await appel();
  } catch (e) {
    if (e instanceof Error && e.message === "unauthorized") {
      redirect(`${FORMATEUR_CONNEXION_PATH}?erreur=session`);
    }
    throw e;
  }
}

/** « Je ne peux plus assurer cette mission » — depuis l'espace connecté. */
export async function seDesisterMissionAction(
  input: z.infer<typeof desistementSchema>,
): Promise<ActionResult<{ ok: true }>> {
  const { trainerId } = await requireFormateurAction();
  const parsed = desistementSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  let r: Awaited<ReturnType<typeof seDesister>>;
  try {
    r = await seDesister({
      trainerId,
      missionId: parsed.data.missionId,
      ...(parsed.data.motif !== undefined ? { motif: parsed.data.motif } : {}),
      ...(parsed.data.remplacant !== undefined ? { remplacant: parsed.data.remplacant } : {}),
      maintenant: new Date(),
    });
  } catch {
    return { error: "Votre réponse n'a pas pu être enregistrée : rechargez la page." };
  }
  if (!r.ok) return { error: r.erreur };
  return { data: { ok: true } };
}

/**
 * Même geste, depuis un formulaire HTML sans JavaScript (écran F-15) : la page
 * reste légère, et le formateur revient sur sa mission avec le résultat.
 */
export async function seDesisterDepuisFormulaireAction(formData: FormData): Promise<void> {
  const missionId = String(formData.get("missionId") ?? "");
  if (!z.string().uuid().safeParse(missionId).success) redirect(FORMATEUR_BASE_PATH);
  const texte = (cle: string) => {
    const v = String(formData.get(cle) ?? "").trim();
    return v === "" ? undefined : v;
  };
  const motif = texte("motif");
  const remplacant = texte("remplacant");
  const r = await sansSessionExpiree(() =>
    seDesisterMissionAction({
      missionId,
      ...(motif !== undefined ? { motif: motif.slice(0, 1400) } : {}),
      ...(remplacant !== undefined ? { remplacant: remplacant.slice(0, 500) } : {}),
    }),
  );
  redirect(`${FORMATEUR_BASE_PATH}?mission=${missionId}&${"error" in r ? "erreur=1" : "fait=1"}`);
}

/**
 * Réponse à une proposition depuis la page de mission (écran F-8), par un
 * formulaire HTML sans JavaScript : « J'accepte » ou « Je ne suis pas
 * disponible », le motif restant facultatif. Même garde et même service que
 * `repondreMissionFormateurAction` (le formateur connecté, SA mission).
 */
export async function repondreDepuisFormulaireAction(formData: FormData): Promise<void> {
  const missionId = String(formData.get("missionId") ?? "");
  if (!z.string().uuid().safeParse(missionId).success) redirect(FORMATEUR_BASE_PATH);
  const brute = formData.get("reponse");
  // Deux réponses possibles, et seulement deux : toute autre valeur est rejetée,
  // jamais lue comme un refus.
  if (brute !== "acceptee" && brute !== "refusee") {
    redirect(`${FORMATEUR_BASE_PATH}?mission=${missionId}&erreur=reponse`);
  }
  const reponse: "acceptee" | "refusee" = brute;
  const motif = [
    String(formData.get("choix") ?? "").trim(),
    String(formData.get("motif") ?? "").trim(),
  ]
    .filter((x) => x !== "")
    .join(" : ")
    .slice(0, 2000);
  const r = await sansSessionExpiree(() =>
    repondreMissionFormateurAction({
      missionId,
      reponse,
      ...(reponse === "refusee" && motif !== "" ? { motif } : {}),
    }),
  );
  const page = `${FORMATEUR_BASE_PATH}?mission=${missionId}`;
  // Aucun texte libre dans l'adresse : un code, que la page traduit.
  redirect("error" in r ? `${page}&erreur=reponse` : `${page}&reponse=${reponse}`);
}
