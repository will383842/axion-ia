/**
 * Console éditoriale — recettes, dérivation et les deux gardes du lot 2.
 *
 * Ce fichier ORCHESTRE ; toutes les décisions vivent dans
 * `@/server/editorial/derivation`, module pur couvert par 40 tests. Ici on ne
 * fait que charger, appliquer, journaliser.
 */

"use server";

import { z } from "zod";
import { champ, avecErreur, avecSucces } from "@/server/actions/editorial/_form-outils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import {
  derivesDeRecette,
  creeraitUnCycle,
  peutProgrammer,
  peutPasserPret,
  type AssetDerivable,
} from "@/server/editorial/derivation";
import { transitionDiffusion, type StatutDiffusion } from "@/server/editorial/publication-edition";
import type { ActionResult } from "@/server/actions/editorial/publications";

/**
 * Charge la CHAÎNE D'ANCÊTRES d'un asset — lui, son parent, son grand-parent…
 *
 * 🔴 Défaut trouvé par la passe 4 du protocole (adversaire).
 *
 * `rattacherAssetAction` appelait `chargerLot(parentId)` pour alimenter
 * `creeraitUnCycle`. Or `chargerLot` DESCEND (`JOIN arbre ON a.parent_id =
 * arbre.id`) alors que `creeraitUnCycle` REMONTE (`parents.get(courant)`).
 * La carte des parents s'arrêtait donc au premier maillon, et la garde ne
 * gardait qu'un seul niveau :
 *
 *     base : r → x → y   (on rattache r sous y ⇒ cycle r→y→x→r)
 *     lot descendant     : [y, x] … mais la LIGNE de x manquait
 *     creeraitUnCycle    → false ⇒ le cycle s'écrivait en base
 *
 * La fonction pure était juste ; on lui donnait le mauvais objet. C'est
 * exactement le §1 du protocole — « une gate qui mesurait un fichier de
 * configuration pendant que le conteneur tournait avec une autre valeur ».
 *
 * ⚠️ La borne `niveau < 64` n'est pas une commodité : si un cycle est DÉJÀ en
 * base (écrit par la version fautive de cette garde), Postgres boucle
 * lui-même et l'applicatif n'a jamais la main. Elle est plus large que la
 * borne de `chargerLot` parce qu'une chaîne d'ancêtres légitime peut être
 * longue, là où une descendance de dérivés reste plate.
 */
async function chargerAncetres(departId: string): Promise<AssetDerivable[]> {
  const lignes = await prisma.$queryRaw<{ id: string; parentId: string | null }[]>`
    WITH RECURSIVE ancetres AS (
      SELECT id, parent_id, 0 AS niveau
      FROM ed_assets WHERE id = ${departId}::uuid
      UNION ALL
      SELECT a.id, a.parent_id, ancetres.niveau + 1
      FROM ed_assets a
      JOIN ancetres ON ancetres.parent_id = a.id
      WHERE ancetres.niveau < 64
    )
    SELECT id::text AS id, parent_id::text AS "parentId" FROM ancetres
  `;
  // `creeraitUnCycle` ne lit que `id` et `parentId` ; le reste n'est là que
  // pour satisfaire le type.
  return lignes.map((l) => ({
    id: l.id,
    libelle: "",
    type: "",
    nature: "",
    statut: "",
    parentId: l.parentId,
    offsetSourceSec: null,
    familleId: null,
    dureeSec: null,
  }));
}

/** Charge les assets d'un arbre — la racine et toute sa descendance. */
async function chargerLot(racineId: string): Promise<AssetDerivable[]> {
  // Une descendance à profondeur inconnue se remonte par une récursive SQL :
  // quatre allers-retours Prisma pour quatre niveaux coûteraient plus cher,
  // et ne borneraient toujours pas la profondeur.
  const lignes = await prisma.$queryRaw<AssetDerivable[]>`
    WITH RECURSIVE arbre AS (
      SELECT id, libelle, type::text, nature::text, statut::text, parent_id,
             offset_source_sec, famille_id, duree_sec, 0 AS niveau
      FROM ed_assets WHERE id = ${racineId}::uuid
      UNION ALL
      SELECT a.id, a.libelle, a.type::text, a.nature::text, a.statut::text, a.parent_id,
             a.offset_source_sec, a.famille_id, a.duree_sec, arbre.niveau + 1
      FROM ed_assets a
      JOIN arbre ON a.parent_id = arbre.id
      -- Borne DURE : sans elle, un cycle en base ferait boucler Postgres
      -- lui-même, et la garde applicative n'aurait jamais la main.
      WHERE arbre.niveau < 10
    )
    SELECT id::text AS id, libelle, type, nature, statut,
           parent_id::text AS "parentId",
           offset_source_sec AS "offsetSourceSec",
           famille_id::text AS "familleId",
           duree_sec AS "dureeSec"
    FROM arbre
  `;
  return lignes;
}

/**
 * Applique une recette à un asset source — critère 1 du lot 2.
 *
 * > « Un asset enregistré avec une recette crée automatiquement ses dérivés
 * >   en `a_produire`. »
 *
 * Transactionnel : une recette à moitié appliquée laisserait un épisode avec
 * douze shorts sur trente-deux, sans que rien ne dise lesquels manquent.
 */
export async function appliquerRecetteAction(input: {
  assetId: string;
  recetteId: string;
}): Promise<ActionResult<{ crees: number }>> {
  try {
    const membre = await requirePermission("asset.ecrire");
    const parsed = z
      .object({ assetId: z.string().uuid(), recetteId: z.string().uuid() })
      .safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };
    const { assetId, recetteId } = parsed.data;

    const [source, recette] = await Promise.all([
      prisma.edAsset.findUnique({ where: { id: assetId }, select: { id: true, libelle: true } }),
      prisma.edRecette.findUnique({
        where: { id: recetteId },
        select: {
          nom: true,
          actif: true,
          lignes: {
            select: {
              familleId: true,
              quantite: true,
              compteId: true,
              note: true,
              famille: { select: { nom: true, type: true } },
            },
          },
        },
      }),
    ]);

    if (!source) return { error: "Asset source introuvable" };
    if (!recette) return { error: "Recette introuvable" };
    if (!recette.actif) return { error: `La recette « ${recette.nom} » est désactivée.` };
    if (recette.lignes.length === 0) {
      return { error: `La recette « ${recette.nom} » ne produit rien : elle n'a aucune ligne.` };
    }

    const aCreer = derivesDeRecette(
      source.libelle,
      recette.lignes.map((l) => ({
        familleId: l.familleId,
        familleNom: l.famille.nom,
        quantite: l.quantite,
        compteId: l.compteId,
        note: l.note,
      })),
    );

    const typeParFamille = new Map(
      recette.lignes.map((l) => [l.familleId, l.famille.type as string]),
    );

    await prisma.$transaction(async (tx) => {
      for (const d of aCreer) {
        await tx.edAsset.create({
          data: {
            type: (typeParFamille.get(d.familleId) ?? "video") as never,
            familleId: d.familleId,
            nature: "derive",
            usage: "organique",
            libelle: d.libelle,
            parentId: assetId,
            statut: "a_produire",
          },
        });
      }
    });

    await journaliser({
      entite: "EdAsset",
      entiteId: assetId,
      action: "recette_appliquee",
      membreId: membre.membreId,
      apres: { recette: recette.nom, crees: aCreer.length },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { crees: aCreer.length } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/**
 * Rattache un asset à un parent — en refusant les cycles.
 *
 * Le contrôle a lieu AVANT l'écriture : refuser après demanderait de défaire
 * ce qui vient d'être fait.
 */
export async function rattacherAssetAction(input: {
  assetId: string;
  parentId: string | null;
  offsetSourceSec?: number | null;
}): Promise<ActionResult<{ ok: true }>> {
  try {
    const membre = await requirePermission("asset.ecrire");
    const parsed = z
      .object({
        assetId: z.string().uuid(),
        parentId: z.string().uuid().nullable(),
        offsetSourceSec: z.number().int().min(0).nullable().optional(),
      })
      .safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };
    const { assetId, parentId, offsetSourceSec } = parsed.data;

    if (parentId) {
      // 🔴 Les ANCÊTRES du parent proposé — surtout pas sa descendance.
      // Voir `chargerAncetres` pour le défaut que cette ligne corrige : un
      // cycle naît quand l'asset qu'on rattache se trouve déjà quelque part
      // AU-DESSUS du parent qu'on lui donne, et seule la remontée le voit.
      const complet = await chargerAncetres(parentId);

      if (creeraitUnCycle(complet, assetId, parentId)) {
        return {
          error:
            "Rattachement refusé : il créerait un cycle de dérivation. " +
            "Un asset ne peut pas descendre de lui-même, même indirectement.",
        };
      }
    }

    await prisma.edAsset.update({
      where: { id: assetId },
      data: {
        parentId,
        ...(offsetSourceSec !== undefined ? { offsetSourceSec } : {}),
        nature: parentId ? "derive" : "autonome",
      },
    });

    await journaliser({
      entite: "EdAsset",
      entiteId: assetId,
      action: "rattachement",
      membreId: membre.membreId,
      apres: { parentId, offsetSourceSec },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ok: true } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/**
 * Passe un asset à `pret` — critère 5 du lot 2.
 *
 * La spec est lue EN BASE (`ed_specs_plateforme`), croisée avec la plateforme
 * du compte visé par les publications de cet asset. Pas de spec applicable ⇒
 * pas de blocage : on ne refuse que sur une contradiction ÉTABLIE.
 */
export async function passerAssetPretAction(input: {
  assetId: string;
}): Promise<ActionResult<{ ok: true; avertissement: string | null }>> {
  try {
    const membre = await requirePermission("asset.valider");
    const parsed = z.object({ assetId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };

    const asset = await prisma.edAsset.findUnique({
      where: { id: parsed.data.assetId },
      select: {
        libelle: true,
        dureeSec: true,
        familleId: true,
        statut: true,
        publications: {
          select: { publication: { select: { compte: { select: { plateforme: true } } } } },
        },
      },
    });
    if (!asset) return { error: "Asset introuvable" };

    // La spec dépend du couple (plateforme, famille). Un asset non rattaché à
    // une publication n'a pas de plateforme visée : rien à vérifier.
    let verdict = { autorise: true, message: "", indetermine: false as boolean | undefined };
    if (asset.familleId && asset.publications.length > 0) {
      const plateformes = [
        ...new Set(asset.publications.map((p) => p.publication.compte.plateforme)),
      ];
      const specs = await prisma.edSpecPlateforme.findMany({
        where: { familleId: asset.familleId, plateforme: { in: plateformes } },
        select: { dureeMinSec: true, dureeMaxSec: true, plateforme: true },
      });
      for (const spec of specs) {
        const v = peutPasserPret(
          { libelle: asset.libelle, dureeSec: asset.dureeSec },
          {
            dureeMinSec: spec.dureeMinSec,
            dureeMaxSec: spec.dureeMaxSec,
            plateforme: spec.plateforme,
          },
        );
        if (!v.autorise) return { error: v.message };
        if (v.indetermine) verdict = { ...v, indetermine: true };
      }
    }

    await prisma.edAsset.update({
      where: { id: parsed.data.assetId },
      data: { statut: "pret" },
    });

    await journaliser({
      entite: "EdAsset",
      entiteId: parsed.data.assetId,
      action: "validation",
      membreId: membre.membreId,
      avant: { statut: asset.statut },
      apres: { statut: "pret", specNonVerifiee: verdict.indetermine ?? false },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ok: true, avertissement: verdict.indetermine ? verdict.message : null } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/**
 * Programme une publication — critère 4 du lot 2.
 *
 * > « Un épisode dont l'autorisation n'est pas `signee` NE PEUT PAS passer
 * >   une publication à `programme`. »
 *
 * On remonte des assets liés vers leurs invités : c'est `EdEpisodeInvite` qui
 * porte le statut d'autorisation, et un short hérite du droit de l'épisode
 * dont il est tiré — d'où la remontée par l'arbre de dérivation.
 */
export async function programmerPublicationAction(input: {
  id: string;
  outil?: string;
  refExterne?: string;
}): Promise<ActionResult<{ ok: true }>> {
  try {
    const membre = await requirePermission("publication.ecrire");
    const parsed = z
      .object({
        id: z.string().uuid(),
        outil: z.string().max(60).optional(),
        refExterne: z.string().max(160).optional(),
      })
      .safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };
    const { id, outil, refExterne } = parsed.data;

    const publication = await prisma.edPublication.findUnique({
      where: { id },
      select: {
        statutDiffusion: true,
        datePrevue: true,
        assets: { select: { assetId: true } },
      },
    });
    if (!publication) return { error: "Publication introuvable" };

    const verdictTransition = transitionDiffusion(
      publication.statutDiffusion as StatutDiffusion,
      "programme",
    );
    if (!verdictTransition.autorisee) return { error: verdictTransition.message };

    // ── La garde de droit à l'image ──────────────────────────────────────
    if (publication.assets.length > 0) {
      // Un short hérite du droit de son épisode : on remonte l'arbre.
      const racines = new Set<string>();
      for (const { assetId } of publication.assets) {
        const lot = await chargerLot(assetId);
        for (const a of lot) racines.add(a.id);
        // …et vers le haut aussi.
        let courant = await prisma.edAsset.findUnique({
          where: { id: assetId },
          select: { parentId: true },
        });
        let garde = 0;
        while (courant?.parentId && garde < 10) {
          racines.add(courant.parentId);
          courant = await prisma.edAsset.findUnique({
            where: { id: courant.parentId },
            select: { parentId: true },
          });
          garde += 1;
        }
      }

      const autorisations = await prisma.edEpisodeInvite.findMany({
        where: { assetId: { in: [...racines] } },
        select: {
          autorisationStatut: true,
          valableJusquA: true,
          invite: { select: { nom: true } },
        },
      });

      const verdict = peutProgrammer(
        autorisations.map((a) => ({
          inviteNom: a.invite.nom,
          statut: a.autorisationStatut,
          valableJusquA: a.valableJusquA,
        })),
        publication.datePrevue,
      );
      if (!verdict.autorise) return { error: verdict.message };
    }

    await prisma.edPublication.update({
      where: { id },
      data: {
        statutDiffusion: "programme",
        ...(outil ? { outilProgrammation: outil } : {}),
        ...(refExterne ? { refExterne } : {}),
      },
    });

    await journaliser({
      entite: "EdPublication",
      entiteId: id,
      action: "programmation",
      membreId: membre.membreId,
      avant: { statutDiffusion: publication.statutDiffusion },
      apres: { statutDiffusion: "programme", outil, refExterne },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ok: true } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

/**
 * ⚠️ VOLONTAIREMENT branchée à aucun écran — ce n'est pas un oubli.
 *
 * `mediatheque/[id]/page.tsx` construit l'arbre lui-même, par une seule
 * requête récursive qui remonte ET redescend. Passer par cette action
 * ajouterait un aller-retour pour le même résultat.
 *
 * Elle reste ici parce qu'elle est le seul point d'entrée utilisable
 * depuis un composant client, le jour où l'arbre deviendra dépliable.
 *
 * 🔑 La garde `D3-3-05` du dépôt ne rougit pas dessus : elle raisonne au
 * grain du FICHIER, et les autres actions de ce module atteignent bien
 * un écran. Le noter ici évite qu'un futur lecteur la croie orpheline.
 */
/** L'arbre complet d'un asset — pour l'écran de médiathèque. */
export async function chargerArbreAction(
  racineId: string,
): Promise<ActionResult<AssetDerivable[]>> {
  try {
    await requirePermission("voir");
    const parsed = z.string().uuid().safeParse(racineId);
    if (!parsed.success) return { error: "Identifiant invalide" };
    return { data: await chargerLot(parsed.data) };
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

/** Programme une publication — le contrôle des assets se fait dans l'action. */
export async function programmerPublicationFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  if (!id) redirect(avecErreur(retour, "Publication introuvable."));

  const outil = champ(donnees, "outil");
  const refExterne = champ(donnees, "refExterne");
  const resultat = await programmerPublicationAction({
    id,
    ...(outil ? { outil } : {}),
    ...(refExterne ? { refExterne } : {}),
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "programme"));
}

/** Applique une recette de dérivation — critère 1 du lot 2. */
export async function appliquerRecetteFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  const recetteId = champ(donnees, "recetteId");
  if (!assetId || !recetteId) {
    redirect(avecErreur(retour, "Choisissez une recette à appliquer."));
  }

  const resultat = await appliquerRecetteAction({ assetId, recetteId });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "derives", String(resultat.data.crees)));
}

/**
 * Passe un asset à `pret` — critère 5 du lot 2.
 *
 * 🔴 C'est LA porte de validation, et elle exige `asset.valider`, que le rôle
 * `montage` n'a pas. La passe 5 avait trouvé qu'on pouvait la contourner par
 * le téléversement ; ce chemin est fermé depuis, et celui-ci est le seul.
 *
 * L'avertissement (durée indéterminée) remonte à l'écran : passer sans
 * pouvoir vérifier la spec n'est pas la même chose que passer en la
 * vérifiant, et l'écran doit le dire.
 */
export async function passerAssetPretFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  if (!assetId) redirect(avecErreur(retour, "Asset introuvable."));

  const resultat = await passerAssetPretAction({ assetId });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  const base = avecSucces(retour, "pret");
  redirect(
    resultat.data.avertissement
      ? `${base}&avertissement=${encodeURIComponent(resultat.data.avertissement)}`
      : base,
  );
}

/**
 * Rattache un asset à un parent — critère 2 du lot 2.
 *
 * 🔴 Ce geste porte la garde anti-cycle corrigée par la passe 4. Tant
 * qu'aucun écran ne l'appelait, la garde n'était pas vérifiable : le §1 du
 * protocole demande qu'une garde rougisse « sur l'objet qui casse », et un
 * objet qu'on ne peut pas soumettre ne casse jamais rien.
 *
 * Un parent vide DÉTACHE — l'asset redevient `autonome`. C'est le même
 * geste, dans l'autre sens, et un second bouton l'aurait dédoublé.
 */
export async function rattacherAssetFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const assetId = champ(donnees, "assetId");
  if (!assetId) redirect(avecErreur(retour, "Asset introuvable."));

  const parentId = champ(donnees, "parentId") ?? null;
  const offsetBrut = champ(donnees, "offsetSourceSec");
  const offset = offsetBrut ? Number(offsetBrut) : undefined;

  const resultat = await rattacherAssetAction({
    assetId,
    parentId,
    ...(offset !== undefined && Number.isFinite(offset) ? { offsetSourceSec: offset } : {}),
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, parentId ? "rattache" : "detache"));
}
