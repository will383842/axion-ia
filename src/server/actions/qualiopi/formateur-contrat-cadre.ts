// Contrat-cadre des formateurs indépendants — Server Actions (lots L7b, L9b, L7d).
//
// Chaque action vérifie le RÔLE d'abord, puis son interrupteur, AVANT toute lecture :
//   - L7b `formateurs.contrat_cadre_emission`  : préparer le contrat-cadre (rôle `contresigner`) ;
//   - L9b `formateurs.mise_a_niveau`           : figer la liste, envoyer le dossier (rôle
//                                                `habiliter_formateur`) ;
//   - L7d `formateurs.nouvelle_version_contrat` : aperçu et envoi de la nouvelle version
//                                                (rôle `contresigner`).
// Interrupteur absent = refus, rien n'est lu, écrit ni envoyé. Tout e-mail passe par
// l'adaptateur `envois.ts` (texte validé exigé). Journal : identifiants seulement.
// Sentry : le nom de l'action seulement.

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { peutEngager, type ActeEngageant } from "@/server/auth/habilitations";
import { emettreLienSignature } from "@/server/qualiopi/documents/signature/emettre-lien-signature";
import { resumeVersionArretee } from "@/server/qualiopi/documents/templates/versions-arretees";
import { aFaireResigner } from "@/server/qualiopi/formateurs-independants/contrat-cadre-emission-regles";
import {
  lireFaitsEmissionContrat,
  preparerContratCadre,
  versionContratAEmettre,
} from "@/server/qualiopi/formateurs-independants/contrat-cadre-emission";
import {
  apercu,
  envoyer,
  texteValide,
  valeursManquantes,
} from "@/server/qualiopi/formateurs-independants/envois";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import type { CleInterrupteurSignature } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import {
  envoyerDossierMiseANiveau,
  figerListeMiseANiveau,
} from "@/server/qualiopi/formateurs-independants/mise-a-niveau";

type Refus = { readonly error: string };

const MESSAGES_ETEINT: Readonly<Record<string, string>> = {
  contrat_cadre_emission:
    "La préparation du contrat-cadre n'est pas encore ouverte (interrupteur coupé).",
  mise_a_niveau: "La mise à niveau n'est pas encore ouverte (interrupteur coupé).",
  nouvelle_version_contrat:
    "La nouvelle version du contrat n'est pas encore ouverte (interrupteur coupé).",
};

async function autorise(
  acte: ActeEngageant,
  cle: CleInterrupteurSignature,
): Promise<AdminSession | Refus> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, acte)) return { error: "Vous n'avez pas le droit de faire ce geste." };
  if (!(await interrupteurAllume(cle))) {
    return { error: MESSAGES_ETEINT[cle] ?? "Fonction pas encore ouverte." };
  }
  return { userId: session.user.id, role: role ?? "" };
}

const schemaFiche = z.object({ trainerId: z.string().uuid() });
const fiche = (trainerId: string) => adminPath("fr", `qualiopi/formateurs/${trainerId}`);
const ECRAN = adminPath("fr", "qualiopi/formateurs/mise-a-niveau");

// ─────────────────────────────────────────────────────────────────────────────
// L7b — préparer le contrat-cadre
// ─────────────────────────────────────────────────────────────────────────────

export async function preparerContratCadreAction(
  input: z.input<typeof schemaFiche>,
): Promise<{ data: { numero: string; version: number; remplaces: number } } | Refus> {
  const a = await autorise("contresigner", "contrat_cadre_emission");
  if ("error" in a) return a;
  const p = schemaFiche.safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  try {
    const r = await preparerContratCadre({ trainerId: p.data.trainerId, maintenant: new Date() });
    if (!r.ok) return { error: r.refus.join(" ") };
    await logQualiopiActivity({
      action: "qualiopi.formateur.contrat_cadre.prepare",
      targetType: "DocumentGenere",
      targetId: r.documentId,
      changes: { trainerId: p.data.trainerId, version: r.version, remplaces: r.remplaces },
      session: a,
    });
    revalidatePath(fiche(p.data.trainerId));
    return { data: { numero: r.numero, version: r.version, remplaces: r.remplaces } };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "preparerContratCadreAction" } });
    return { error: "Le contrat n'a pas pu être préparé. Réessayez." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// L9b — mise à niveau des indépendants actifs
// ─────────────────────────────────────────────────────────────────────────────

export async function figerListeMiseANiveauAction(): Promise<
  { data: { listees: number } } | Refus
> {
  const a = await autorise("habiliter_formateur", "mise_a_niveau");
  if ("error" in a) return a;
  try {
    const r = await figerListeMiseANiveau({ parId: a.userId, maintenant: new Date() });
    revalidatePath(ECRAN);
    return { data: r };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "figerListeMiseANiveauAction" } });
    return { error: "La liste n'a pas pu être figée. Réessayez." };
  }
}

export async function envoyerDossierMiseANiveauAction(
  input: z.input<typeof schemaFiche>,
): Promise<{ data: { envoi: string } } | Refus> {
  const a = await autorise("habiliter_formateur", "mise_a_niveau");
  if ("error" in a) return a;
  const p = schemaFiche.safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  try {
    const r = await envoyerDossierMiseANiveau({
      trainerId: p.data.trainerId,
      parId: a.userId,
      maintenant: new Date(),
    });
    if (!r.ok) return { error: r.message };
    revalidatePath(ECRAN);
    return { data: { envoi: r.envoi } };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "envoyerDossierMiseANiveauAction" } });
    return { error: "Le dossier n'a pas pu être envoyé. Réessayez." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// L7d — nouvelle version du contrat-cadre
// ─────────────────────────────────────────────────────────────────────────────

const GABARIT_NOUVELLE_VERSION = "formateur-contrat-nouvelle-version" as const;
/** Au plus 30 envois par geste, comme un passage de relances. */
const PLAFOND_ENVOI_NOUVELLE_VERSION = 30;

function payloadNouvelleVersion(prenom: string, lien: string, resume: string | null) {
  return {
    ...(prenom.trim() ? { prenom: prenom.trim() } : {}),
    lien,
    // Absent : le [crochet] reste vide, et l'adaptateur refuse d'envoyer.
    valeurs: resume === null ? {} : { "liste courte": resume },
  };
}

export async function apercuNouvelleVersionAction(
  input: z.input<typeof schemaFiche>,
): Promise<
  { data: { sujet: string; html: string; texteValide: boolean; resumeEcrit: boolean } } | Refus
> {
  const a = await autorise("contresigner", "nouvelle_version_contrat");
  if ("error" in a) return a;
  const p = schemaFiche.safeParse(input);
  if (!p.success) return { error: "Données invalides." };
  try {
    const t = await prisma.trainer.findUnique({
      where: { id: p.data.trainerId },
      select: { prenom: true, email: true },
    });
    if (t === null) return { error: "Formateur introuvable." };
    const version = versionContratAEmettre();
    const resume =
      version === null ? null : resumeVersionArretee("contrat_sous_traitance", version);
    const rendu = await apercu({
      gabarit: GABARIT_NOUVELLE_VERSION,
      destinataire: t.email,
      payload: payloadNouvelleVersion(t.prenom, "https://axion-ia.com/fr/portail/signer/…", resume),
    });
    return {
      data: {
        sujet: rendu.sujet,
        html: rendu.html,
        texteValide: await texteValide(GABARIT_NOUVELLE_VERSION),
        resumeEcrit: resume !== null,
      },
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apercuNouvelleVersionAction" } });
    return { error: "L'aperçu n'a pas pu être affiché." };
  }
}

const schemaEnvoiGroupe = z.object({
  trainerIds: z.array(z.string().uuid()).min(1).max(PLAFOND_ENVOI_NOUVELLE_VERSION),
});

export interface ResultatEnvoiVersion {
  readonly trainerId: string;
  readonly ok: boolean;
  readonly message: string;
}

/**
 * Pour chaque formateur choisi : prépare la nouvelle version (nouvelle pièce, l'ancienne
 * signée reste en vigueur), émet son lien de signature et envoie F45. Un refus pour l'un
 * ne bloque pas les autres. Tout ce qui fait refuser l'ENVOI (texte non validé, résumé
 * absent) est vérifié AVANT de préparer la moindre pièce.
 */
export async function envoyerNouvelleVersionAction(
  input: z.input<typeof schemaEnvoiGroupe>,
): Promise<{ data: { resultats: ResultatEnvoiVersion[] } } | Refus> {
  const a = await autorise("contresigner", "nouvelle_version_contrat");
  if ("error" in a) return a;
  const p = schemaEnvoiGroupe.safeParse(input);
  if (!p.success) return { error: "Données invalides (30 formateurs au plus par envoi)." };
  const session = a;
  try {
    const version = versionContratAEmettre();
    if (version === null) return { error: "Aucune version arrêtée du contrat-cadre." };
    const resume = resumeVersionArretee("contrat_sous_traitance", version);
    if (resume === null) {
      return {
        error: `Le résumé des changements de la version ${version} n'est pas écrit au registre des versions : rien n'a été préparé ni envoyé.`,
      };
    }
    if (!(await texteValide(GABARIT_NOUVELLE_VERSION))) {
      return {
        error:
          "L'e-mail « nouvelle version du contrat » n'est pas encore validé : rien n'a été préparé ni envoyé.",
      };
    }
    if (valeursManquantes(GABARIT_NOUVELLE_VERSION, payloadNouvelleVersion("", "x", resume))) {
      return { error: "Le texte de l'e-mail attend une valeur que l'outil ne sait pas remplir." };
    }

    const resultats: ResultatEnvoiVersion[] = [];
    for (const trainerId of [...new Set(p.data.trainerIds)]) {
      const faits = await lireFaitsEmissionContrat(trainerId);
      if (faits === null || !aFaireResigner(faits.contrats, version)) {
        resultats.push({ trainerId, ok: false, message: "Pas concerné par cette version." });
        continue;
      }
      const r = await preparerContratCadre({ trainerId, maintenant: new Date() });
      if (!r.ok) {
        resultats.push({ trainerId, ok: false, message: r.refus.join(" ") });
        continue;
      }
      await logQualiopiActivity({
        action: "qualiopi.formateur.contrat_cadre.prepare",
        targetType: "DocumentGenere",
        targetId: r.documentId,
        changes: { trainerId, version: r.version, remplaces: r.remplaces, nouvelleVersion: true },
        session,
      });
      const lien = await emettreLienSignature({
        documentGenereId: r.documentId,
        partie: "sous_traitant",
        acteur: { session },
      });
      if ("error" in lien) {
        resultats.push({
          trainerId,
          ok: false,
          message: `Contrat ${r.numero} préparé ; ${lien.error}`,
        });
        continue;
      }
      const envoi = await envoyer({
        gabarit: GABARIT_NOUVELLE_VERSION,
        destinataire: faits.email,
        payload: payloadNouvelleVersion(faits.prenom, lien.data.url, resume),
        entityType: "Trainer",
        entityId: trainerId,
        jobId: `fi-contrat-version-${trainerId}-v${r.version}-depart`,
      });
      const parti = envoi === "envoye" || envoi === "en-validation";
      resultats.push({
        trainerId,
        ok: parti,
        message: parti
          ? `Contrat ${r.numero} envoyé.`
          : `Contrat ${r.numero} préparé, mais l'e-mail n'est pas parti : renvoyez le lien depuis sa fiche.`,
      });
    }
    revalidatePath(ECRAN);
    return { data: { resultats } };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "envoyerNouvelleVersionAction" } });
    return {
      error: "L'envoi n'a pas pu aboutir. Les contrats déjà préparés restent sur les fiches.",
    };
  }
}
