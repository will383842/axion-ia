/**
 * Console éditoriale — Server Actions des publications (lot 1).
 *
 * Convention du dépôt : Server Actions, pas d'API REST. Une action par
 * mutation, validée par Zod, journalisée dans `EdJournal`.
 *
 * Les quatre décisions difficiles vivent ailleurs, dans des modules PURS et
 * testés — ce fichier ne fait que les ORCHESTRER :
 *
 * | Décision                      | Où elle vit                          |
 * | ----------------------------- | ------------------------------------ |
 * | Qui a le droit                | `editorial/permissions.ts`           |
 * | Faut-il créer une version     | `editorial/publication-edition.ts`   |
 * | La transition est-elle permise| `editorial/publication-edition.ts`   |
 * | Le texte est-il conforme      | `editorial/conformite/evaluateur.ts` |
 *
 * C'est ce découpage qui rend le lot testable sans base : la logique est
 * pure, l'orchestration est mince.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import {
  doitVersionner,
  champsModifies,
  instantaneAvant,
  appliquer,
  transitionRedaction,
  transitionDiffusion,
  type ContenuPublication,
  type StatutRedaction,
  type StatutDiffusion,
} from "@/server/editorial/publication-edition";
import {
  evaluerConformite,
  type RegleEvaluable,
  type Constat,
} from "@/server/editorial/conformite/evaluateur";

export type ActionResult<T> = { data: T } | { error: string; constats?: Constat[] };

// ── Schémas ───────────────────────────────────────────────────────────────

/**
 * La création minimale — **cinq champs**, et c'est un critère du lot 1 :
 * « créer une publication avec 5 champs et l'enregistrer prend moins de
 * 30 secondes ». Tout le reste est facultatif, et doit le rester.
 */
const creationSchema = z.object({
  compteId: z.string().uuid(),
  datePrevue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
  heurePrevue: z.string().regex(/^\d{2}:\d{2}$/, "Heure attendue au format HH:MM"),
  titreInterne: z.string().trim().min(1, "Un titre interne est requis").max(200),
  corps: z.string().max(20_000).optional(),
});

const modificationSchema = z.object({
  id: z.string().uuid(),
  accroche: z.string().max(2_000).nullable().optional(),
  corps: z.string().max(20_000).nullable().optional(),
  premierCommentaire: z.string().max(20_000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  lienUrl: z.string().max(1024).nullable().optional(),
  /** Pourquoi cette version. Facultatif, fortement encouragé. */
  motif: z.string().max(500).optional(),
});

const deplacementSchema = z.object({
  id: z.string().uuid(),
  datePrevue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  heurePrevue: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

const marquagePublieSchema = z.object({
  id: z.string().uuid(),
  urlPubliee: z.string().url("Une URL valide est attendue").max(1024),
});

/** `AAAA-MM-JJ` → `Date` à minuit UTC. Jamais `new Date(a, m, j)`. */
function dateUtc(iso: string): Date {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a as number, (m as number) - 1, j as number));
}

function messageErreur(e: unknown): string {
  return e instanceof Error ? e.message : "Erreur inattendue";
}

// ── Créer ─────────────────────────────────────────────────────────────────

export async function creerPublicationAction(
  input: z.input<typeof creationSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("publication.ecrire");
    const parsed = creationSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const v = parsed.data;

    const compte = await prisma.edCompte.findUnique({ where: { id: v.compteId } });
    if (!compte) return { error: "Compte introuvable" };

    const publication = await prisma.edPublication.create({
      data: {
        compteId: v.compteId,
        datePrevue: dateUtc(v.datePrevue),
        heurePrevue: v.heurePrevue,
        titreInterne: v.titreInterne,
        corps: v.corps ?? null,
        // Une publication qui naît avec un corps est déjà « rédigée » : la
        // faire naître « idée » obligerait à un second geste pour rien.
        statutRedaction: v.corps ? "redige" : "idee",
        responsableId: membre.membreId,
      },
      select: { id: true },
    });

    await journaliser({
      entite: "EdPublication",
      entiteId: publication.id,
      action: "creation",
      membreId: membre.membreId,
      apres: { titreInterne: v.titreInterne, compteId: v.compteId },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { id: publication.id } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}

// ── Modifier le contenu — et versionner s'il le faut ───────────────────────

export async function modifierPublicationAction(
  input: z.input<typeof modificationSchema>,
): Promise<ActionResult<{ id: string; version: number; versionCreee: boolean }>> {
  try {
    const membre = await requirePermission("publication.ecrire");
    const parsed = modificationSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { id, motif, lienUrl, ...patchBrut } = parsed.data;

    const existante = await prisma.edPublication.findUnique({
      where: { id },
      select: {
        id: true,
        accroche: true,
        corps: true,
        premierCommentaire: true,
        tags: true,
        lienUrl: true,
        versionCourante: true,
      },
    });
    if (!existante) return { error: "Publication introuvable" };

    const avant: ContenuPublication = {
      accroche: existante.accroche,
      corps: existante.corps,
      premierCommentaire: existante.premierCommentaire,
      tags: existante.tags,
    };

    const versionCreee = doitVersionner(avant, patchBrut);
    const modifies = champsModifies(avant, patchBrut);
    const apres = appliquer(avant, patchBrut);

    const resultat = await prisma.$transaction(async (tx) => {
      // 🔴 L'ANCIEN contenu est archivé AVANT d'appliquer le patch : la
      // version N porte ce qui était affiché quand N était courante.
      if (versionCreee) {
        const snap = instantaneAvant(avant, existante.versionCourante, motif);
        await tx.edPublicationVersion.create({
          data: {
            publicationId: id,
            version: snap.version,
            accroche: snap.accroche,
            corps: snap.corps,
            premierCommentaire: snap.premierCommentaire,
            tags: snap.tags,
            motif: snap.motif,
            auteurId: membre.membreId,
          },
        });
      }

      return tx.edPublication.update({
        where: { id },
        data: {
          accroche: apres.accroche,
          corps: apres.corps,
          premierCommentaire: apres.premierCommentaire,
          tags: apres.tags,
          ...(lienUrl !== undefined ? { lienUrl } : {}),
          // Incrémentée SEULEMENT si le contenu a bougé — critère 8.
          ...(versionCreee ? { versionCourante: { increment: 1 } } : {}),
        },
        select: { id: true, versionCourante: true },
      });
    });

    await journaliser({
      entite: "EdPublication",
      entiteId: id,
      action: versionCreee ? "modification" : "modification_sans_version",
      membreId: membre.membreId,
      avant: versionCreee ? { version: existante.versionCourante, champs: modifies } : undefined,
      apres: { version: resultat.versionCourante, champs: modifies },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { id, version: resultat.versionCourante, versionCreee } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}

// ── Valider — c'est ici que la conformité mord ────────────────────────────

/**
 * Passe une publication à `valide`.
 *
 * 🔴 Les critères 14 et 15 du lot 1 se jouent ici : un corps contenant
 * « Grenoble » ou un lien sans `utm_content` est REFUSÉ, avec le motif et
 * l'extrait fautif. Les règles sont lues **en base** à chaque appel — jamais
 * mises en cache : un seuil corrigé depuis la console doit mordre au coup
 * suivant, pas au prochain déploiement.
 */
export async function validerPublicationAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("publication.valider");
    const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };
    const { id } = parsed.data;

    const publication = await prisma.edPublication.findUnique({
      where: { id },
      select: {
        id: true,
        accroche: true,
        corps: true,
        premierCommentaire: true,
        tags: true,
        lienUrl: true,
        statutRedaction: true,
      },
    });
    if (!publication) return { error: "Publication introuvable" };

    const verdict = transitionRedaction(publication.statutRedaction as StatutRedaction, "valide");
    if (!verdict.autorisee) return { error: verdict.message };

    const regles = (await prisma.edRegleConformite.findMany({
      where: { actif: true },
      orderBy: { code: "asc" },
    })) as unknown as RegleEvaluable[];

    const resultat = evaluerConformite(regles, {
      accroche: publication.accroche,
      corps: publication.corps,
      premierCommentaire: publication.premierCommentaire,
      tags: publication.tags,
      lienUrl: publication.lienUrl,
    });

    if (!resultat.validable) {
      // Le refus CITE la règle et l'extrait. Un refus muet est un échec.
      return {
        error: resultat.bloquantes.map((c) => c.message).join("\n"),
        constats: resultat.bloquantes,
      };
    }

    await prisma.edPublication.update({
      where: { id },
      data: { statutRedaction: "valide" },
    });

    await journaliser({
      entite: "EdPublication",
      entiteId: id,
      action: "validation",
      membreId: membre.membreId,
      avant: { statutRedaction: publication.statutRedaction },
      apres: {
        statutRedaction: "valide",
        avertissements: resultat.avertissements.map((c) => c.code),
        nonEvaluees: resultat.nonEvaluees.map((c) => c.code),
      },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { id } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}

/**
 * Contrôle de conformité SANS muter — pour afficher l'état en cours de
 * rédaction, avant que l'utilisateur ne tente de valider.
 */
export async function controlerConformiteAction(input: {
  id: string;
}): Promise<ActionResult<{ validable: boolean; constats: Constat[] }>> {
  try {
    await requirePermission("voir");
    const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return { error: "Données invalides" };

    const publication = await prisma.edPublication.findUnique({
      where: { id: parsed.data.id },
      select: {
        accroche: true,
        corps: true,
        premierCommentaire: true,
        tags: true,
        lienUrl: true,
      },
    });
    if (!publication) return { error: "Publication introuvable" };

    const regles = (await prisma.edRegleConformite.findMany({
      where: { actif: true },
      orderBy: { code: "asc" },
    })) as unknown as RegleEvaluable[];

    const r = evaluerConformite(regles, publication);
    return { data: { validable: r.validable, constats: r.constats } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}

// ── Déplacer dans le calendrier ───────────────────────────────────────────

/**
 * Déplace une publication — le glisser-déposer du critère 13.
 *
 * ⚠️ Ne crée AUCUNE version : une date n'est pas du contenu.
 */
export async function deplacerPublicationAction(
  input: z.input<typeof deplacementSchema>,
): Promise<ActionResult<{ id: string; datePrevue: string }>> {
  try {
    const membre = await requirePermission("publication.ecrire");
    const parsed = deplacementSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { id, datePrevue, heurePrevue } = parsed.data;

    const avant = await prisma.edPublication.findUnique({
      where: { id },
      select: { datePrevue: true, heurePrevue: true },
    });
    if (!avant) return { error: "Publication introuvable" };

    await prisma.edPublication.update({
      where: { id },
      data: {
        datePrevue: dateUtc(datePrevue),
        ...(heurePrevue ? { heurePrevue } : {}),
      },
    });

    await journaliser({
      entite: "EdPublication",
      entiteId: id,
      action: "deplacement",
      membreId: membre.membreId,
      avant: {
        datePrevue: avant.datePrevue.toISOString().slice(0, 10),
        heurePrevue: avant.heurePrevue,
      },
      apres: { datePrevue, heurePrevue: heurePrevue ?? avant.heurePrevue },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { id, datePrevue } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}

// ── Marquer publié ────────────────────────────────────────────────────────

export async function marquerPublieeAction(
  input: z.input<typeof marquagePublieSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("publication.marquerPublie");
    const parsed = marquagePublieSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { id, urlPubliee } = parsed.data;

    const publication = await prisma.edPublication.findUnique({
      where: { id },
      select: { statutDiffusion: true, compteId: true },
    });
    if (!publication) return { error: "Publication introuvable" };

    const verdict = transitionDiffusion(publication.statutDiffusion as StatutDiffusion, "publie");
    if (!verdict.autorisee) return { error: verdict.message };

    const publieeA = new Date();

    await prisma.$transaction([
      prisma.edPublication.update({
        where: { id },
        data: { statutDiffusion: "publie", urlPubliee, publieeA },
      }),
      // `derniereParutionA` est RECALCULÉ ici, jamais agrégé au rendu :
      // c'est ce qui arme l'alerte « canal muet » sans coûter un agrégat
      // à chaque affichage du tableau de bord.
      prisma.edCompte.update({
        where: { id: publication.compteId },
        data: { derniereParutionA: publieeA },
      }),
    ]);

    await journaliser({
      entite: "EdPublication",
      entiteId: id,
      action: "publication",
      membreId: membre.membreId,
      avant: { statutDiffusion: publication.statutDiffusion },
      apres: { statutDiffusion: "publie", urlPubliee },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { id } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}
