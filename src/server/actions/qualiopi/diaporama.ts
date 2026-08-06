/**
 * Génération du DIAPORAMA PROJETÉ d'une formation, au format .pptx.
 *
 * ## Où atterrit le fichier, et pourquoi là
 *
 * Dans le slot `diaporama` du kit documentaire — exactement là où vivent les
 * .pptx déposés à la main. Trois raisons :
 *
 *  1. le modèle `InterventionDocumentVersion` est déjà BI-FORMAT (`sourceKey` +
 *     `sourceFormat` + `pdfKey`), là où `SupportFormation` ne connaît qu'un
 *     couple PDF. Aucune migration n'est nécessaire ;
 *  2. `InterventionDocSource` porte déjà `qualiopi_genere` : l'origine du
 *     fichier est dite dans la donnée, pas devinée ;
 *  3. l'écran « Tout pour animer » lit déjà ce slot. Le diaporama généré
 *     apparaît donc là où le formateur le cherche, sans écran supplémentaire.
 *
 * ## Ce qui protège les 35 diaporamas déjà déposés
 *
 * Une génération crée TOUJOURS une nouvelle version, en `brouillon`. Elle ne
 * réutilise jamais un brouillon existant — celui-ci peut appartenir à un dépôt
 * manuel en cours, et l'écraser détruirait un travail en cours sans le dire.
 * Et tant que Will n'a pas publié la version générée, c'est la version déposée
 * qui reste servie. L'import manuel n'est pas seulement « encore possible » : il
 * garde la main.
 *
 * ## Ce qui empêche l'inflation de versions
 *
 * Un contenu identique ne crée pas de version : on compare l'empreinte SHA-256
 * à celle de la dernière version. Cliquer deux fois sur le bouton ne produit pas
 * deux versions, et régénérer après une modification qui ne touche pas ce
 * diaporama ne produit rien non plus.
 */

"use server";

import { createHash } from "node:crypto";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { uploadToR2, isR2Configured } from "@/lib/r2-storage";
import { buildR2Key } from "@/server/intervention-documents/keys";
import { DIAPORAMA_SLOT_KEY } from "@/server/intervention-documents/kit-mapping";
import { getSlot } from "@/content/intervention-documents-catalog";
import { modulesBrutsProgramme } from "@/server/qualiopi/documents/programme-modules";
import { construireDeck } from "@/server/qualiopi/supports/pptx/deck";
import { rendreDeckEnPptx } from "@/server/qualiopi/supports/pptx/render-pptx";
import { resolveInterventionSlugForFormation } from "@/server/qualiopi/vente/kit-formation";
import type { ModuleProgramme } from "@/server/qualiopi/supports/types";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { revalidateFormationPages } from "./_revalidate";

const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const schema = z.object({ formationId: z.string().uuid() });

export type GenererDiaporamaResult =
  { ok: true; version: number; slides: number; inchange: boolean } | { ok: false; error: string };

/**
 * Nombre de slides qui portent réellement du contenu pédagogique.
 *
 * Une couverture et un sommaire se construisent à partir des seuls titres : un
 * deck qui n'a QUE cela est un deck vide, et le produire donnerait à croire que
 * la formation est outillée. Mieux vaut refuser en nommant ce qui manque.
 */
function slidesDeContenu(slides: ReadonlyArray<{ layout: string }>): number {
  return slides.filter((s) => s.layout !== "couverture" && s.layout !== "sommaire").length;
}

export async function genererDiaporamaAction(raw: unknown): Promise<GenererDiaporamaResult> {
  const session = await requireAdminWrite();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };

  if (!isR2Configured()) return { ok: false, error: "Stockage R2 non configuré." };

  const formation = await prisma.formation.findUnique({
    where: { id: parsed.data.formationId },
    select: { id: true, slug: true, titre: true, dureeHeures: true, programmeDetaille: true },
  });
  if (!formation) return { ok: false, error: "Formation introuvable." };

  /**
   * La jointure formation ↔ kit n'existe que par convention de slug. Une
   * formation sur mesure ou dupliquée n'a pas de kit : on le dit, plutôt que
   * d'écrire un fichier dans un slot qui n'appartient à personne.
   */
  const interventionSlug = resolveInterventionSlugForFormation(formation);
  if (interventionSlug === null) {
    return {
      ok: false,
      error:
        "Cette formation n'est rattachée à aucun kit documentaire : le diaporama n'aurait pas d'emplacement.",
    };
  }

  // Les modules BRUTS, pas la lecture normalisee pour l'impression : celle-ci
  // ecarte les cinq blocs, et le diaporama serait creux sans qu'on le voie.
  const modules = modulesBrutsProgramme(formation.programmeDetaille);
  const deck = construireDeck({
    titreFormation: formation.titre,
    modules: modules as unknown as ModuleProgramme[],
    dureeHeures: formation.dureeHeures,
  });

  if (slidesDeContenu(deck.slides) === 0) {
    return {
      ok: false,
      error:
        "Le programme n'a pas encore de contenu rédigé : le diaporama ne contiendrait que ses titres de modules.",
    };
  }

  const fichier = await rendreDeckEnPptx(deck);
  const empreinte = createHash("sha256").update(fichier).digest("hex");

  /**
   * Le slot vient du catalogue, jamais d'un repli. Inventer une catégorie
   * placerait le document dans une rubrique qui n'existe pas, et l'écran
   * « Tout pour animer » ne le trouverait plus.
   */
  const slotDef = getSlot("formation", DIAPORAMA_SLOT_KEY);
  if (slotDef === undefined) {
    return { ok: false, error: "Le slot « diaporama » est absent du catalogue documentaire." };
  }

  const doc = await prisma.interventionDocument.upsert({
    where: {
      interventionSlug_slot: { interventionSlug, slot: DIAPORAMA_SLOT_KEY },
    },
    create: {
      interventionSlug,
      famille: "formation",
      categorie: slotDef.categorie,
      slot: DIAPORAMA_SLOT_KEY,
      titre: slotDef.titre,
      visibilite: slotDef.visibilite,
      source: "qualiopi_genere",
    },
    update: {},
  });

  const derniere = await prisma.interventionDocumentVersion.findFirst({
    where: { documentId: doc.id },
    orderBy: { version: "desc" },
    select: { version: true, hashSha256: true },
  });
  if (derniere?.hashSha256 === empreinte) {
    return { ok: true, version: derniere.version, slides: deck.slides.length, inchange: true };
  }

  // TOUJOURS une nouvelle version : un brouillon existant peut appartenir à un
  // dépôt manuel en cours, et le réutiliser détruirait un travail sans le dire.
  const version = (derniere?.version ?? 0) + 1;
  const cle = buildR2Key(interventionSlug, DIAPORAMA_SLOT_KEY, version, "source", "pptx");

  try {
    await uploadToR2(cle, fichier, MIME_PPTX, {
      formationId: formation.id,
      slides: String(deck.slides.length),
    });
  } catch {
    return { ok: false, error: "Le fichier n'a pas pu être déposé sur le stockage." };
  }

  const creee = await prisma.interventionDocumentVersion.create({
    data: {
      documentId: doc.id,
      version,
      statut: "brouillon",
      sourceKey: cle,
      sourceFormat: "pptx",
      sourceSizeBytes: fichier.length,
      hashSha256: empreinte,
      changeNote: `Généré depuis le programme (${deck.slides.length} slides, ${deck.slides.filter((s) => s.notes !== undefined).length} avec notes formateur).`,
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.diaporama.generer",
    targetType: "InterventionDocumentVersion",
    targetId: creee.id,
    changes: {
      formationId: formation.id,
      interventionSlug,
      version,
      slides: deck.slides.length,
    },
    session,
  });

  revalidateFormationPages({ slug: formation.slug });

  return { ok: true, version, slides: deck.slides.length, inchange: false };
}
