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
import { champ, avecErreur, avecSucces } from "@/server/actions/editorial/_form-outils";
import { redirect } from "next/navigation";
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
import {
  dateIsoValide,
  dateUtcStricte,
  heureValide,
  verifierDateIso,
} from "@/server/editorial/calendrier-pur";

export type ActionResult<T> = { data: T } | { error: string; constats?: Constat[] };

// ── Schémas ───────────────────────────────────────────────────────────────

/**
 * La création minimale — **cinq champs**, et c'est un critère du lot 1 :
 * « créer une publication avec 5 champs et l'enregistrer prend moins de
 * 30 secondes ». Tout le reste est facultatif, et doit le rester.
 */
const creationSchema = z.object({
  compteId: z.string().uuid(),
  datePrevue: z.string().refine(dateIsoValide, (v) => ({
    // Le message CITE la valeur fautive et dit ce qui cloche : « 30 février »
    // et « année hors calendrier » ne se corrigent pas de la même façon.
    message: verifierDateIso(v).ok ? "" : (verifierDateIso(v) as { erreur: string }).erreur,
  })),
  heurePrevue: z
    .string()
    .refine(heureValide, "Heure attendue au format HH:MM, entre 00:00 et 23:59"),
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
  /**
   * La version que le formulaire AFFICHAIT au moment de l'ouverture.
   *
   * 🔴 Défaut trouvé par la passe 4 du protocole (adversaire) : sans elle,
   * deux personnes sur la même fiche se marchent dessus EN SILENCE. B ouvre,
   * A réécrit le corps et enregistre, B enregistre — et le texte de A
   * disparaît sans trace, parce que le patch de B porte le contenu périmé
   * qu'il avait sous les yeux. La seule version archivée est celle d'AVANT A.
   * Perte irréversible, réponse `{ ok: true }`.
   *
   * Facultative pour ne pas casser les appels qui ne modifient qu'un champ
   * non versionné ; dès qu'un écran d'édition de contenu existe, il DOIT
   * l'envoyer.
   */
  versionAttendue: z.number().int().min(1).optional(),
});

const deplacementSchema = z.object({
  id: z.string().uuid(),
  datePrevue: z.string().refine(dateIsoValide, (v) => ({
    // Le message CITE la valeur fautive et dit ce qui cloche : « 30 février »
    // et « année hors calendrier » ne se corrigent pas de la même façon.
    message: verifierDateIso(v).ok ? "" : (verifierDateIso(v) as { erreur: string }).erreur,
  })),
  heurePrevue: z
    .string()
    .refine(heureValide, "Heure attendue au format HH:MM, entre 00:00 et 23:59")
    .optional(),
});

const marquagePublieSchema = z.object({
  id: z.string().uuid(),
  urlPubliee: z.string().url("Une URL valide est attendue").max(1024),
});

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
        datePrevue: dateUtcStricte(v.datePrevue),
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
    const { id, motif, lienUrl, versionAttendue, ...patchBrut } = parsed.data;

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
        updatedAt: true,
      },
    });
    if (!existante) return { error: "Publication introuvable" };

    // 🔴 Garde optimiste, premier temps : le formulaire annonce ce qu'il
    // affichait. Si la fiche a bougé depuis, on REFUSE au lieu d'écraser, et
    // le message dit quoi faire — « recharger » est actionnable, « conflit »
    // ne l'est pas.
    if (versionAttendue !== undefined && versionAttendue !== existante.versionCourante) {
      return {
        error:
          `Quelqu'un a modifié cette publication pendant que vous l'éditiez ` +
          `(vous partiez de la version ${versionAttendue}, elle en est à la ` +
          `${existante.versionCourante}). Rechargez la fiche pour repartir du ` +
          `texte à jour : enregistrer maintenant effacerait leur travail.`,
      };
    }

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

      // 🔴 Garde optimiste, second temps : `updateMany` avec la version ET
      // l'horodatage LUS dans le `where`. Postgres réévalue cette clause
      // contre la ligne réellement validée ; si un autre commit s'est
      // intercalé entre la lecture et l'écriture, `count` vaut 0 et rien
      // n'est écrasé. `versionCourante` seule ne suffit PAS : deux
      // modifications sans versionnement la laissent identique.
      const touchees = await tx.edPublication.updateMany({
        where: {
          id,
          versionCourante: existante.versionCourante,
          updatedAt: existante.updatedAt,
        },
        data: {
          accroche: apres.accroche,
          corps: apres.corps,
          premierCommentaire: apres.premierCommentaire,
          tags: apres.tags,
          ...(lienUrl !== undefined ? { lienUrl } : {}),
          // Incrémentée SEULEMENT si le contenu a bougé — critère 8.
          ...(versionCreee ? { versionCourante: { increment: 1 } } : {}),
        },
      });

      if (touchees.count === 0) {
        // Lever DANS la transaction annule aussi la version qu'on venait
        // d'archiver — sinon on laisserait un instantané orphelin qui
        // prétend documenter une modification qui n'a pas eu lieu.
        throw new Error(
          "Quelqu'un a enregistré cette publication pendant votre saisie. " +
            "Rien n'a été écrasé : rechargez la fiche et refaites votre " +
            "modification sur le texte à jour.",
        );
      }

      const apresEcriture = await tx.edPublication.findUniqueOrThrow({
        where: { id },
        select: { id: true, versionCourante: true },
      });
      return apresEcriture;
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
        datePrevue: dateUtcStricte(datePrevue),
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
      select: {
        statutDiffusion: true,
        compteId: true,
        urlPubliee: true,
        publieeA: true,
      },
    });
    if (!publication) return { error: "Publication introuvable" };

    // 🔴 IDEMPOTENCE — la clause la plus importante du §10 : « rejouer ne
    // publie JAMAIS deux fois ». Défaut trouvé par la passe 4 du protocole.
    //
    // `transitionDiffusion` autorise `publie → publie` par son raccourci
    // `de === vers`, qui est le bon choix pour un enregistrement sans
    // changement — mais pas ici. Un second appel réécrivait `urlPubliee`,
    // `publieeA` ET `EdCompte.derniereParutionA`, qui arme l'alerte « canal
    // muet » : un double clic repoussait donc la date de dernière parution
    // d'un compte, et désarmait une alerte qui aurait dû sonner.
    //
    // On court-circuite AVANT la transition, et on le dit — un succès muet
    // laisserait croire que la nouvelle URL a été prise en compte.
    if (publication.statutDiffusion === "publie") {
      if (publication.urlPubliee && publication.urlPubliee !== urlPubliee) {
        return {
          error:
            `Cette publication est déjà marquée publiée, avec une AUTRE URL ` +
            `(${publication.urlPubliee}). Rien n'a été modifié. Corrigez l'URL ` +
            `depuis la fiche si celle-ci est la bonne.`,
        };
      }
      // Même URL : c'est un rejeu. On rend le succès sans rien réécrire.
      return { data: { id } };
    }

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
 * Crée une publication — critère 12 : **cinq champs, moins de 30 secondes**.
 *
 * Compte, date, heure, titre, corps. Rien d'autre n'est demandé, et rien
 * d'autre ne doit l'être : « un outil qui demande douze champs pour noter une
 * idée ne sera pas ouvert deux fois ».
 */
export async function creerPublicationFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const compteId = champ(donnees, "compteId");
  const datePrevue = champ(donnees, "datePrevue");
  const heurePrevue = champ(donnees, "heurePrevue");
  const titreInterne = champ(donnees, "titreInterne");
  const corps = champ(donnees, "corps");

  if (!compteId || !datePrevue || !heurePrevue || !titreInterne) {
    redirect(avecErreur(retour, "Compte, date, heure et titre sont requis."));
  }

  const resultat = await creerPublicationAction({
    compteId,
    datePrevue,
    heurePrevue,
    titreInterne,
    ...(corps ? { corps } : {}),
  });

  if ("error" in resultat) {
    redirect(avecErreur(retour, resultat.error));
  }
  // On atterrit sur la fiche créée : le geste suivant est d'y écrire.
  redirect(`${champ(donnees, "basePublications") ?? retour}/${resultat.data.id}`);
}

/**
 * Valide une publication — critère 7 du lot 1.
 *
 * Le refus de conformité remonte tel quel dans la querystring : il cite déjà
 * la règle, le motif et l'extrait fautif. Le réécrire ici le dégraderait.
 */
export async function validerPublicationFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  if (!id) redirect(avecErreur(retour, "Publication introuvable."));

  const resultat = await validerPublicationAction({ id });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "valide"));
}

/**
 * Marque une publication publiée, avec son URL réelle.
 *
 * ⚠️ L'action est idempotente depuis la passe 4 : rejouer ne republie pas et
 * ne repousse pas `derniereParutionA`, qui arme l'alerte « canal muet ».
 */
export async function marquerPublieeFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  const urlPubliee = champ(donnees, "urlPubliee");
  if (!id) redirect(avecErreur(retour, "Publication introuvable."));
  if (!urlPubliee) {
    redirect(avecErreur(retour, "L'URL réelle de la publication est requise."));
  }

  const resultat = await marquerPublieeAction({ id, urlPubliee });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "publie"));
}

/**
 * Modifie le contenu d'une publication — critère 8 du lot 1.
 *
 * 🔴 `versionAttendue` est transmise depuis le formulaire, et ce n'est pas
 * une formalité : c'est la moitié de la garde anti-écrasement posée par la
 * passe 4. Sans elle, deux personnes sur la même fiche se marchent dessus en
 * silence, et le texte perdu n'existe nulle part.
 */
export async function modifierPublicationFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  if (!id) redirect(avecErreur(retour, "Publication introuvable."));

  const versionBrute = champ(donnees, "versionAttendue");
  const versionAttendue = versionBrute ? Number(versionBrute) : undefined;

  // Un champ vidé volontairement doit pouvoir EFFACER la valeur : on
  // distingue donc « absent du formulaire » (undefined) de « présent et vide »
  // (null). `champ()` rend `undefined` dans les deux cas, d'où la lecture
  // brute ici — sans quoi on ne pourrait jamais retirer une accroche.
  const texte = (nom: string): string | null | undefined => {
    const v = donnees.get(nom);
    if (typeof v !== "string") return undefined;
    const propre = v.trim();
    return propre.length > 0 ? propre : null;
  };

  const accroche = texte("accroche");
  const corps = texte("corps");
  const premierCommentaire = texte("premierCommentaire");
  const lienUrl = texte("lienUrl");
  const tagsBruts = champ(donnees, "tags");
  const motif = champ(donnees, "motif");

  const resultat = await modifierPublicationAction({
    id,
    ...(accroche !== undefined ? { accroche } : {}),
    ...(corps !== undefined ? { corps } : {}),
    ...(premierCommentaire !== undefined ? { premierCommentaire } : {}),
    ...(lienUrl !== undefined ? { lienUrl } : {}),
    ...(tagsBruts !== undefined
      ? { tags: tagsBruts.split(/[\s,]+/).filter((t) => t.length > 0) }
      : {}),
    ...(motif ? { motif } : {}),
    ...(versionAttendue !== undefined && Number.isFinite(versionAttendue)
      ? { versionAttendue }
      : {}),
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(
    resultat.data.versionCreee
      ? avecSucces(retour, "version", String(resultat.data.version))
      : avecSucces(retour, "enregistre"),
  );
}
