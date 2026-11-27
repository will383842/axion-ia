/**
 * Fiche de brief SEO d'un article (équipe éditoriale, PR 3).
 *
 * Module PUR : schéma zod + import du plan éditorial en briefs. Aucun accès base ni réseau.
 * Chaque question réelle porte son ORIGINE (obligatoire) : une question sans origine est refusée.
 */

import { z } from "zod";
import { slugify } from "@/lib/slug";

export const ORIGINES_QUESTION = ["search-console", "plan-editorial", "autre-source"] as const;
export const INTENTIONS = ["information", "comparaison", "decision"] as const;
export const TYPES_BRIEF = ["neuf", "mise-a-jour"] as const;

/**
 * Chaîne éditoriale (C3) : statuts en TEXTE en base (aucune énumération Postgres, donc rien à
 * ajouter avant de l'émettre : un worker plus ancien ignore simplement ces tables). Un statut
 * nouveau s'ajoute ici, jamais par migration.
 */
export const STATUTS_BESOIN = ["nouveau", "en_brief", "couvert", "ecarte"] as const;
export const STATUTS_BRIEF = [
  "brouillon",
  "valide",
  "pas_d_angle",
  "pas_de_matiere",
  "abandonne",
] as const;
export const STATUTS_PROPOSITION = ["a_relire", "appliquee", "refusee", "reportee"] as const;
export const NIVEAUX_TITRE = [1, 2, 3] as const;
/** Borne haute de sécurité d'une fourchette de longueur, en mots. */
export const FOURCHETTE_LONGUEUR_MAX_MOTS = 10000;

const texte = (max: number) => z.string().trim().min(1).max(max);

export const questionSchema = z
  .object({
    question: texte(300),
    origine: z.enum(ORIGINES_QUESTION),
    /** Page, requête, n° de plan ou source : jamais vide. */
    reference: texte(300),
  })
  .strict();

/** Plan de titres H1/H2/H3 du brief (ordre = ordre de lecture). */
export const planTitresSchema = z
  .array(
    z
      .object({
        niveau: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        titre: texte(200),
      })
      .strict(),
  )
  .max(60);

export const briefSchema = z
  .object({
    motCle: texte(200),
    intention: z.enum(INTENTIONS),
    requetesSecondaires: z.array(texte(200)).max(20),
    champSemantique: z.array(texte(100)).max(40),
    entites: z.array(texte(100)).max(30),
    questions: z.array(questionSchema).max(20),
    urlCible: z
      .string()
      .url()
      .refine((u) => u.startsWith("https://"), { message: "URL absolue en https attendue" }),
    cluster: texte(200),
    type: z.enum(TYPES_BRIEF),
    // ── Chaîne éditoriale (C3) : tous optionnels, un brief ancien reste valide ──
    /** Intention de recherche (mêmes valeurs que `intention`). */
    intentionRecherche: z.enum(INTENTIONS).nullish(),
    planTitres: planTitresSchema.nullish(),
    longueurMinMots: z.number().int().min(1).max(FOURCHETTE_LONGUEUR_MAX_MOTS).nullish(),
    longueurMaxMots: z.number().int().min(1).max(FOURCHETTE_LONGUEUR_MAX_MOTS).nullish(),
  })
  .strict()
  .refine(
    (b) =>
      b.longueurMinMots == null ||
      b.longueurMaxMots == null ||
      b.longueurMinMots <= b.longueurMaxMots,
    { message: "longueurMinMots doit être ≤ longueurMaxMots", path: ["longueurMinMots"] },
  );

export type Question = z.infer<typeof questionSchema>;
export type Brief = z.infer<typeof briefSchema>;

// ── Import du plan éditorial ────────────────────────────────────────────────

export const URL_SITE_PAR_DEFAUT = "https://axion-ia.com";

const INTENTION_PLAN: Readonly<Record<string, Brief["intention"]>> = {
  information: "information",
  comparaison: "comparaison",
  decision: "decision",
  décision: "decision",
};

function nettoyer(cellule: string): string {
  return cellule
    .replace(/[«»`]/g, "")
    .replace(/[\s  ]+/g, " ")
    .trim();
}

/**
 * Lit le tableau « Les 40 articles » du plan (docs/contenu/plan-editorial-journee-ia-*.md)
 * et rend un brief par ligne numérotée. Colonnes : n°, question, mot-clé, intention, angle,
 * persona, type, lien interne, semaine. Le plan ne porte pas de slug : l'URL cible est
 * `<site>/fr/blog/<slug du mot-clé>` (prévue, à confirmer à la publication). Le cluster est la
 * page de rattachement (lien interne). Une ligne invalide est écartée et listée dans `rejets`.
 */
export function importerPlanEditorial(
  markdown: string,
  urlSite: string = URL_SITE_PAR_DEFAUT,
): { briefs: Brief[]; rejets: Array<{ ligne: number; raison: string }> } {
  const briefs: Brief[] = [];
  const rejets: Array<{ ligne: number; raison: string }> = [];
  const base = urlSite.replace(/\/+$/, "");

  for (const ligne of markdown.split(/\r?\n/)) {
    if (!ligne.trimStart().startsWith("|")) continue;
    const cellules = ligne
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map(nettoyer);
    const numero = Number(cellules[0]);
    if (!/^\d+$/.test(cellules[0] ?? "")) continue;
    if (cellules.length < 8) {
      rejets.push({ ligne: numero, raison: "colonnes manquantes" });
      continue;
    }
    const [, question = "", motCle = "", intention = "", , , , lien = ""] = cellules;
    const slug = slugify(motCle);
    const resultat = briefSchema.safeParse({
      motCle,
      intention: INTENTION_PLAN[intention.toLowerCase()] ?? intention,
      requetesSecondaires: [],
      champSemantique: [],
      entites: [],
      questions: [{ question, origine: "plan-editorial", reference: `plan n° ${numero}` }],
      urlCible: `${base}/fr/blog/${slug}`,
      cluster: lien || "sans-rattachement",
      type: "neuf",
    });
    if (resultat.success && slug) briefs.push(resultat.data);
    else rejets.push({ ligne: numero, raison: "brief invalide" });
  }
  return { briefs, rejets };
}
