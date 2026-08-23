/**
 * Qualiopi — Server Actions Sous-traitants OF (T12).
 *
 * creerSousTraitantAction      : enregistre un sous-traitant de l'OF.
 * updateSousTraitantAction     : corrige un sous-traitant existant (NDA, contrat, archivage).
 * verifierSousTraitantOfAction : marque la vérification data.gouv.fr.
 *
 * off.27 : sous-traitants prestataires ≠ formateurs individuels.
 * Délègue au service registre (Agent A).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { siretField } from "@/lib/siret-schema";
import { premierMessageZod } from "@/lib/zod-message";
import {
  requireHabilitation,
  requireAdminWrite,
  logQualiopiActivity,
} from "@/server/actions/qualiopi/_guards";
import {
  creerSousTraitant,
  updateSousTraitant,
  verifierDataGouv,
  getSousTraitant,
} from "@/server/qualiopi/registres/sous-traitants-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const creerSousTraitantSchema = z.object({
  nom: z.string().min(1).max(250),
  // Un sous-traitant de l'OF est un organisme français (indicateur 27) : même
  // règle que pour un client. `max(20)` laissait passer n'importe quoi ; la
  // valeur normalisée fait 14 caractères et tient dans la colonne VarChar(20).
  siret: siretField.optional(),
  nda: z.string().max(20).optional(),
  objetPrestation: z.string().min(1),
  /**
   * 🔴 Contact SIGNATAIRE. Sans `contactEmail`, aucun lien de signature ne peut
   * être émis pour le contrat de sous-traitance — et l'indicateur 27 du RNQ
   * l'exige signé. Le canal A résout l'identité depuis la BASE, jamais depuis un
   * champ libre au moment de signer.
   */
  contactNom: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactFonction: z.string().max(200).optional(),
  contratSigneAt: z.coerce.date().optional(),
  actif: z.boolean().default(true),
});

/**
 * Correction d'un sous-traitant déjà enregistré.
 *
 * 🔴 Ce schéma manquait, et avec lui toute la chaîne : `updateSousTraitant()`
 * existait au service depuis T12 **sans aucun appelant hors de sa propre spec**.
 * `nda`, `contratSigneAt` et `actif` n'étaient donc saisissables qu'À LA
 * CRÉATION — or les deux premiers sont deux des trois conditions du numérateur
 * de l'indicateur 27 (`conformite-service.ts:332-339`), qui est un
 * SUPER-indicateur : un organisme créé avant la signature de son contrat restait
 * définitivement non conforme, et une ligne créée par erreur ne pouvait pas être
 * archivée — elle polluait le dénominateur à vie.
 *
 * `.nullable()` sur les colonnes nullables : `null` efface, `undefined` laisse
 * en l'état. Même contrat que `sousTraitantPiecesSchema` ci-dessous.
 *
 * Garde : `requireAdminWrite`, comme la création et comme `updatePartenariatAction`
 * — exiger ici davantage qu'à la création rendrait la correction plus difficile
 * que la saisie initiale, ce qui est exactement le défaut qu'on répare.
 */
const updateSousTraitantSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).max(250).optional(),
  siret: siretField.nullable().optional(),
  nda: z.string().max(20).nullable().optional(),
  objetPrestation: z.string().min(1).optional(),
  contactNom: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  contactFonction: z.string().max(200).nullable().optional(),
  contratSigneAt: z.coerce.date().nullable().optional(),
  actif: z.boolean().optional(),
});

const verifierSousTraitantOfSchema = z.object({
  id: z.string().uuid(),
  verifieDataGouvAt: z.coerce.date().optional(),
});

/**
 * Pièces de sous-traitance d'un ORGANISME (art. 4 et 8, 2026-08-03).
 *
 * Mêmes pièces que pour un formateur indépendant : la procédure ne distingue
 * pas les deux natures, et une divergence de règle entre elles serait invisible
 * jusqu'à ce qu'un auditeur la relève.
 *
 * `.nullable()` partout : `null` retire une pièce, `undefined` la laisse en
 * l'état — sans cette distinction, enregistrer la RC pro effacerait le CV.
 */
const sousTraitantPiecesSchema = z.object({
  id: z.string().uuid(),
  prochaineVerifAt: z.coerce.date().nullable().optional(),
  rcProAttestationUrl: z.string().url().max(2000).nullable().optional(),
  rcProEcheanceAt: z.coerce.date().nullable().optional(),
  cvUrl: z.string().url().max(2000).nullable().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre un nouveau sous-traitant dans le registre.
 */
export async function creerSousTraitantAction(input: {
  nom: string;
  siret?: string;
  nda?: string;
  objetPrestation: string;
  contactNom?: string;
  contactEmail?: string;
  contactFonction?: string;
  contratSigneAt?: Date;
  actif?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerSousTraitantSchema.safeParse(input);
  if (!parsed.success) return { error: premierMessageZod(parsed.error) };
  const v = parsed.data;

  let sousTraitant: { id: string };
  try {
    sousTraitant = await creerSousTraitant({
      nom: v.nom,
      objetPrestation: v.objetPrestation,
      actif: v.actif,
      ...(v.siret !== undefined ? { siret: v.siret } : {}),
      ...(v.nda !== undefined ? { nda: v.nda } : {}),
      ...(v.contactNom !== undefined ? { contactNom: v.contactNom } : {}),
      ...(v.contactEmail !== undefined ? { contactEmail: v.contactEmail } : {}),
      ...(v.contactFonction !== undefined ? { contactFonction: v.contactFonction } : {}),
      ...(v.contratSigneAt !== undefined ? { contratSigneAt: v.contratSigneAt } : {}),
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement du sous-traitant" };
  }

  await logQualiopiActivity({
    action: "qualiopi.sous_traitant.create",
    targetType: "SousTraitant",
    targetId: sousTraitant.id,
    changes: { nom: v.nom, siret: v.siret, nda: v.nda },
    session,
  });

  return { data: { id: sousTraitant.id } };
}

/**
 * Corrige un sous-traitant déjà enregistré (identité, NDA, contrat, archivage).
 *
 * 🔴 Pendant exact de `updatePartenariatAction` : les deux registres partagent
 * la même forme (service `update*` + action + panneau `*RowActions`), mais la
 * moitié sous-traitance s'arrêtait au service. Le voisin était complet, celui-ci
 * tronqué — et personne ne l'a vu, parce qu'aucune garde ne cherche l'APPELANT
 * d'une fonction de service.
 *
 * ⚠️ `siret` suit le contrat documenté de `siretField` : une chaîne vide rend
 * `undefined` (« ne rien changer »), il faut passer `null` pour effacer.
 */
export async function updateSousTraitantAction(input: {
  id: string;
  nom?: string;
  siret?: string | null;
  nda?: string | null;
  objetPrestation?: string;
  contactNom?: string | null;
  contactEmail?: string | null;
  contactFonction?: string | null;
  contratSigneAt?: Date | null;
  actif?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateSousTraitantSchema.safeParse(input);
  if (!parsed.success) return { error: premierMessageZod(parsed.error) };
  const { id, ...fields } = parsed.data;

  const existe = await getSousTraitant(id);
  if (existe === null) return { error: "Sous-traitant introuvable" };

  try {
    await updateSousTraitant(id, {
      ...(fields.nom !== undefined ? { nom: fields.nom } : {}),
      ...(fields.siret !== undefined ? { siret: fields.siret } : {}),
      ...(fields.nda !== undefined ? { nda: fields.nda } : {}),
      ...(fields.objetPrestation !== undefined ? { objetPrestation: fields.objetPrestation } : {}),
      ...(fields.contactNom !== undefined ? { contactNom: fields.contactNom } : {}),
      ...(fields.contactEmail !== undefined ? { contactEmail: fields.contactEmail } : {}),
      ...(fields.contactFonction !== undefined ? { contactFonction: fields.contactFonction } : {}),
      ...(fields.contratSigneAt !== undefined ? { contratSigneAt: fields.contratSigneAt } : {}),
      ...(fields.actif !== undefined ? { actif: fields.actif } : {}),
    });
  } catch {
    return { error: "Erreur lors de la mise à jour du sous-traitant" };
  }

  await logQualiopiActivity({
    action: "qualiopi.sous_traitant.update",
    targetType: "SousTraitant",
    targetId: id,
    changes: fields,
    session,
  });

  return { data: { id } };
}

/**
 * Marque la vérification data.gouv.fr d'un sous-traitant (NDA actif confirmé).
 */
export async function verifierSousTraitantOfAction(input: {
  id: string;
  verifieDataGouvAt?: Date;
}): Promise<ActionResult<{ id: string; verifieDataGouvAt: Date }>> {
  // Acte ENGAGEANT : verification de l'organisme sous-traitant au registre.
  const session = await requireHabilitation("habiliter_formateur");
  const parsed = verifierSousTraitantOfSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, verifieDataGouvAt } = parsed.data;

  const existe = await getSousTraitant(id);
  if (existe === null) return { error: "Sous-traitant introuvable" };

  let updated: { id: string; verifieDataGouvAt: Date | null };
  try {
    updated = await verifierDataGouv(id, verifieDataGouvAt);
  } catch {
    return { error: "Sous-traitant introuvable ou erreur de mise à jour" };
  }

  const dateVerif = updated.verifieDataGouvAt ?? verifieDataGouvAt ?? new Date();

  await logQualiopiActivity({
    action: "qualiopi.sous_traitant.verifie_data_gouv",
    targetType: "SousTraitant",
    targetId: id,
    changes: { verifieDataGouvAt: dateVerif },
    session,
  });

  return { data: { id, verifieDataGouvAt: dateVerif } };
}

/**
 * Enregistre les pièces de sous-traitance d'un ORGANISME — art. 4 et 8.
 *
 * 🔴 Pendant exact de `updateTrainerSousTraitancePiecesAction` : les colonnes
 * posées par la migration du 2026-08-03 sur `sous_traitants_of` n'avaient elles
 * non plus aucun écrivain. Traiter une seule des deux natures aurait laissé la
 * moitié du vivier sans moyen de compléter son dossier.
 */
export async function updateSousTraitantPiecesAction(input: {
  id: string;
  prochaineVerifAt?: Date | null;
  rcProAttestationUrl?: string | null;
  rcProEcheanceAt?: Date | null;
  cvUrl?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = sousTraitantPiecesSchema.safeParse(input);
  if (!parsed.success) return { error: premierMessageZod(parsed.error) };
  const { id, ...v } = parsed.data;

  const existe = await getSousTraitant(id);
  if (existe === null) return { error: "Sous-traitant introuvable" };

  try {
    await prisma.sousTraitant.update({
      where: { id },
      data: {
        ...(v.prochaineVerifAt !== undefined ? { prochaineVerifAt: v.prochaineVerifAt } : {}),
        ...(v.rcProAttestationUrl !== undefined
          ? { rcProAttestationUrl: v.rcProAttestationUrl }
          : {}),
        ...(v.rcProEcheanceAt !== undefined ? { rcProEcheanceAt: v.rcProEcheanceAt } : {}),
        ...(v.cvUrl !== undefined
          ? {
              cvUrl: v.cvUrl,
              // Le CV et sa date de dépôt sont une seule preuve : l'article 4
              // exige un CV de MOINS DE 24 MOIS, ce qu'une URL sans date ne
              // permet pas de vérifier.
              cvUploadedAt: v.cvUrl === null ? null : new Date(),
            }
          : {}),
      },
    });
  } catch {
    return { error: "Erreur lors de l'enregistrement des pièces du sous-traitant." };
  }

  await logQualiopiActivity({
    action: "qualiopi.sous_traitant.pieces",
    targetType: "SousTraitant",
    targetId: id,
    changes: v,
    session,
  });

  return { data: { id } };
}
