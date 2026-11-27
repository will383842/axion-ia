/**
 * SCHÉMA DES RÉGLAGES DES ENCARTS VIDÉO (clé « videos_encarts » de la table de configuration clé/valeur).
 *
 * Forme DÉCLARÉE UNE SEULE FOIS ici : le répartiteur, le worker, l'action serveur et l'écran de
 * la console l'importent. Module PUR : aucune entrée/sortie (ni base, ni Redis, ni environnement).
 * Le test de parité de l'écran lit `reglagesEncartsSchema.shape` : c'est pourquoi le schéma de base
 * reste un objet Zod simple, la règle croisée (`seuilMax ≥ seuilMin`) étant dans
 * `analyserReglagesEncarts`.
 *
 * TOUT EST ÉTEINT PAR DÉFAUT : `actif` est faux. Les seuils ci-dessous sont PROVISOIRES, à
 * calibrer sur le stock réel avant tout allumage.
 */
import { z } from "zod";

/** Clé de la configuration (table de configuration clé/valeur). */
export const CLE_REGLAGES_ENCARTS = "videos_encarts";

/** Types de contenus pouvant accueillir un encart (liste fermée). */
export const TYPES_CONTENUS_ENCARTS = [
  "blog",
  "ville",
  "formation",
  "service",
  "guide",
  "actualite",
  "connaissance",
] as const;

export type TypeContenuEncart = (typeof TYPES_CONTENUS_ENCARTS)[number];

export const reglagesEncartsSchema = z
  .object({
    /** Interrupteur du répartiteur (en plus de `VIDEOS_SITE_ENABLED`) : faux par défaut. */
    actif: z.boolean().default(false),
    /** Score de proximité minimal (0 à 1) : en dessous, pas d'encart, jamais de remplissage. */
    seuilMin: z.number().min(0).max(1).default(0.6),
    /** Score maximal (0 à 1), OPTIONNEL, éteint par défaut (décision de Will requise). */
    // `null` (formulaire qui « éteint » l'option) équivaut à l'absence.
    seuilMax: z
      .number()
      .min(0)
      .max(1)
      .nullish()
      .transform((v) => v ?? undefined),
    /** Nombre maximal d'affectations actives par vidéo sur la fenêtre. */
    plafondParVideo: z.number().int().min(1).max(100_000).default(20),
    /** Fenêtre de comptage du plafond, en jours. */
    fenetreJours: z.number().int().min(1).max(365).default(30),
    /** Types de contenus où l'encart est permis. */
    typesContenus: z
      .array(z.enum(TYPES_CONTENUS_ENCARTS))
      .transform((l) => [...new Set(l)])
      .default(["blog"])
      .readonly(),
    /** Écarter les vidéos déjà affectées aux voisins (« À lire aussi », précédent/suivant…). */
    exclureVoisins: z.boolean().default(true),
    /** Vidéos (identifiants `SiteVideo`) jamais proposées. */
    videosExclues: z
      .array(z.string().min(1).max(200))
      .transform((l) => [...new Set(l)])
      .default([])
      .readonly(),
  })
  .strict();

export type ReglagesEncarts = z.infer<typeof reglagesEncartsSchema>;

/** Défauts complets (éteints). */
export const REGLAGES_ENCARTS_DEFAUT: Readonly<ReglagesEncarts> = Object.freeze(
  reglagesEncartsSchema.parse({}),
);

export type ResultatReglages =
  | { readonly ok: true; readonly reglages: ReglagesEncarts }
  | { readonly ok: false; readonly erreurs: ReadonlyArray<string> };

/**
 * Valide une valeur brute (lue en base ou saisie à l'écran). `null` / `undefined` → défauts
 * éteints. Applique la règle croisée `seuilMax ≥ seuilMin`.
 *
 * Mode STRICT par défaut (écriture : l'action serveur refuse une clé inconnue). Avec
 * `{ tolerant: true }` (LECTURE par le worker), les clés inconnues sont ignorées : un champ
 * ajouté plus tard par l'app ne doit pas éteindre les encarts pendant la fenêtre de mise en
 * ligne app/worker (AGENTS.md, D8b). Sur `ok: false`, le lecteur traite les encarts comme ÉTEINTS.
 * Limite assumée : le mode tolérant ne couvre que les clés inconnues, pas une VALEUR nouvelle
 * (nouveau type de contenu, borne élargie) : un ancien worker éteint alors les encarts (côté sûr).
 */
export function analyserReglagesEncarts(
  brut: unknown,
  options: { readonly tolerant?: boolean } = {},
): ResultatReglages {
  const schema = options.tolerant ? reglagesEncartsSchema.strip() : reglagesEncartsSchema;
  const r = schema.safeParse(brut ?? {});
  if (!r.success) {
    return {
      ok: false,
      erreurs: r.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`),
    };
  }
  const { seuilMin, seuilMax } = r.data;
  if (seuilMax !== undefined && seuilMax < seuilMin) {
    return { ok: false, erreurs: ["seuilMax : doit être supérieur ou égal à seuilMin"] };
  }
  return { ok: true, reglages: r.data };
}
