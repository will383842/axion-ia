/**
 * Console éditoriale — les réglages (§8).
 *
 * ## Ce que cet écran répare
 *
 * 🔴 Trois de mes commentaires affirmaient qu'« un seuil se corrige depuis la
 * console sans pull request ». C'était **faux** : les règles vivaient bien en
 * base, mais aucun écran ne les modifiait. Il fallait un accès à Postgres.
 *
 * La passe 5 du protocole l'a relevé, et c'était plus qu'une lacune de
 * confort : la promesse du §8 — « corriger un seuil un dimanche soir » — est
 * ce qui justifie que les seuils vivent en base plutôt que dans le code. Sans
 * l'écran, on payait le coût de l'indirection sans en toucher le bénéfice.
 *
 * ## ⚠️ Ce qui est modifiable, et ce qui ne l'est pas
 *
 * On peut changer : l'activation, la gravité, les paramètres (seuils, listes),
 * le message rendu à l'utilisateur.
 *
 * On ne peut PAS changer : le `code` d'une règle. C'est la clé stable sur
 * laquelle `evaluerRegle` branche ses évaluateurs structurels (`tags-nombre`,
 * `utm`, `spec-plateforme`…). La renommer depuis l'écran ferait basculer la
 * règle en évaluation par motif, silencieusement, et le libellé ne le dirait
 * pas.
 *
 * Le `motifRegex` est modifiable, mais **passe par la même garde que
 * l'évaluateur** : un motif à quantificateurs imbriqués est refusé à
 * l'enregistrement plutôt qu'au moment où il gèlera la console.
 */

"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import { champ, avecErreur, avecSucces } from "@/server/actions/editorial/_form-outils";
import { motifRisque } from "@/server/editorial/conformite/evaluateur";
import type { ActionResult } from "@/server/actions/editorial/publications";

const GRAVITES = ["info", "avertissement", "bloquant"] as const;

/**
 * Les paramètres sont du JSON libre côté base, mais pas côté écran.
 *
 * ⚠️ On refuse ce qui n'est pas un OBJET. Un tableau ou un scalaire passerait
 * la validation JSON et casserait `regle.parametres?.["champs"]` au premier
 * contrôle — sans erreur, en rendant simplement « non évaluée » pour toujours.
 */
function lireParametres(
  brut: string | undefined,
): { ok: true; valeur: unknown } | { ok: false; erreur: string } {
  if (brut === undefined || brut.trim().length === 0) return { ok: true, valeur: null };
  let parse: unknown;
  try {
    parse = JSON.parse(brut);
  } catch (e) {
    return {
      ok: false,
      erreur: `Paramètres illisibles : ${e instanceof Error ? e.message : "JSON invalide"}.`,
    };
  }
  if (parse === null) return { ok: true, valeur: null };
  if (typeof parse !== "object" || Array.isArray(parse)) {
    return {
      ok: false,
      erreur:
        "Les paramètres doivent être un objet JSON, par exemple " +
        `{"min":3,"max":4}. Un tableau ou un nombre seul serait accepté par la ` +
        "base et ignoré par l'évaluateur, ce qui rendrait la règle muette.",
    };
  }
  return { ok: true, valeur: parse };
}

const regleConformiteSchema = z.object({
  id: z.string().uuid(),
  actif: z.boolean(),
  gravite: z.enum(GRAVITES),
  message: z
    .string()
    .trim()
    .min(1, "Un message est requis — c'est ce que l'utilisateur lira.")
    .max(2_000),
  motifRegex: z.string().max(2_000),
  parametres: z.unknown(),
});

/** Modifie une règle de conformité — critère du §8. */
export async function modifierRegleConformiteAction(
  input: z.input<typeof regleConformiteSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("reglages.gerer");
    const parsed = regleConformiteSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { id, actif, gravite, message, motifRegex, parametres } = parsed.data;

    // 🔴 La MÊME garde que l'évaluateur, appliquée à l'écriture.
    //
    // Refuser au moment de l'enregistrement plutôt qu'au moment où le motif
    // gèlera la console : l'auteur est encore devant son écran, il sait ce
    // qu'il vient de taper, et il peut corriger. Découvrir la panne trois
    // jours plus tard sur une validation qui n'aboutit pas coûte infiniment
    // plus cher.
    if (motifRegex.length > 0 && motifRisque(motifRegex)) {
      return {
        error:
          "Motif refusé : il contient un quantificateur dans un groupe lui-même " +
          "quantifié, ce qui peut geler l'évaluation pendant plusieurs minutes " +
          "sur un texte court. Réécrivez-le sans imbriquer les répétitions.",
      };
    }

    // Un motif illisible se refuse aussi ici : la base l'accepterait, et
    // l'évaluateur rendrait « non évaluée » sans que personne ne sache
    // pourquoi.
    if (motifRegex.length > 0) {
      try {
        new RegExp(motifRegex, "gi");
      } catch (e) {
        return {
          error: `Motif illisible : ${e instanceof Error ? e.message : "expression invalide"}.`,
        };
      }
    }

    const avant = await prisma.edRegleConformite.findUnique({
      where: { id },
      select: { code: true, actif: true, gravite: true, motifRegex: true, parametres: true },
    });
    if (!avant) return { error: "Règle introuvable." };

    await prisma.edRegleConformite.update({
      where: { id },
      data: {
        actif,
        gravite,
        message,
        motifRegex,
        parametres: (parametres ?? null) as never,
      },
    });

    await journaliser({
      entite: "EdRegleConformite",
      entiteId: id,
      action: "reglage",
      membreId: membre.membreId,
      avant: { code: avant.code, actif: avant.actif, gravite: avant.gravite },
      apres: { code: avant.code, actif, gravite },
    });

    // ⚠️ Aucun cache à invalider : `evaluerRegle` lit les règles EN BASE à
    // chaque appel, jamais en mémoire. C'est ce qui fait qu'un seuil corrigé
    // mord au coup suivant et non au prochain déploiement — et c'est
    // exactement la promesse que cet écran rend enfin tenable.
    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "layout");
    return { data: { id } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

const regleAlerteSchema = z.object({
  id: z.string().uuid(),
  actif: z.boolean(),
  gravite: z.enum(GRAVITES),
  parametres: z.unknown(),
});

/** Modifie une règle d'alerte — les seuils du tableau de bord. */
export async function modifierRegleAlerteAction(
  input: z.input<typeof regleAlerteSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("reglages.gerer");
    const parsed = regleAlerteSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { id, actif, gravite, parametres } = parsed.data;

    const avant = await prisma.edRegleAlerte.findUnique({
      where: { id },
      select: { code: true, actif: true, gravite: true },
    });
    if (!avant) return { error: "Règle introuvable." };

    // ⚠️ `EdRegleAlerte.parametres` est NON nullable : une alerte sans seuil
    // ne veut rien dire. On refuse le vide plutôt que d'écrire `{}`, qui
    // désarmerait l'alerte en silence.
    if (parametres === null || parametres === undefined) {
      return {
        error:
          'Une règle d\'alerte a besoin de son seuil : `{"jours": 3}`, ' +
          '`{"minParMois": 4}`… Sans paramètres, elle ne se déclenche jamais.',
      };
    }

    await prisma.edRegleAlerte.update({
      where: { id },
      data: { actif, gravite, parametres: parametres as never },
    });

    await journaliser({
      entite: "EdRegleAlerte",
      entiteId: id,
      action: "reglage",
      membreId: membre.membreId,
      avant: { code: avant.code, actif: avant.actif, gravite: avant.gravite },
      apres: { code: avant.code, actif, gravite },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "layout");
    return { data: { id } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue" };
  }
}

// ── Les adaptateurs de formulaire ─────────────────────────────────────────
//
// Voir `_form-outils.ts` : ils vivent à côté de l'action qu'ils adaptent, et
// non dans un module central — la garde `D3-3-05` raisonne au grain du
// fichier.

export async function modifierRegleConformiteFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  if (!id) redirect(avecErreur(retour, "Règle introuvable."));

  const params = lireParametres(donnees.get("parametres") as string | undefined);
  if (!params.ok) redirect(avecErreur(retour, params.erreur));

  const resultat = await modifierRegleConformiteAction({
    id,
    // Une case décochée n'est PAS envoyée par le navigateur : son absence
    // vaut `false`, et c'est le seul moyen de désactiver une règle.
    actif: donnees.get("actif") === "on",
    gravite: (champ(donnees, "gravite") ?? "bloquant") as (typeof GRAVITES)[number],
    message: champ(donnees, "message") ?? "",
    motifRegex: (donnees.get("motifRegex") as string | null)?.trim() ?? "",
    parametres: params.valeur,
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "regle"));
}

export async function modifierRegleAlerteFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  if (!id) redirect(avecErreur(retour, "Règle introuvable."));

  const params = lireParametres(donnees.get("parametres") as string | undefined);
  if (!params.ok) redirect(avecErreur(retour, params.erreur));

  const resultat = await modifierRegleAlerteAction({
    id,
    actif: donnees.get("actif") === "on",
    gravite: (champ(donnees, "gravite") ?? "avertissement") as (typeof GRAVITES)[number],
    parametres: params.valeur,
  });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "alerte"));
}
