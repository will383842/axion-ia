// Interrupteurs du chantier « formateurs freelance » — Server Actions (lot S0-ter).
//
// UNE action par clé, sur le calque de `basculerReponsePostePourvuAction` :
// habilitation par clé, préalables relus côté serveur DANS la transaction,
// ligne de journal dans la MÊME transaction que l'écriture. Couper (revenir à
// la position sûre) est toujours permis à qui est habilité.
//
// L'interprétation des valeurs vit dans
// `server/qualiopi/formateurs-independants/interrupteurs.ts` — seul lecteur.

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import {
  INTERRUPTEURS,
  INTERRUPTEURS_SIGNATURE,
  PREFIXE_CLES_FORMATEURS,
  cleSetting,
  cleSettingSignature,
  lireValeurSignature,
  prealablesManquantsSignature,
  type CleInterrupteurSignature,
  estDateDePassage,
  estPositionSure,
  etatsDepuisLignes,
  prealablesManquants,
  valeurJson,
  type CleInterrupteur,
  type Habilitation,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

export type EtatBascule = { ok: true; message: string } | { ok: false; error: string };

const ROLES_PAR_HABILITATION: Readonly<Record<Habilitation, ReadonlyArray<string>>> = {
  technique: ["super_admin", "admin"],
  // Acte `valider_texte_email` : absent de la matrice SSOT à ce jour, donc
  // réservé au seul `super_admin`.
  valider_texte_email: ["super_admin"],
};

const REFUS_HABILITATION: Readonly<Record<Habilitation, string>> = {
  technique: "Cet interrupteur est réservé à la direction (administrateur).",
  valider_texte_email: "Valider les textes des e-mails est réservé à la direction (super-admin).",
};

/** La valeur demandée par le formulaire, ou un message d'erreur. */
function valeurDemandee(
  cle: CleInterrupteur,
  formData: FormData,
): { ok: true; valeur: unknown } | { ok: false; error: string } {
  const sorte = INTERRUPTEURS[cle].sorte;
  if (sorte === "garde_niveau") {
    const v = formData.get("valeur");
    return v === "refuser" || v === "avertir"
      ? { ok: true, valeur: v }
      : { ok: false, error: "Choisissez « refuser » ou « avertir »." };
  }
  if (sorte === "date") {
    const d = formData.get("date");
    if (d === null || d === "") return { ok: true, valeur: null };
    return estDateDePassage(d)
      ? { ok: true, valeur: d }
      : { ok: false, error: "La date de passage doit tomber le 1er du mois (AAAA-MM-01)." };
  }
  const a = formData.get("actif");
  return a === "1" || a === "0"
    ? { ok: true, valeur: a === "1" }
    : { ok: false, error: "Valeur invalide." };
}

async function basculer(cle: CleInterrupteur, formData: FormData): Promise<EtatBascule> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  const habilitation = INTERRUPTEURS[cle].habilitation;
  if (role == null || !ROLES_PAR_HABILITATION[habilitation].includes(role)) {
    return { ok: false, error: REFUS_HABILITATION[habilitation] };
  }
  const demande = valeurDemandee(cle, formData);
  if (!demande.ok) return demande;
  const valeur = demande.valeur;
  const userId = session.user.id;
  const coupe = estPositionSure(cle, valeur);

  let manques: string[];
  try {
    manques = await ecrire(cle, valeur, coupe, userId);
  } catch (err) {
    // Une erreur de la base ne casse jamais l'écran : rien n'a été écrit (la
    // transaction est annulée), l'écran le dit, Sentry garde la trace.
    Sentry.captureException(err, { tags: { action: "basculerFormateursInterrupteur", cle } });
    return {
      ok: false,
      error: "Le changement n'a pas été enregistré (erreur technique). Réessayez plus tard.",
    };
  }

  if (manques.length > 0) {
    return { ok: false, error: `Allumage refusé : ${manques.join(" ")}` };
  }
  revalidatePath(adminPath("fr", "qualiopi/formateurs/interrupteurs"));
  return { ok: true, message: coupe ? "Coupé." : "Enregistré." };
}

/** Préalables relus, réglage et journal : une seule transaction. Rend les manques. */
function ecrire(
  cle: CleInterrupteur,
  valeur: unknown,
  coupe: boolean,
  userId: string,
): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const lignes = await tx.setting.findMany({
      where: { key: { startsWith: PREFIXE_CLES_FORMATEURS } },
      select: { key: true, value: true },
    });
    const etats = etatsDepuisLignes(lignes);
    const manquants = prealablesManquants(cle, valeur, etats);
    if (manquants.length > 0) return manquants;
    const avant = etats[cle];
    await tx.setting.upsert({
      where: { key: cleSetting(cle) },
      create: {
        key: cleSetting(cle),
        value: valeurJson(cle, valeur) as never,
        description: `Formateurs freelance › Interrupteurs — ${INTERRUPTEURS[cle].libelle}`,
        updatedBy: userId,
      },
      update: { value: valeurJson(cle, valeur) as never, updatedBy: userId },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: userId,
        action: coupe ? "formateurs.interrupteur_coupe" : "formateurs.interrupteur_allume",
        // ⚠️ Pas de `targetId` : la colonne est `uuid` et une clé de `settings`
        // est du texte — Postgres refusait la ligne et annulait tout (prod,
        // 2026-10-10). La clé est dans `changes.cle`, comme ailleurs.
        targetType: "setting",
        changes: { cle: cleSetting(cle), avant, apres: valeur } as never,
      },
    });
    return [];
  });
}

export async function basculerFormateursTextesValidesAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("textes_valides", formData);
}
export async function basculerFormateursEchangeOuvertAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("echange_ouvert", formData);
}
export async function basculerFormateursInvitationAutoAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("invitation_auto", formData);
}
export async function basculerFormateursDossierEnLigneAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("dossier_en_ligne", formData);
}
export async function basculerFormateursRelancesAutoAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("relances_auto", formData);
}
export async function basculerFormateursPiecesCronAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("pieces_cron", formData);
}
export async function basculerFormateursControleRegistrePeriodiqueAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("controle_registre_periodique", formData);
}
export async function basculerFormateursContratAutoAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("contrat_auto", formData);
}
export async function basculerFormateursGardeActivationAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("garde_activation", formData);
}
export async function basculerFormateursActivationAutoAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("activation_auto", formData);
}
export async function basculerFormateursGardeMissionAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("garde_mission", formData);
}
export async function basculerFormateursLettreAutoAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("lettre_auto", formData);
}
export async function basculerFormateursChoixSuivantsAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("choix_suivants", formData);
}
export async function basculerFormateursPassagePaiementAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("passage_paiement", formData);
}
export async function basculerFormateursCommunesGeoCronAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("communes_geo_cron", formData);
}
export async function basculerFormateursProchesBlocAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculer("proches_bloc", formData);
}

// ─── Socle de signature (S6a) — même calque, registre à part ─────────────────

async function basculerSignature(
  cle: CleInterrupteurSignature,
  formData: FormData,
): Promise<EtatBascule> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  const def = INTERRUPTEURS_SIGNATURE[cle];
  if (role == null || !ROLES_PAR_HABILITATION[def.habilitation].includes(role)) {
    return { ok: false, error: REFUS_HABILITATION[def.habilitation] };
  }
  const a = formData.get("actif");
  if (a !== "1" && a !== "0") return { ok: false, error: "Valeur invalide." };
  const valeur = a === "1";
  const userId = session.user.id;

  let manques: string[];
  try {
    manques = await ecrireSignature(cle, valeur, userId);
  } catch (err) {
    // Même règle que `basculer` : une erreur de la base devient un message,
    // rien n'a été écrit (transaction annulée), Sentry garde la trace.
    Sentry.captureException(err, { tags: { action: "basculerSignatureInterrupteur", cle } });
    return {
      ok: false,
      error: "Le changement n'a pas été enregistré (erreur technique). Réessayez plus tard.",
    };
  }

  if (manques.length > 0) {
    return { ok: false, error: `Allumage refusé : ${manques.join(" ")}` };
  }
  revalidatePath(adminPath("fr", "qualiopi/formateurs/interrupteurs"));
  return { ok: true, message: valeur ? "Enregistré." : "Coupé." };
}

/** Préalables relus, réglage et journal : une seule transaction. Rend les manques. */
function ecrireSignature(
  cle: CleInterrupteurSignature,
  valeur: boolean,
  userId: string,
): Promise<string[]> {
  const def = INTERRUPTEURS_SIGNATURE[cle];
  const key = cleSettingSignature(cle);
  return prisma.$transaction(async (tx) => {
    const lignes = await tx.setting.findMany({
      where: { key: { startsWith: PREFIXE_CLES_FORMATEURS } },
      select: { key: true, value: true },
    });
    const manquants = prealablesManquantsSignature(cle, valeur, etatsDepuisLignes(lignes));
    if (manquants.length > 0) return manquants;
    const actuelle = await tx.setting.findUnique({ where: { key }, select: { value: true } });
    const avant = lireValeurSignature(actuelle?.value).valeur;
    await tx.setting.upsert({
      where: { key },
      create: {
        key,
        value: { actif: valeur } as never,
        description: `Socle de signature › Interrupteurs — ${def.libelle}`,
        updatedBy: userId,
      },
      update: { value: { actif: valeur } as never, updatedBy: userId },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: userId,
        action: valeur ? "signature.interrupteur_allume" : "signature.interrupteur_coupe",
        // ⚠️ Pas de `targetId` : colonne `uuid`, la clé est du texte (cf. `ecrire`).
        targetType: "setting",
        changes: { cle: key, avant, apres: valeur } as never,
      },
    });
    return [];
  });
}

export async function basculerSignatureCopiePartielleAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculerSignature("copie_partielle", formData);
}
export async function basculerSignatureExemplaireContratTravailAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculerSignature("exemplaire_contrat_travail", formData);
}
export async function basculerSignatureAlertesHorsJetonAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculerSignature("alertes_hors_jeton", formData);
}
export async function basculerFormateursSuiteContratCadreAction(
  _prev: EtatBascule,
  formData: FormData,
): Promise<EtatBascule> {
  return basculerSignature("suite_contrat_cadre", formData);
}
