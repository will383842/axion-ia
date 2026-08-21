/**
 * Console éditoriale — le téléversement d'assets (critères 4 et 5 du lot 1).
 *
 * > « Déposer un fichier par glisser-déposer crée l'asset, le lie, calcule
 * >   durée et dimensions, génère la vignette — EN UNE ACTION. »
 * > « Déposer deux fois le même fichier SIGNALE un doublon au lieu de le
 * >   dupliquer. »
 *
 * ── Ce que cette action sait faire, et ce qu'elle ne sait pas ─────────────
 *
 * Les dimensions et la vignette sont calculées pour les IMAGES, via `sharp`,
 * déjà présent dans le dépôt.
 *
 * 🔴 **La durée d'une vidéo n'est PAS extraite** : cela demanderait `ffprobe`,
 * qui n'est pas une dépendance de ce projet. `dureeSec` reste donc `null` sur
 * une vidéo déposée, et c'est écrit ici plutôt que silencieusement absent —
 * la règle de conformité `spec-plateforme`, qui compare une durée à la spec,
 * rendra « non évaluée » sur ces assets au lieu de les déclarer conformes.
 * Ajouter `ffprobe` est un choix d'infrastructure (binaire système dans
 * l'image Docker), pas une ligne de code : il revient à Will.
 */

"use server";

import fs from "node:fs/promises";
import { champ, avecErreur, avecSucces } from "@/server/actions/editorial/_form-outils";
import { redirect } from "next/navigation";
import path from "node:path";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import {
  validerFichier,
  empreinte,
  cheminRelatif,
  cheminAbsolu,
  cheminVignette,
  urlPublique,
} from "@/server/editorial/stockage";
import type { ActionResult } from "@/server/actions/editorial/publications";

const televersementSchema = z.object({
  publicationId: z.string().uuid().optional(),
  libelle: z.string().trim().max(200).optional(),
});

export interface AssetTeleverse {
  id: string;
  libelle: string;
  url: string;
  doublon: boolean;
  largeurPx: number | null;
  hauteurPx: number | null;
  dureeSec: number | null;
  /** Ce que l'action n'a pas su calculer, dit explicitement. */
  avertissement: string | null;
}

/** Écrit un fichier en créant son arborescence. */
async function ecrire(relatif: string, contenu: Buffer): Promise<void> {
  const absolu = cheminAbsolu(relatif);
  await fs.mkdir(path.dirname(absolu), { recursive: true });
  await fs.writeFile(absolu, contenu);
}

/**
 * Téléverse un fichier et crée son asset — en UNE action.
 *
 * L'ordre compte : on empreint AVANT d'écrire. Un doublon ne touche donc
 * jamais le disque, et le fichier déjà là n'est pas réécrit.
 */
export async function televerserAssetAction(
  donnees: FormData,
): Promise<ActionResult<AssetTeleverse>> {
  try {
    const membre = await requirePermission("asset.ecrire");

    const fichier = donnees.get("fichier");
    if (!(fichier instanceof File)) return { error: "Aucun fichier reçu." };

    const parsed = televersementSchema.safeParse({
      publicationId: (donnees.get("publicationId") as string) || undefined,
      libelle: (donnees.get("libelle") as string) || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { publicationId } = parsed.data;

    const verdict = validerFichier(fichier.type, fichier.size);
    if (!verdict.accepte) return { error: verdict.message };

    const contenu = Buffer.from(await fichier.arrayBuffer());
    const emp = empreinte(contenu);

    // ── Le doublon, AVANT toute écriture — critère 5 ─────────────────────
    const existant = await prisma.edAsset.findFirst({
      where: { empreinte: emp },
      select: {
        id: true,
        libelle: true,
        cheminObjet: true,
        largeurPx: true,
        hauteurPx: true,
        dureeSec: true,
      },
    });

    if (existant) {
      // On SIGNALE, on ne duplique pas. Et si la publication demande ce
      // média, on le LIE quand même : le geste de l'utilisateur avait un
      // sens, seul le second exemplaire n'en avait pas.
      if (publicationId) {
        await prisma.edAssetPublication.upsert({
          where: { assetId_publicationId: { assetId: existant.id, publicationId } },
          create: { assetId: existant.id, publicationId, ordre: 0 },
          update: {},
        });
      }
      return {
        data: {
          id: existant.id,
          libelle: existant.libelle,
          url: existant.cheminObjet ? urlPublique(existant.cheminObjet) : "",
          doublon: true,
          largeurPx: existant.largeurPx,
          hauteurPx: existant.hauteurPx,
          dureeSec: existant.dureeSec,
          avertissement:
            `Ce fichier existe déjà sous « ${existant.libelle} ». ` +
            `Il a été rattaché plutôt que dupliqué.`,
        },
      };
    }

    // ── L'écriture ────────────────────────────────────────────────────────
    const extension = verdict.extension as string;
    const famille = verdict.famille as string;
    const relatif = cheminRelatif(emp, extension);
    await ecrire(relatif, contenu);

    // ── Dimensions et vignette ────────────────────────────────────────────
    let largeurPx: number | null = null;
    let hauteurPx: number | null = null;
    let relatifVignette: string | null = null;
    let avertissement: string | null = null;

    if (famille === "image") {
      try {
        const meta = await sharp(contenu).metadata();
        largeurPx = meta.width ?? null;
        hauteurPx = meta.height ?? null;

        const vignette = await sharp(contenu)
          .resize(400, 400, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        relatifVignette = cheminVignette(emp);
        await ecrire(relatifVignette, vignette);
      } catch (e) {
        // Une vignette ratée ne doit pas perdre le fichier : il est déjà
        // écrit, et l'asset vaut mieux sans miniature que pas d'asset.
        avertissement = `Vignette non générée : ${e instanceof Error ? e.message : "erreur"}.`;
      }
    } else if (famille === "video" || famille === "audio") {
      // 🔴 Dit, plutôt que tu. Voir l'en-tête du fichier.
      avertissement =
        "Durée non calculée : ce projet n'embarque pas `ffprobe`. " +
        "Renseignez-la à la main si la règle « spec-plateforme » doit s'appliquer.";
    }

    const typeAsset =
      famille === "image"
        ? "image"
        : famille === "video"
          ? "video"
          : famille === "audio"
            ? "audio"
            : "document";

    const libelle =
      parsed.data.libelle?.trim() ||
      fichier.name.replace(/\.[^.]+$/, "").slice(0, 200) ||
      "Sans titre";

    const asset = await prisma.edAsset.create({
      data: {
        type: typeAsset,
        nature: "autonome",
        usage: "organique",
        libelle,
        cheminObjet: relatif,
        cheminVignette: relatifVignette,
        empreinte: emp,
        poidsOctets: BigInt(contenu.length),
        largeurPx,
        hauteurPx,
        // 🔴 `en_cours`, et SURTOUT PAS `pret`.
        //
        // Défaut trouvé par la passe 5 du protocole : écrire `pret` ici
        // contournait DEUX règles d'un coup.
        //
        //  - Le critère 5 du lot 2 — « un asset dont la durée dépasse la spec
        //    ne passe pas à `pret` ». Aucune spec n'est consultée au dépôt,
        //    et pour cause : on ne connaît pas encore la plateforme visée.
        //  - Le §4 — le rôle `montage` a `asset.ecrire` mais PAS
        //    `asset.valider`. Il pouvait donc produire un asset `pret` par
        //    la porte du téléversement, en contournant celle qui lui est
        //    fermée.
        //
        // Déposer un fichier n'est pas le valider. Le passage à `pret` vit
        // dans `passerAssetPretAction`, qui exige `asset.valider` ET vérifie
        // la spec de plateforme.
        statut: "en_cours",
        responsableId: membre.membreId,
      },
      select: { id: true },
    });

    if (publicationId) {
      const dejaLies = await prisma.edAssetPublication.count({ where: { publicationId } });
      await prisma.edAssetPublication.create({
        data: { assetId: asset.id, publicationId, ordre: dejaLies },
      });
      // La publication suit l'asset : le travail a commencé, il n'est pas
      // validé. La faire passer à « prêt » ici ferait taire l'alerte
      // `asset-retard` sur un asset que personne n'a encore relu — l'alerte
      // se tairait précisément quand elle devient utile.
      await prisma.edPublication.update({
        where: { id: publicationId },
        data: { statutAsset: "en_cours" },
      });
    }

    await journaliser({
      entite: "EdAsset",
      entiteId: asset.id,
      action: "televersement",
      membreId: membre.membreId,
      apres: { libelle, empreinte: emp, octets: contenu.length, publicationId },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");

    return {
      data: {
        id: asset.id,
        libelle,
        url: urlPublique(relatif),
        doublon: false,
        largeurPx,
        hauteurPx,
        dureeSec: null,
        avertissement,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/** Détache un asset d'une publication — sans supprimer le fichier. */
export async function detacherAssetAction(input: {
  assetId: string;
  publicationId: string;
}): Promise<ActionResult<{ ok: true }>> {
  try {
    const membre = await requirePermission("asset.ecrire");
    const parsed = z
      .object({ assetId: z.string().uuid(), publicationId: z.string().uuid() })
      .safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };

    await prisma.edAssetPublication.delete({
      where: {
        assetId_publicationId: {
          assetId: parsed.data.assetId,
          publicationId: parsed.data.publicationId,
        },
      },
    });

    await journaliser({
      entite: "EdAsset",
      entiteId: parsed.data.assetId,
      action: "detachement",
      membreId: membre.membreId,
      avant: { publicationId: parsed.data.publicationId },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ok: true } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

// ── Les adaptateurs de formulaire ─────────────────────────────────────────
//
// Un `<form action={…}>` HTML nu ne sait pas lire une valeur de retour : ces
// adaptateurs prennent un `FormData` et REDIRIGENT, le seul protocole qu'il
// comprenne nativement. C'est ce qui permet aux écrans de saisie de rester
// des Server Components — consommer un `{ data } | { error }` demanderait
// `useActionState`, donc du JavaScript client sur chaque écran.
//
// 🔑 Ils vivent ICI, à côté des actions qu'ils adaptent, et non dans un
// module central. Voir `_form-outils.ts` : la garde `D3-3-05` du dépôt
// raisonne au grain du fichier, et un module dont aucune action n'est nommée
// par un écran est signalé — à juste titre, car un lecteur qui cherche les
// appelants ne trouve rien non plus.

/**
 * Détache un asset d'une publication — le lien, pas l'asset.
 *
 * ⚠️ Le §4 réserve « supprimer quoi que ce soit » à l'admin, et l'action
 * n'exige aujourd'hui que `asset.ecrire`, que le rôle `montage` possède. La
 * passe 4 a signalé l'écart sans trancher, et il reste ouvert : « modifier un
 * asset » et « supprimer un lien » sont défendables l'un comme l'autre. Le
 * geste est donc branché tel quel, et la question posée à Will — pas résolue
 * en douce par un choix d'écran.
 */
export async function detacherAssetFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  const publicationId = champ(donnees, "publicationId");
  if (!assetId || !publicationId) redirect(avecErreur(retour, "Lien introuvable."));

  const resultat = await detacherAssetAction({ assetId, publicationId });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "detacheLien"));
}
